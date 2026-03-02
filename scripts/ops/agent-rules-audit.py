#!/usr/bin/env python3
"""
Agent Rules Audit for Lebensordner.

Static analysis for React 19 compliance, AGENTS.md composition rules,
accessibility (WCAG 2.2 AA), mobile readiness, and design-system hygiene.

Also validates that AGENTS.md, CLAUDE.md, and GEMINI.md each reference
every rule file in .claude/rules/ (cross-reference guard).

The CI `agent-rule-guard` job runs this script and blocks all downstream jobs.

Usage:
    python scripts/ops/agent-rules-audit.py              # full audit
    python scripts/ops/agent-rules-audit.py --strict     # treat WARNs as failures
    python scripts/ops/agent-rules-audit.py --fix-hints  # print remediation snippets
"""

import argparse
import re
import sys
from pathlib import Path
from typing import NamedTuple

# ANSI colours (mirrors pre-deploy-qa.py)
RED  = "\033[91m"
GRN  = "\033[92m"
YLW  = "\033[93m"
BLU  = "\033[94m"
CYN  = "\033[96m"
DIM  = "\033[2m"
BOLD = "\033[1m"
RST  = "\033[0m"

ROOT = Path(__file__).resolve().parents[2]


class Result(NamedTuple):
    status: str   # PASS | WARN | FAIL
    check:  str
    detail: str = ""
    hint:   str = ""


results: list[Result] = []
_show_hints: bool = False


def record(status: str, check: str, detail: str = "", hint: str = "") -> None:
    results.append(Result(status, check, detail, hint))
    icons = {
        "PASS": f"{GRN}PASS{RST}",
        "WARN": f"{YLW}WARN{RST}",
        "FAIL": f"{RED}FAIL{RST}",
    }
    print(f"  {icons[status]}  {check}")
    if detail:
        for line in detail.strip().splitlines():
            print(f"         {DIM}{line}{RST}")
    if hint and _show_hints and status in ("WARN", "FAIL"):
        print(f"         {CYN}Hint: {hint}{RST}")


def section(title: str) -> None:
    pad = "-" * max(0, 60 - len(title))
    print(f"\n{BOLD}{BLU}-- {title} {pad}{RST}")


def read(rel: str) -> str:
    p = ROOT / rel
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""


def tsx_files() -> list[Path]:
    src = ROOT / "src"
    return [
        p for p in list(src.rglob("*.tsx"))
        if "node_modules" not in p.parts
        and "tests" not in p.parts
        and "__tests__" not in p.parts
    ]


def ts_tsx_files() -> list[Path]:
    src = ROOT / "src"
    return [
        p for p in list(src.rglob("*.ts")) + list(src.rglob("*.tsx"))
        if "node_modules" not in p.parts
        and "tests" not in p.parts
        and "__tests__" not in p.parts
    ]


def scan(
    paths: list[Path],
    pattern: str,
    flags: int = 0,
) -> list[tuple[Path, int, str]]:
    rx = re.compile(pattern, flags)
    hits: list[tuple[Path, int, str]] = []
    for p in paths:
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
        loc = f"{rel}:{lineno}" if lineno else str(rel)
        lines.append(f"{loc}  {line[:120]}")
    if len(hits) > n:
        lines.append(f"... and {len(hits) - n} more")
    return "\n".join(lines)


# ==============================================================================
# SECTION 0 — Agent Doc Cross-Reference Guard
# ==============================================================================

def check_agent_docs_reference_rules() -> None:
    """AGENTS.md, CLAUDE.md, and GEMINI.md must each reference all rule files."""
    rules_dir = ROOT / ".claude" / "rules"
    if not rules_dir.exists():
        record("FAIL", ".claude/rules/ directory not found")
        return

    rule_files = sorted(p.name for p in rules_dir.glob("*.md"))
    if not rule_files:
        record("WARN", "No rule files found in .claude/rules/")
        return

    required_docs = ("AGENTS.md", "CLAUDE.md", "GEMINI.md")
    all_ok = True
    for doc_name in required_docs:
        path = ROOT / doc_name
        if not path.exists():
            record(
                "FAIL",
                f"{doc_name} is missing — agent doc cross-reference cannot be verified",
                hint=f"Create {doc_name} and list each file in .claude/rules/.",
            )
            all_ok = False
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        missing = [name for name in rule_files if name not in content]
        if missing:
            record(
                "WARN",
                f"{doc_name} does not reference {len(missing)} rule file(s)",
                "\n".join(missing),
                hint=f"Add each missing rule name to {doc_name} under 'Mandatory rule files:'.",
            )
            all_ok = False
        else:
            record("PASS", f"{doc_name} references all {len(rule_files)} rule files")

    if all_ok:
        record("PASS", f"All agent docs cross-reference {len(rule_files)} rules")


# ==============================================================================
# SECTION 1 — React 19 & AGENTS.md Rules
# ==============================================================================

def check_no_forwardref() -> None:
    """React 19: ref is a regular prop — forwardRef() wrapper is obsolete."""
    hits = scan(ts_tsx_files(), r'\bforwardRef\s*[<(]')
    if hits:
        record(
            "WARN",
            f"forwardRef usage — {len(hits)} location(s) (React 19 anti-pattern)",
            fmt_hits(hits),
            hint=(
                "Replace `const Foo = forwardRef<T, P>((props, ref) => ...)` with\n"
                "         `function Foo({ ref, ...props }: P & { ref?: React.Ref<T> }) { ... }`"
            ),
        )
    else:
        record("PASS", "No forwardRef usage found (React 19 compatible)")


def check_no_use_context() -> None:
    """React 19: use(Context) replaces useContext(Context)."""
    hits = scan(ts_tsx_files(), r'\buseContext\s*\(')
    if hits:
        record(
            "WARN",
            f"useContext() usage — {len(hits)} location(s) (React 19 anti-pattern)",
            fmt_hits(hits),
            hint=(
                "Replace `const value = useContext(MyContext)` with\n"
                "         `const value = use(MyContext)`  (can also be called conditionally)"
            ),
        )
    else:
        record("PASS", "No useContext() found — use(Context) pattern applied")


def check_no_boolean_props() -> None:
    """AGENTS.md: boolean props (is*/has*/show*/should*) violate composition rules."""
    rx = re.compile(r'\b(?:is|has|show|should)[A-Z]\w*\s*\??:')
    hits: list[tuple[Path, int, str]] = []
    for p in tsx_files():
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        in_type_block = False
        depth = 0
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if re.search(r'\b(?:interface|type)\b.*\{', stripped):
                in_type_block = True
                depth += stripped.count("{") - stripped.count("}")
            elif in_type_block:
                depth += stripped.count("{") - stripped.count("}")
                if depth <= 0:
                    in_type_block = False
                    depth = 0
            if in_type_block and rx.search(stripped):
                hits.append((p, i, stripped))
    if hits:
        record(
            "WARN",
            f"Boolean prop names in interface/type — {len(hits)} location(s)",
            fmt_hits(hits),
            hint=(
                "Avoid `isThread?: boolean` — use explicit variant components instead.\n"
                "         See AGENTS.md: architecture-avoid-boolean-props"
            ),
        )
    else:
        record("PASS", "No boolean prop proliferation in interface/type definitions")


# ==============================================================================
# SECTION 2 — Composition Anti-Patterns
# ==============================================================================

def check_no_render_props_in_types() -> None:
    """AGENTS.md: render prop pattern in Props violates compound component rules."""
    rx = re.compile(r'\brender[A-Z]\w+\s*\??\s*:')
    hits: list[tuple[Path, int, str]] = []
    for p in tsx_files():
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        in_type_block = False
        depth = 0
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if re.search(r'\b(?:interface|type)\b.*\{', stripped):
                in_type_block = True
                depth += stripped.count("{") - stripped.count("}")
            elif in_type_block:
                depth += stripped.count("{") - stripped.count("}")
                if depth <= 0:
                    in_type_block = False
                    depth = 0
            if in_type_block and rx.search(stripped):
                hits.append((p, i, stripped))
    if hits:
        record(
            "WARN",
            f"Render prop pattern in Props types — {len(hits)} location(s)",
            fmt_hits(hits),
            hint=(
                "Replace `renderHeader?: () => ReactNode` with compound components.\n"
                "         See AGENTS.md: architecture-compound-components"
            ),
        )
    else:
        record("PASS", "No render prop patterns detected in Props types")


def check_no_multi_boolean_ternaries() -> None:
    """Chains of 3+ boolean flag checks in JSX rendering — violates composition rules."""
    rx_flag = re.compile(r'\b(?:is|has|show)\w+\s*(?:&&|\?)')
    hits: list[tuple[Path, int, str]] = []
    seen_first_lines: set[int] = set()
    for p in tsx_files():
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for i in range(len(lines)):
            window = lines[i:i + 15]
            flag_lines = [j for j, l in enumerate(window) if rx_flag.search(l)]
            if len(flag_lines) >= 3:
                first_lineno = i + flag_lines[0] + 1
                if first_lineno not in seen_first_lines:
                    seen_first_lines.add(first_lineno)
                    hits.append((p, first_lineno, f"{len(flag_lines)} boolean flag conditions in 15-line window"))
    if hits:
        record(
            "WARN",
            f"Multi-boolean conditional rendering — {len(hits)} location(s)",
            fmt_hits(hits, n=6),
            hint=(
                "Extract explicit variant components instead of chaining is*/has*/show* checks.\n"
                "         See AGENTS.md: patterns-explicit-variants"
            ),
        )
    else:
        record("PASS", "No multi-boolean ternary chains detected")


# ==============================================================================
# SECTION 3 — Accessibility / WCAG 2.2
# ==============================================================================

def check_div_onclick_needs_role() -> None:
    """<div onClick> without role= is not keyboard-accessible (WCAG 2.2 4.1.2)."""
    hits: list[tuple[Path, int, str]] = []
    for p in tsx_files():
        try:
            for i, line in enumerate(
                p.read_text(encoding="utf-8", errors="replace").splitlines(), 1
            ):
                if re.search(r'<div\b[^>]*onClick[^>]*>', line):
                    if not re.search(r'\brole\s*=', line):
                        hits.append((p, i, line.strip()))
        except OSError:
            pass
    if hits:
        record(
            "WARN",
            f"<div onClick> without role= — {len(hits)} location(s) (WCAG 2.2)",
            fmt_hits(hits),
            hint=(
                "Use <button> instead, or add role='button' + tabIndex={0} + onKeyDown.\n"
                "         Prefer: `<button onClick={...}>` over `<div onClick={...}>`"
            ),
        )
    else:
        record("PASS", "No <div onClick> without role= found")


def check_img_alt() -> None:
    """<img> without alt= violates WCAG 2.2 1.1.1 (Non-text Content).

    Handles multiline JSX: scans up to 6 lines after the opening <img tag to
    find the alt attribute (or the closing > / />) before concluding it is absent.
    """
    missing_alt: list[tuple[Path, int, str]] = []
    for p in tsx_files():
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines):
            if not re.search(r'<img\b', line):
                continue
            # Collect lines up to 6 ahead (covers multiline JSX attributes)
            window_end = min(i + 7, len(lines))
            window = "\n".join(lines[i:window_end])
            # Stop at the tag's closing > or />
            tag_match = re.search(r'<img\b(.*?)(?:/>|>)', window, re.DOTALL)
            tag_body = tag_match.group(0) if tag_match else window
            if not re.search(r'\balt\s*=', tag_body):
                missing_alt.append((p, i + 1, lines[i].strip()))
    if missing_alt:
        record(
            "FAIL",
            f"<img> without alt= — {len(missing_alt)} location(s) (WCAG 2.2 1.1.1)",
            fmt_hits(missing_alt),
            hint=(
                'Add alt="" for decorative images or alt="descriptive text" for informative ones.'
            ),
        )
    else:
        record("PASS", "All <img> elements have alt= attribute")


def check_outline_none_has_focus_ring() -> None:
    """outline-none without focus: class removes keyboard indicators (WCAG 2.2 2.4.7).

    Accepts focus:, focus-visible:, and focus-within: as valid alternatives.
    The last case is valid when outline-none is on an inner element whose container
    provides focus-within: styling.
    """
    hits: list[tuple[Path, int, str]] = []
    for p in tsx_files():
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines, 1):
            for m in re.finditer(r'"([^"]*outline-none[^"]*)"', line):
                cls_str = m.group(1)
                has_focus = (
                    "focus:" in cls_str
                    or "focus-visible:" in cls_str
                    or "focus-within:" in cls_str
                )
                if has_focus:
                    break
                # Also check up to 50 lines above for a parent with focus-within:
                # (inner inputs often delegate focus styling to a container many lines up)
                start = max(0, i - 50)
                surrounding = "\n".join(lines[start:i])
                if "focus-within:" in surrounding:
                    break
                hits.append((p, i, line.strip()))
                break
    if hits:
        record(
            "FAIL",
            f"outline-none without focus ring — {len(hits)} location(s) (WCAG 2.2 2.4.7)",
            fmt_hits(hits),
            hint=(
                "Add `focus-visible:ring-2 focus-visible:ring-sage-500` alongside outline-none.\n"
                "         Never suppress focus outline without providing an alternative."
            ),
        )
    else:
        record("PASS", "All outline-none usages accompanied by focus ring classes")


def check_div_span_cursor_pointer() -> None:
    """cursor-pointer + onClick on <div>/<span> — use <button> for accessibility."""
    hits = scan(tsx_files(), r'<(?:div|span)\b[^>]*(cursor-pointer|onClick)')
    refined = [
        (p, i, line) for p, i, line in hits
        if "cursor-pointer" in line and "onClick" in line
        and re.search(r'<(?:div|span)\b', line)
    ]
    if refined:
        record(
            "WARN",
            f"cursor-pointer + onClick on <div>/<span> — {len(refined)} location(s)",
            fmt_hits(refined),
            hint=(
                "Replace <div onClick className='cursor-pointer'> with <button>.\n"
                "         Buttons are natively keyboard-accessible and announce role to screen readers."
            ),
        )
    else:
        record("PASS", "No cursor-pointer + onClick on non-interactive elements")


def check_anchor_as_button() -> None:
    """<a href='#' onClick> or <a onClick without href> — use <button> instead."""
    rx_void_href = re.compile(
        r'<a\b[^>]*onClick[^>]*(?:href\s*=\s*["\']#["\']|href\s*=\s*\{[^}]*void[^}]*\})'
    )
    hits: list[tuple[Path, int, str]] = []
    for p in tsx_files():
        try:
            for i, line in enumerate(
                p.read_text(encoding="utf-8", errors="replace").splitlines(), 1
            ):
                if rx_void_href.search(line):
                    hits.append((p, i, line.strip()))
                elif re.search(r'<a\b[^>]*onClick[^>]*>', line) and "href" not in line:
                    hits.append((p, i, line.strip()))
        except OSError:
            pass
    if hits:
        record(
            "WARN",
            f"<a> used as button (onClick, no real href) — {len(hits)} location(s)",
            fmt_hits(hits),
            hint=(
                "Replace `<a href='#' onClick={...}>` with `<button onClick={...}>`.\n"
                "         Anchors are for navigation; buttons are for actions."
            ),
        )
    else:
        record("PASS", "No <a> elements misused as buttons")


# ==============================================================================
# SECTION 4 — Mobile Readiness
# ==============================================================================

def _dashboard_route_dirs() -> list[Path]:
    dashboard = ROOT / "src" / "app" / "(dashboard)"
    if not dashboard.exists():
        return []
    return [d for d in dashboard.iterdir() if d.is_dir()]


def check_dashboard_loading_tsx() -> None:
    """Dashboard routes should have loading.tsx for streaming suspense."""
    dirs = _dashboard_route_dirs()
    if not dirs:
        record("WARN", "No (dashboard) route dirs found — skipping loading.tsx check")
        return
    missing = [d for d in dirs if not (d / "loading.tsx").exists()]
    if missing:
        rel = [str(d.relative_to(ROOT)) for d in missing]
        record(
            "WARN",
            f"Dashboard route(s) missing loading.tsx — {len(missing)} dir(s)",
            "\n".join(rel),
            hint=(
                "Add `src/app/(dashboard)/<route>/loading.tsx` exporting a skeleton.\n"
                "         Enables Next.js streaming and prevents layout shift on navigation."
            ),
        )
    else:
        record("PASS", "All dashboard routes have loading.tsx")


def check_dashboard_error_tsx() -> None:
    """Dashboard routes should have error.tsx for graceful error boundaries."""
    dirs = _dashboard_route_dirs()
    if not dirs:
        record("WARN", "No (dashboard) route dirs found — skipping error.tsx check")
        return
    missing = [d for d in dirs if not (d / "error.tsx").exists()]
    if missing:
        rel = [str(d.relative_to(ROOT)) for d in missing]
        record(
            "WARN",
            f"Dashboard route(s) missing error.tsx — {len(missing)} dir(s)",
            "\n".join(rel),
            hint=(
                "Add `src/app/(dashboard)/<route>/error.tsx` with 'use client' + reset prop.\n"
                "         Prevents full-page crash when one dashboard section fails."
            ),
        )
    else:
        record("PASS", "All dashboard routes have error.tsx")


def check_responsive_breakpoints() -> None:
    """'use client' page.tsx files should include responsive breakpoint classes."""
    issues: list[Path] = []
    for p in (ROOT / "src" / "app").rglob("page.tsx"):
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if "'use client'" not in content and '"use client"' not in content:
            continue
        if not re.search(r'\b(?:sm|md|lg|xl|2xl):', content):
            issues.append(p)
    if issues:
        paths = [str(p.relative_to(ROOT)) for p in issues]
        record(
            "WARN",
            f"Client page(s) with no responsive breakpoints — {len(issues)} file(s)",
            "\n".join(paths),
            hint=(
                "Add sm:/md:/lg: prefixed Tailwind classes for responsive layouts.\n"
                "         Test at 375px (mobile), 768px (tablet), 1280px (desktop)."
            ),
        )
    else:
        record("PASS", "All client page.tsx files include responsive breakpoint classes")


# ==============================================================================
# SECTION 5 — Design System
# ==============================================================================

def check_no_hardcoded_hex_colors() -> None:
    """Hardcoded hex colors in className strings bypass the design token system."""
    hits: list[tuple[Path, int, str]] = []
    for p in tsx_files():
        try:
            for i, line in enumerate(
                p.read_text(encoding="utf-8", errors="replace").splitlines(), 1
            ):
                if not ("className" in line or "class=" in line or "style" in line):
                    continue
                for m in re.finditer(r'"([^"]*#[0-9a-fA-F]{3,6}[^"]*)"', line):
                    hits.append((p, i, line.strip()))
                    break
        except OSError:
            pass
    if hits:
        record(
            "WARN",
            f"Hardcoded hex color(s) in className — {len(hits)} location(s)",
            fmt_hits(hits),
            hint=(
                "Use design tokens: sage-*, warmgray-*, cream-* or CSS vars (hsl(var(--primary))).\n"
                "         Hardcoded colors break theming and Senior Mode contrast adjustments."
            ),
        )
    else:
        record("PASS", "No hardcoded hex colors in className strings")


def check_no_magic_zindex() -> None:
    """Magic arbitrary z-index values (z-[99] etc.) create stacking context chaos."""
    hits = scan(tsx_files(), r'\bz-\[\d{2,4}\]')
    if hits:
        record(
            "WARN",
            f"Magic arbitrary z-index values — {len(hits)} location(s)",
            fmt_hits(hits),
            hint=(
                "Use Tailwind z-index scale (z-10, z-20, z-30, z-40, z-50) or CSS vars.\n"
                "         Document stacking context in a comment if a custom value is truly needed."
            ),
        )
    else:
        record("PASS", "No magic arbitrary z-index values found")


def check_large_client_components() -> None:
    """'use client' components >400 lines are decomposition candidates."""
    threshold = 400
    large: list[tuple[Path, int]] = []
    components_dir = ROOT / "src" / "components"
    for p in components_dir.rglob("*.tsx"):
        if "node_modules" in p.parts:
            continue
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        if any("'use client'" in l or '"use client"' in l for l in lines[:5]):
            if len(lines) > threshold:
                large.append((p, len(lines)))
    if large:
        detail_lines = [
            f"{p.relative_to(ROOT)}  ({n} lines)"
            for p, n in sorted(large, key=lambda x: -x[1])
        ]
        record(
            "WARN",
            f"Large client components (>{threshold} lines) — {len(large)} file(s)",
            "\n".join(detail_lines),
            hint=(
                "Extract sub-components or move logic to custom hooks.\n"
                "         Large 'use client' files are harder to tree-shake and test."
            ),
        )
    else:
        record("PASS", f"No 'use client' components exceed {threshold} lines")


# ==============================================================================
# MAIN
# ==============================================================================

def main() -> int:
    global _show_hints

    parser = argparse.ArgumentParser(
        description="Agent Rules Audit — React 19, AGENTS.md, WCAG 2.2, mobile readiness"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat WARNs as failures — blocks CI on any warning",
    )
    parser.add_argument(
        "--fix-hints",
        action="store_true",
        help="Print remediation hints alongside each WARN/FAIL result",
    )
    args = parser.parse_args()
    _show_hints = args.fix_hints

    print(f"\n{BOLD}{'=' * 68}{RST}")
    print(f"{BOLD}  Lebensordner Agent Rules Audit{RST}")
    print(f"{DIM}  Project root: {ROOT}{RST}")
    if args.strict:
        print(f"{YLW}{DIM}  Mode: STRICT — WARNs treated as failures{RST}")
    if args.fix_hints:
        print(f"{CYN}{DIM}  Mode: fix-hints enabled{RST}")
    print(f"{BOLD}{'=' * 68}{RST}")

    section("Agent Doc Cross-Reference Guard")
    check_agent_docs_reference_rules()

    section("React 19 & AGENTS.md Rules")
    check_no_forwardref()
    check_no_use_context()
    check_no_boolean_props()

    section("Composition Anti-Patterns")
    check_no_render_props_in_types()
    check_no_multi_boolean_ternaries()

    section("Accessibility / WCAG 2.2")
    check_div_onclick_needs_role()
    check_img_alt()
    check_outline_none_has_focus_ring()
    check_div_span_cursor_pointer()
    check_anchor_as_button()

    section("Mobile Readiness")
    check_dashboard_loading_tsx()
    check_dashboard_error_tsx()
    check_responsive_breakpoints()

    section("Design System")
    check_no_hardcoded_hex_colors()
    check_no_magic_zindex()
    check_large_client_components()

    n_pass = sum(1 for r in results if r.status == "PASS")
    n_warn = sum(1 for r in results if r.status == "WARN")
    n_fail = sum(1 for r in results if r.status == "FAIL")

    print(f"\n{BOLD}{'-' * 68}{RST}")
    print(f"{BOLD}  Results:  {GRN}{n_pass} PASS{RST}  {YLW}{n_warn} WARN{RST}  {RED}{n_fail} FAIL{RST}")
    print(f"{BOLD}{'-' * 68}{RST}\n")

    if n_fail > 0:
        print(f"{RED}{BOLD}  X  UI Audit BLOCKED — fix all FAILs before merging.{RST}\n")
        return 1
    if n_warn > 0 and args.strict:
        print(f"{YLW}{BOLD}  !  UI Audit BLOCKED (--strict) — resolve WARNs before merging.{RST}\n")
        return 1
    if n_warn > 0:
        print(f"{YLW}{BOLD}  !  Warnings present — review before merging.{RST}\n")
        return 0
    print(f"{GRN}{BOLD}  OK  All checks passed.{RST}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
