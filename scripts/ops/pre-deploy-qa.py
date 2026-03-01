#!/usr/bin/env python3
"""
Pre-deploy QA audit for Lebensordner.

Catches the classes of bugs that have caused production incidents:
  - Kong key-auth placeholder not resolved at deploy time
  - Build-time vs runtime Supabase env var confusion
  - Client-side redirect loops (onboarding <-> dashboard bounce)
  - Server-only env vars leaking into client bundles
  - Optional chaining pitfalls (obj?.prop.sub crashes if prop is undefined)
  - Fail-open not applied to critical endpoints
  - TypeScript errors

Usage:
    python scripts/ops/pre-deploy-qa.py            # full audit
    python scripts/ops/pre-deploy-qa.py --no-tsc   # skip tsc (faster)
    python scripts/ops/pre-deploy-qa.py --strict   # treat WARNs as failures
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

# ANSI colours
RED  = "\033[91m"
GRN  = "\033[92m"
YLW  = "\033[93m"
BLU  = "\033[94m"
DIM  = "\033[2m"
BOLD = "\033[1m"
RST  = "\033[0m"


class Result(NamedTuple):
    status: str   # PASS | WARN | FAIL
    check:  str
    detail: str = ""


results: list[Result] = []


def record(status: str, check: str, detail: str = "") -> None:
    results.append(Result(status, check, detail))
    icons = {"PASS": f"{GRN}PASS{RST}", "WARN": f"{YLW}WARN{RST}", "FAIL": f"{RED}FAIL{RST}"}
    print(f"  {icons[status]}  {check}")
    if detail:
        for line in detail.strip().splitlines():
            print(f"         {DIM}{line}{RST}")


def section(title: str) -> None:
    pad = "-" * max(0, 60 - len(title))
    print(f"\n{BOLD}{BLU}-- {title} {pad}{RST}")


ROOT = Path(__file__).resolve().parents[2]


def read(rel: str) -> str:
    p = ROOT / rel
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""


def ts_files() -> list[Path]:
    src = ROOT / "src"
    return [
        p for p in list(src.rglob("*.ts")) + list(src.rglob("*.tsx"))
        if "node_modules" not in p.parts
    ]


def client_files() -> list[Path]:
    out = []
    for p in ts_files():
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
            if "'use client'" in content or '"use client"' in content:
                out.append(p)
        except OSError:
            pass
    return out


def scan(paths: list[Path], pattern: str, flags: int = 0) -> list[tuple[Path, int, str]]:
    rx = re.compile(pattern, flags)
    hits: list[tuple[Path, int, str]] = []
    for p in paths:
        if "tests" in p.parts or "__tests__" in p.parts:
            continue
        try:
            for i, line in enumerate(
                p.read_text(encoding="utf-8", errors="replace").splitlines(), 1
            ):
                if rx.search(line):
                    hits.append((p, i, line.strip()))
        except OSError:
            pass
    return hits


def fmt_hits(hits: list[tuple[Path, int, str]], n: int = 8) -> str:
    lines = []
    for p, lineno, line in hits[:n]:
        rel = p.relative_to(ROOT)
        lines.append(f"{rel}:{lineno}  {line[:120]}")
    if len(hits) > n:
        lines.append(f"... and {len(hits) - n} more")
    return "\n".join(lines)


# ==============================================================================
# CHECKS
# ==============================================================================

# -- Kong / API Gateway --------------------------------------------------------

def check_kong_template_has_placeholders() -> None:
    """
    The repo kong.yml must keep the literal placeholder strings so the
    deploy-time sed substitution has something to replace. If they were
    already resolved and committed, a re-deploy reuses stale keys silently.
    """
    content = read("deploy/supabase/kong.yml")
    if not content:
        record("FAIL", "deploy/supabase/kong.yml not found")
        return
    ANON_PLACEHOLDER = "${SUPABASE_ANON_KEY}"
    SVC_PLACEHOLDER  = "${SUPABASE_SERVICE_KEY}"
    has_anon = ANON_PLACEHOLDER in content
    has_svc  = SVC_PLACEHOLDER  in content
    if has_anon and has_svc:
        record("PASS", "kong.yml contains both placeholder vars (template intact)")
    else:
        missing = []
        if not has_anon: missing.append(ANON_PLACEHOLDER)
        if not has_svc:  missing.append(SVC_PLACEHOLDER)
        record("FAIL",
               "kong.yml template missing placeholder(s): " + ", ".join(missing),
               "The deploy-time sed has nothing to replace -> Kong starts with the\n"
               "literal placeholder string as the key, rejecting every request.")


def check_ci_kong_sed_substitution() -> None:
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping Kong sed check")
        return
    has_anon_sed = bool(re.search(r"s[|/].*SUPABASE_ANON_KEY.*[|/]", ci))
    has_svc_sed  = bool(re.search(r"s[|/].*SUPABASE_SERVICE_KEY.*[|/]", ci))
    if has_anon_sed and has_svc_sed:
        record("PASS", "CI deploy sed-substitutes both Kong keys")
    else:
        missing = []
        if not has_anon_sed: missing.append("SUPABASE_ANON_KEY")
        if not has_svc_sed:  missing.append("SUPABASE_SERVICE_KEY")
        record("FAIL",
               f"CI deploy missing sed for: {', '.join(missing)}",
               "The deploy script must substitute all keys before restarting Kong,\n"
               "otherwise key-auth rejects all Supabase REST/storage requests.")


def check_ci_kong_force_recreate() -> None:
    """Kong (db-less) only reads declarative config at startup -- must force-recreate."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        return
    if "--force-recreate kong" in ci or re.search(r"--force-recreate\s+kong", ci):
        record("PASS", "CI force-recreates Kong after key substitution")
    else:
        record("FAIL",
               "CI does not --force-recreate kong",
               "Kong in db-less mode caches config at startup only.\n"
               "Without force-recreate, old or placeholder key-auth creds stay active.")


def check_kong_key_auth_enabled() -> None:
    content = read("deploy/supabase/kong.yml")
    if not content:
        return
    rest_section    = re.search(r"name:\s*rest-v1.*?(?=\n- name:|\Z)", content, re.DOTALL)
    storage_section = re.search(r"name:\s*storage-v1.*?(?=\n- name:|\Z)", content, re.DOTALL)
    issues = []
    if rest_section and "key-auth" not in rest_section.group(0):
        issues.append("rest-v1 missing key-auth plugin")
    if storage_section and "key-auth" not in storage_section.group(0):
        issues.append("storage-v1 missing key-auth plugin")
    if issues:
        record("FAIL", "Kong route(s) missing key-auth: " + "; ".join(issues),
               "Without key-auth the routes are publicly accessible without an API key.")
    else:
        record("PASS", "Kong rest-v1 and storage-v1 have key-auth plugin")


# -- Docker & Environment Variables -------------------------------------------

def check_dockerfile_no_secret_args() -> None:
    """
    ENCRYPTION_KEY and SUPABASE_SERVICE_ROLE_KEY must NOT be ARG/ENV in the
    Dockerfile -- they must be BuildKit secrets or runtime-only env vars.
    Build ARGs are visible in docker history and CI logs.
    """
    content = read("Dockerfile")
    bad = [
        (r"^ARG\s+ENCRYPTION_KEY",             "ENCRYPTION_KEY as ARG"),
        (r"^ARG\s+SUPABASE_SERVICE_ROLE_KEY",  "SUPABASE_SERVICE_ROLE_KEY as ARG"),
        (r"^ENV\s+ENCRYPTION_KEY=",            "ENCRYPTION_KEY baked via ENV"),
        (r"^ENV\s+SUPABASE_SERVICE_ROLE_KEY=", "SUPABASE_SERVICE_ROLE_KEY baked via ENV"),
    ]
    found = [label for pattern, label in bad if re.search(pattern, content, re.MULTILINE)]
    if found:
        record("FAIL",
               "Dockerfile bakes secret(s) as build ARG/ENV: " + ", ".join(found),
               "Use --mount=type=secret,id=... (BuildKit) for secrets at build time.")
    else:
        record("PASS", "Dockerfile does not bake secrets as ARG/ENV")


def check_next_public_var_names() -> None:
    """NEXT_PUBLIC_ vars are baked into the client bundle -- never use for secrets."""
    danger = re.compile(r"(secret|password|passwd|service_role|private_?key)", re.IGNORECASE)
    hits = scan(ts_files(), r"NEXT_PUBLIC_\w+")
    bad = []
    for p, lineno, text in hits:
        m = re.search(r"NEXT_PUBLIC_\w+", text)
        if m and danger.search(m.group(0)):
            bad.append((p, lineno, text))
    if bad:
        record("FAIL",
               f"NEXT_PUBLIC_ variable name(s) look like secrets ({len(bad)} hits)",
               fmt_hits(bad) +
               "\nNEXT_PUBLIC_ vars are visible in the browser bundle. Never use for secrets.")
    else:
        record("PASS", "No NEXT_PUBLIC_ variable names resemble secrets")


def check_supabase_url_consistency() -> None:
    """SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL should use the same CI secret."""
    ci = read(".github/workflows/ci.yml")
    # Match patterns like: SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    url_secrets     = set(re.findall(r"SUPABASE_URL:\s*\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}", ci))
    pub_url_secrets = set(re.findall(
        r"NEXT_PUBLIC_SUPABASE_URL:\s*\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}", ci
    ))
    if url_secrets and pub_url_secrets:
        if url_secrets == pub_url_secrets:
            record("PASS", "SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL use the same CI secret")
        else:
            record("WARN",
                   "SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL map to different CI secrets",
                   f"SUPABASE_URL             -> {url_secrets}\n"
                   f"NEXT_PUBLIC_SUPABASE_URL -> {pub_url_secrets}\n"
                   "A mismatch means server and browser clients hit different endpoints.")
    else:
        record("WARN", "Could not verify SUPABASE_URL consistency in ci.yml")


def check_docker_compose_env_coverage() -> None:
    """All vars referenced in docker-compose.yml should appear in deploy/.env.example."""
    compose = read("deploy/docker-compose.yml")
    if not compose:
        record("WARN", "deploy/docker-compose.yml not found")
        return
    referenced = set(re.findall(r"\$\{([A-Z_][A-Z0-9_]*)(?:[^}]*)?\}", compose))
    env_example_path = ROOT / "deploy" / ".env.example"
    if not env_example_path.exists():
        env_example_path = ROOT / ".env.example"
    env_example = (
        env_example_path.read_text(encoding="utf-8", errors="replace")
        if env_example_path.exists() else ""
    )
    documented = set(re.findall(r"^([A-Z_][A-Z0-9_]*)=", env_example, re.MULTILINE))
    ignored    = {"GITHUB_SHA", "DOMAIN", "CI", "GITHUB_REPO"}
    missing    = sorted(referenced - documented - ignored)
    if missing:
        record("WARN",
               f"{len(missing)} docker-compose var(s) not in .env.example",
               "\n".join(missing[:20]))
    else:
        record("PASS", "All docker-compose.yml vars are documented in .env.example")


# -- Runtime Config & Client Safety -------------------------------------------

def check_runtime_config_injection() -> None:
    """
    layout.tsx must inject window.__LEBENSORDNER_PUBLIC_CONFIG__ so the browser
    Supabase client gets the runtime URL/key, not the build-time baked value.
    Without this, rotating keys requires a full Docker rebuild.
    """
    content = read("src/app/layout.tsx")
    if "__LEBENSORDNER_PUBLIC_CONFIG__" in content:
        record("PASS", "layout.tsx injects runtime public config")
    else:
        record("FAIL",
               "layout.tsx missing window.__LEBENSORDNER_PUBLIC_CONFIG__ injection",
               "Browser Supabase client falls back to build-time NEXT_PUBLIC_SUPABASE_URL.\n"
               "Rotating keys or changing the URL then requires a full Docker rebuild.")


def check_browser_client_uses_runtime_config() -> None:
    content = read("src/lib/supabase/client.ts")
    if "__LEBENSORDNER_PUBLIC_CONFIG__" in content or "runtimeConfig" in content:
        record("PASS", "Browser Supabase client reads runtime config first")
    else:
        record("WARN",
               "Browser Supabase client may not read runtime config",
               "src/lib/supabase/client.ts should prefer window.__LEBENSORDNER_PUBLIC_CONFIG__\n"
               "over NEXT_PUBLIC_SUPABASE_URL so keys can change without a rebuild.")


def check_no_server_envs_in_client_files() -> None:
    server_only = [
        "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY", "JWT_SECRET",
        "POSTGRES_PASSWORD", "STRIPE_SECRET_KEY", "RESEND_API_KEY",
        "CRON_SECRET", "TURNSTILE_SECRET_KEY",
    ]
    bad: list[tuple[Path, int, str]] = []
    for p in client_files():
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for var in server_only:
            if var in content:
                bad.append((p, 0, f"References {var}"))
    if bad:
        record("FAIL", "'use client' file(s) reference server-only env vars", fmt_hits(bad))
    else:
        record("PASS", "No server-only env vars found in 'use client' files")


def check_encryption_key_not_validated_early() -> None:
    """
    validate-env.ts runs on every request via middleware. If ENCRYPTION_KEY is
    in the required list and is absent at startup, ALL routes return 500 before
    reaching any handler. Validate it lazily inside the encryption module only.
    """
    content = read("src/lib/config/validate-env.ts")
    if not content:
        record("WARN", "validate-env.ts not found")
        return
    if "ENCRYPTION_KEY" in content:
        record("WARN",
               "ENCRYPTION_KEY is validated in global validate-env.ts (runs in middleware)",
               "If the key is absent at middleware boot, ALL requests fail with 500.\n"
               "Consider validating ENCRYPTION_KEY lazily inside the encryption module only.")
    else:
        record("PASS", "ENCRYPTION_KEY not in global startup validation")


# -- Code Quality & Anti-Patterns ---------------------------------------------

def check_optional_chaining_pitfall() -> None:
    """
    obj?.prop.sub only guards against obj being null/undefined, but crashes if
    prop itself is undefined. Should be obj?.prop?.sub.
    This class of bug has been documented in this project's memory notes.
    """
    rx = re.compile(
        r'\?\.[a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*(?!\?|\(|\[)'
    )
    # These ?.prop.X patterns are safe because the intermediate property is always
    # defined when the object exists (Web API guarantees, DOM, etc.)
    safe_patterns = [
        r'\?\.headers\.get\(',    # Request.headers is always defined if request exists
        r'\?\.body\.getReader\(', # Response.body
        r'\?\.data\.',            # Supabase result .data may be null but is always present
    ]
    safe_rx = re.compile("|".join(safe_patterns))
    hits: list[tuple[Path, int, str]] = []
    for p in ts_files():
        if "node_modules" in p.parts or "tests" in p.parts or "__tests__" in p.parts:
            continue
        try:
            for i, line in enumerate(
                p.read_text(encoding="utf-8", errors="replace").splitlines(), 1
            ):
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                if rx.search(line) and not safe_rx.search(line):
                    hits.append((p, i, stripped))
        except OSError:
            pass
    if hits:
        record("WARN",
               f"Possible unsafe optional chaining -- {len(hits)} location(s)",
               fmt_hits(hits, n=10) +
               "\n`obj?.prop.sub` crashes if `prop` is undefined. Use `obj?.prop?.sub`.")
    else:
        record("PASS", "No obvious unsafe optional chaining patterns found")


def check_instanceof_arraybuffer() -> None:
    """instanceof ArrayBuffer fails across JS realms (jsdom, workers, iframes)."""
    hits = scan(ts_files(), r'instanceof\s+ArrayBuffer')
    if hits:
        record("WARN",
               f"instanceof ArrayBuffer -- {len(hits)} location(s)",
               fmt_hits(hits) +
               "\nCross-realm check fails in jsdom/workers. Use `ab.byteLength !== undefined`.")
    else:
        record("PASS", "No cross-realm ArrayBuffer checks found")


def check_console_log_sensitive() -> None:
    """
    Warn if console.log prints what looks like a sensitive *variable* (not just a
    string label that happens to contain the word 'secret' or 'password').
    We distinguish by checking that the sensitive word appears outside of quotes.
    """
    # Matches console.log/error/warn/info calls
    console_rx = re.compile(r'console\.(log|error|warn|info)\s*\(', re.IGNORECASE)
    # Sensitive identifier pattern: the word must not be inside a string literal
    # (i.e. not surrounded by quotes). We strip string contents and then check.
    sensitive_rx = re.compile(
        r'\b(password|service_role_key|encryption_key|jwt_secret|private_key)\b',
        re.IGNORECASE,
    )
    hits: list[tuple[Path, int, str]] = []
    for p in ts_files():
        if "tests" in p.parts or "__tests__" in p.parts:
            continue
        try:
            for i, line in enumerate(
                p.read_text(encoding="utf-8", errors="replace").splitlines(), 1
            ):
                if not console_rx.search(line):
                    continue
                # Remove string literal contents so we only match bare identifiers
                stripped_strings = re.sub(r'(["\'])(?:(?!\1).)*\1', '""', line)
                if sensitive_rx.search(stripped_strings):
                    hits.append((p, i, line.strip()))
        except OSError:
            pass
    if hits:
        record("WARN",
               f"console.log may print sensitive variable -- {len(hits)} location(s)",
               fmt_hits(hits))
    else:
        record("PASS", "No console.log statements printing obvious sensitive variables")


# -- Redirect Safety ----------------------------------------------------------

def check_client_redirect_loops() -> None:
    """
    'use client' components with router.push/replace inside useEffect body can
    loop if the dependency array or guard condition is wrong.
    This caused the onboarding <-> dashboard redirect bounce in this project.
    onClick handlers that call router.push are fine -- they only fire on click.
    """
    candidates: list[tuple[Path, int, str]] = []
    for p in client_files():
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        if not any("useEffect" in l for l in lines):
            continue
        # Track whether we're inside a useEffect body (rough heuristic: after
        # "useEffect(" and before the matching closing brace at the same indent).
        # Simpler: flag router.push lines that are NOT on an onClick= line.
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if re.search(r'router\.(push|replace)\s*\(', stripped):
                # Skip onClick handlers -- these are user-triggered, not automatic
                if "onClick" in stripped or "onSubmit" in stripped or "onPress" in stripped:
                    continue
                candidates.append((p, i, stripped))
    if candidates:
        unique_files = len({p for p, _, _ in candidates})
        record("WARN",
               f"router.push/replace in useEffect body -- {unique_files} file(s)",
               fmt_hits(candidates, n=6) +
               "\nVerify deps array prevents an infinite redirect loop.")
    else:
        record("PASS", "No obvious router.push/replace-in-useEffect patterns found")


def check_server_page_redirect_count() -> None:
    """
    Server pages with 2+ redirect() calls can create bounce loops if the
    conditions can oscillate (e.g. missing profile -> onboarding -> profile
    created -> dashboard -> missing profile again).
    """
    suspicious: list[tuple[Path, int, str]] = []
    for p in (ROOT / "src" / "app").rglob("page.tsx"):
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if "'use client'" in content or '"use client"' in content:
            continue
        redirects = re.findall(r'\bredirect\s*\(', content)
        if len(redirects) >= 2:
            suspicious.append((p, 0, f"{len(redirects)} redirect() calls"))
    if suspicious:
        record("WARN",
               f"Server page(s) with multiple redirect() calls -- {len(suspicious)} file(s)",
               fmt_hits(suspicious, n=5) +
               "\nVerify conditions cannot oscillate and cause a bounce loop.")
    else:
        record("PASS", "No server pages with suspicious multiple-redirect patterns")


# -- API Route Security -------------------------------------------------------

def check_api_routes_have_auth() -> None:
    """Protected API routes must authenticate before performing any action."""
    api_dir = ROOT / "src" / "app" / "api"
    if not api_dir.exists():
        record("WARN", "No src/app/api directory found")
        return
    # Routes that are intentionally public or use non-session auth
    public_prefixes = {
        "auth/login", "auth/register", "auth/callback",
        "auth/password-reset", "auth/verify",
        "auth/2fa/verify",   # runs before user has a session (pre-auth step)
        "health", "webhook", "metrics", "cron",
        # Token-based routes (validate signed token from DB, not user session)
        "download-link",
        "invitation",
        # Intentionally unauthenticated
        "errors/log",        # client-side error logging, no auth needed
        "feedback",          # public feedback form (non-authenticated users can submit)
        "stripe/prices",     # returns only public price IDs, no sensitive data
    }
    unprotected: list[str] = []
    for route_file in sorted(api_dir.rglob("route.ts")):
        rel = route_file.relative_to(api_dir).parent
        route_path = str(rel).replace("\\", "/")
        if any(route_path.startswith(pfx) for pfx in public_prefixes):
            continue
        try:
            content = route_file.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        has_handler = bool(re.search(
            r"^export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)",
            content, re.MULTILINE,
        ))
        if not has_handler:
            continue
        auth_signals = [
            "getUser(",        # matches getUser() and getUser(token) patterns
            "requireAdmin()", "requireAuth()", "getSession()",
            "validateCronSecret", "CRON_SECRET", "METRICS_SECRET",
            "GRAFANA_WEBHOOK_SECRET", "TELEGRAM_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET",
        ]
        if not any(sig in content for sig in auth_signals):
            unprotected.append(route_path)
    if unprotected:
        detail = "\n".join(f"  src/app/api/{r}/route.ts" for r in unprotected[:12])
        if len(unprotected) > 12:
            detail += f"\n  ... and {len(unprotected) - 12} more"
        record("WARN", f"{len(unprotected)} API route(s) may lack auth guard", detail)
    else:
        record("PASS", "All checked API routes appear to have an auth guard")


def check_critical_endpoints_fail_open() -> None:
    """
    Consent, health, and vault endpoints must catch DB errors gracefully.
    A bare throw propagates as a 500 which can trigger client-side redirect loops.
    """
    critical_dirs = [
        "src/app/api/consent",
        "src/app/api/health",
        "src/app/api/vault",
    ]
    issues: list[tuple[Path, int, str]] = []
    for rel_dir in critical_dirs:
        d = ROOT / rel_dir
        if not d.exists():
            continue
        for route_file in d.rglob("route.ts"):
            try:
                content = route_file.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            has_try   = bool(re.search(r'\btry\s*\{', content))
            has_catch = bool(re.search(r'\bcatch\s*[\({]', content))
            bare_throw = bool(re.search(r'^\s{0,8}throw\s+', content, re.MULTILINE))
            if bare_throw and not (has_try and has_catch):
                rel = route_file.relative_to(ROOT)
                issues.append((route_file, 0, f"bare throw without try/catch: {rel}"))
    if issues:
        record("WARN", "Critical endpoint(s) may throw unhandled errors", fmt_hits(issues))
    else:
        record("PASS", "Critical endpoints (consent/health/vault) have error handling")


# -- Deploy Tooling -----------------------------------------------------------

def check_verify_deploy_script() -> None:
    content = read("scripts/ops/verify-deploy.sh")
    if not content:
        record("FAIL", "scripts/ops/verify-deploy.sh not found -- no post-deploy smoke checks")
        return
    probes = {
        "Kong placeholder check": (
            "SUPABASE_ANON_KEY" in content or "SUPABASE_SERVICE_KEY" in content
        ),
        "REST key-auth probe":   ("rest/v1" in content and "apikey" in content),
        "Health endpoint check": "/api/health" in content,
        "Prometheus check":      "prometheus" in content or "Prometheus" in content,
        "Service running check": (
            "require_service_running" in content or "docker compose ps" in content
        ),
    }
    missing = [name for name, ok in probes.items() if not ok]
    if missing:
        record("WARN", f"verify-deploy.sh missing probe(s): {', '.join(missing)}")
    else:
        record("PASS", "verify-deploy.sh has all expected smoke probes")


def check_smoke_check_in_ci() -> None:
    ci = read(".github/workflows/ci.yml")
    if "verify-deploy.sh" in ci or "smoke-check" in ci.lower():
        record("PASS", "CI workflow includes a smoke-check step")
    else:
        record("WARN", "CI workflow may be missing smoke-check step")


# -- TypeScript ---------------------------------------------------------------

def check_typescript(timeout: int = 120) -> None:
    """Run tsc --noEmit to catch type errors before they reach production."""
    tsc_bin = ROOT / "node_modules" / ".bin" / "tsc.cmd"
    if not tsc_bin.exists():
        tsc_bin = ROOT / "node_modules" / ".bin" / "tsc"
    if tsc_bin.exists():
        cmd = [str(tsc_bin), "--noEmit", "--pretty", "false"]
    else:
        cmd = ["npx", "tsc", "--noEmit", "--pretty", "false"]
    try:
        result = subprocess.run(
            cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout,
            shell=(sys.platform == "win32"),
        )
        if result.returncode == 0:
            record("PASS", "TypeScript type-check passed (tsc --noEmit)")
        else:
            lines  = (result.stdout + result.stderr).strip().splitlines()
            unique = list(dict.fromkeys(lines))[:18]
            detail = "\n".join(unique)
            if len(lines) > 18:
                detail += f"\n... ({len(lines) - 18} more lines)"
            record("FAIL", f"TypeScript errors found ({len(lines)} diagnostic lines)", detail)
    except subprocess.TimeoutExpired:
        record("WARN", f"tsc timed out after {timeout}s -- skipping")
    except Exception as exc:
        record("WARN", f"tsc could not run: {exc}")


# ==============================================================================
# MAIN
# ==============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(description="Pre-deploy QA audit for Lebensordner")
    parser.add_argument("--no-tsc", action="store_true",
                        help="Skip TypeScript type-check (faster for quick iterative runs)")
    parser.add_argument("--strict", action="store_true",
                        help="Treat WARNs as failures -- blocks deploy on any warning")
    args = parser.parse_args()

    print(f"\n{BOLD}{'=' * 68}{RST}")
    print(f"{BOLD}  Lebensordner Pre-Deploy QA Audit{RST}")
    print(f"{DIM}  Project root: {ROOT}{RST}")
    print(f"{BOLD}{'=' * 68}{RST}")

    section("Kong / API Gateway")
    check_kong_template_has_placeholders()
    check_ci_kong_sed_substitution()
    check_ci_kong_force_recreate()
    check_kong_key_auth_enabled()

    section("Docker & Environment Variables")
    check_dockerfile_no_secret_args()
    check_next_public_var_names()
    check_supabase_url_consistency()
    check_docker_compose_env_coverage()

    section("Runtime Config & Client Safety")
    check_runtime_config_injection()
    check_browser_client_uses_runtime_config()
    check_no_server_envs_in_client_files()
    check_encryption_key_not_validated_early()

    section("Code Quality & Anti-Patterns")
    check_optional_chaining_pitfall()
    check_instanceof_arraybuffer()
    check_console_log_sensitive()

    section("Redirect Safety")
    check_client_redirect_loops()
    check_server_page_redirect_count()

    section("API Route Security")
    check_api_routes_have_auth()
    check_critical_endpoints_fail_open()

    section("Deploy Tooling")
    check_verify_deploy_script()
    check_smoke_check_in_ci()

    if not args.no_tsc:
        section("TypeScript")
        check_typescript()
    else:
        print(f"\n{DIM}  [TypeScript check skipped via --no-tsc]{RST}")

    n_pass = sum(1 for r in results if r.status == "PASS")
    n_warn = sum(1 for r in results if r.status == "WARN")
    n_fail = sum(1 for r in results if r.status == "FAIL")

    print(f"\n{BOLD}{'-' * 68}{RST}")
    print(f"{BOLD}  Results:  {GRN}{n_pass} PASS{RST}  {YLW}{n_warn} WARN{RST}  {RED}{n_fail} FAIL{RST}")
    print(f"{BOLD}{'-' * 68}{RST}\n")

    if n_fail > 0:
        print(f"{RED}{BOLD}  X  Deploy BLOCKED -- fix all FAILs before pushing to production.{RST}\n")
        return 1
    if n_warn > 0 and args.strict:
        print(f"{YLW}{BOLD}  !  Deploy BLOCKED (--strict) -- resolve WARNs before deploying.{RST}\n")
        return 1
    if n_warn > 0:
        print(f"{YLW}{BOLD}  !  Warnings present -- review before deploying.{RST}\n")
        return 0
    print(f"{GRN}{BOLD}  OK  All checks passed -- safe to deploy.{RST}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
