#!/usr/bin/env python3
"""
Logging policy audit.

Enforces:
  - No raw console.error usage in src/app/api routes
  - Structured logger supports warn/info levels
  - Auth expected outcomes are not logged as error-level events
  - Grafana "Error Spike" alert remains level="error" only
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "src" / "app" / "api"
LOGGER_FILE = ROOT / "src" / "lib" / "errors" / "structured-logger.ts"
ALERT_RULES_FILE = ROOT / "deploy" / "grafana" / "provisioning" / "alerting" / "alert-rules.yml"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def fail(message: str) -> int:
    print(f"FAIL: {message}")
    return 1


def pass_msg(message: str) -> None:
    print(f"PASS: {message}")


def main() -> int:
    if not API_DIR.exists():
        return fail(f"Missing API directory: {API_DIR}")

    errors: list[str] = []

    # 1) Block raw console.error in API routes.
    console_error_hits: list[str] = []
    for route_file in API_DIR.rglob("route.ts"):
        content = read(route_file)
        for idx, line in enumerate(content.splitlines(), start=1):
            if "console.error(" in line:
                rel = route_file.relative_to(ROOT)
                console_error_hits.append(f"{rel}:{idx}")

    if console_error_hits:
        errors.append(
            "Raw console.error found in API routes:\n  - " + "\n  - ".join(console_error_hits[:30]) +
            ("\n  - ...more" if len(console_error_hits) > 30 else "")
        )
    else:
        pass_msg("No raw console.error usage in src/app/api")

    # 2) Structured logger exports warn/info helpers.
    if not LOGGER_FILE.exists():
        errors.append(f"Missing structured logger file: {LOGGER_FILE.relative_to(ROOT)}")
    else:
        logger = read(LOGGER_FILE)
        if "export function emitStructuredWarn" not in logger:
            errors.append("structured-logger.ts missing emitStructuredWarn export")
        if "export function emitStructuredInfo" not in logger:
            errors.append("structured-logger.ts missing emitStructuredInfo export")
        if "sanitizeMessage(" not in logger or "redactMetadata(" not in logger:
            errors.append("structured-logger.ts missing message/metadata sanitization guards")
        else:
            pass_msg("Structured logger has warn/info + sanitization guards")

    # 3) Expected auth outcomes must not be emitted as error.
    login_route = ROOT / "src" / "app" / "api" / "auth" / "login" / "route.ts"
    reset_route = ROOT / "src" / "app" / "api" / "auth" / "password-reset" / "request" / "route.ts"
    for route_path in [login_route, reset_route]:
        if not route_path.exists():
            errors.append(f"Missing route file: {route_path.relative_to(ROOT)}")
            continue
        content = read(route_path)
        expected_patterns = [
            "Invalid credentials",
            "CAPTCHA required",
            "rate limit",
            "rate_limited",
            "captcha_failed",
        ]
        for pat in expected_patterns:
            # allow if string not present in this file
            if pat not in content:
                continue
            # disallow obvious error-level emission around expected conditions
            if re.search(rf"emitStructuredError\(\{{[^}}]*{re.escape(pat)}", content, flags=re.DOTALL):
                errors.append(
                    f"{route_path.relative_to(ROOT)} logs expected auth/security event as error ({pat})"
                )
    pass_msg("Auth routes do not log expected outcomes as error-level events")

    # 4) Error Spike alert must remain error-only.
    if not ALERT_RULES_FILE.exists():
        errors.append(f"Missing alert rules file: {ALERT_RULES_FILE.relative_to(ROOT)}")
    else:
        rules = read(ALERT_RULES_FILE)
        if 'title: "Error Spike"' not in rules:
            errors.append("Grafana alert-rules.yml missing Error Spike rule")
        elif 'level="error"' not in rules:
            errors.append('Error Spike rule is not constrained to level="error"')
        else:
            pass_msg('Error Spike alert remains constrained to level="error"')

    if errors:
        print("\nLogging audit failed:")
        for err in errors:
            print(f"- {err}")
        return 1

    print("\nPASS: Logging policy audit passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
