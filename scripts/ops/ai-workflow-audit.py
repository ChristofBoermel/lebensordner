#!/usr/bin/env python3
"""
Internal AI workflow audit for Lebensordner.

Checks that internal prompt templates, promptfoo configs, and the generated
context bundle stay aligned with AGENTS.md, .claude/rules, and AI handoff docs.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import NamedTuple

from build_ai_context import CHANGELOG_LINES, OUTPUT, SOURCE_FILES, build_bundle

RED = "\033[91m"
GRN = "\033[92m"
YLW = "\033[93m"
BLU = "\033[94m"
DIM = "\033[2m"
BOLD = "\033[1m"
RST = "\033[0m"

ROOT = Path(__file__).resolve().parents[2]


class Result(NamedTuple):
    status: str
    check: str
    detail: str = ""


results: list[Result] = []


def record(status: str, check: str, detail: str = "") -> None:
    results.append(Result(status, check, detail))
    icons = {
        "PASS": f"{GRN}PASS{RST}",
        "WARN": f"{YLW}WARN{RST}",
        "FAIL": f"{RED}FAIL{RST}",
    }
    print(f"  {icons[status]}  {check}")
    if detail:
        for line in detail.strip().splitlines():
            print(f"         {DIM}{line}{RST}")


def section(title: str) -> None:
    pad = "-" * max(0, 60 - len(title))
    print(f"\n{BOLD}{BLU}-- {title} {pad}{RST}")


def read(rel: str) -> str:
    path = ROOT / rel
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def prompt_files() -> list[Path]:
    prompts_dir = ROOT / "ai" / "prompts"
    return sorted(prompts_dir.glob("*.md")) if prompts_dir.exists() else []


def check_context_bundle_exists() -> None:
    if OUTPUT.exists():
        record("PASS", f"Generated context bundle exists: {OUTPUT.relative_to(ROOT)}")
    else:
        record("FAIL", "Generated context bundle is missing", "Run: python scripts/ops/build_ai_context.py")


def check_context_bundle_current() -> None:
    if not OUTPUT.exists():
        record("FAIL", "Cannot compare generated context bundle because it is missing")
        return

    current = OUTPUT.read_text(encoding="utf-8", errors="replace")
    expected = build_bundle()
    if current == expected:
        record("PASS", "Generated context bundle is up to date")
    else:
        record(
            "FAIL",
            "Generated context bundle is stale",
            f"Rebuild {OUTPUT.relative_to(ROOT)} after changing AGENTS, .claude rules, or AI docs",
        )


def check_manifest_mentions_all_sources() -> None:
    manifest = read("ai/context/manifest.md")
    missing = [rel for rel in SOURCE_FILES if rel not in manifest]
    if "docs/ai-changelog.md" not in manifest:
        missing.append(f"docs/ai-changelog.md latest {CHANGELOG_LINES} lines")
    if missing:
        record("FAIL", "AI context manifest is missing required sources", "\n".join(missing))
    else:
        record("PASS", "AI context manifest lists all required sources")


def check_prompt_templates_reference_required_context() -> None:
    files = prompt_files()
    if not files:
        record("FAIL", "No internal prompt templates found in ai/prompts")
        return

    required_markers = [
        "ai/context/repo-guardrails.md",
        "AGENTS.md",
        "docs/ai-context.md",
        ".claude/rules",
    ]
    failures: list[str] = []
    for path in files:
        content = path.read_text(encoding="utf-8", errors="replace")
        missing = [marker for marker in required_markers if marker not in content]
        if missing:
            failures.append(f"{path.relative_to(ROOT)}: missing {', '.join(missing)}")
    if failures:
        record("FAIL", "Prompt templates are missing required context references", "\n".join(failures))
    else:
        record("PASS", f"All {len(files)} prompt templates reference required context")


def check_internal_only_scope() -> None:
    files = prompt_files()
    failures: list[str] = []
    for path in files:
        content = path.read_text(encoding="utf-8", errors="replace").lower()
        if "customer-facing ai" in content:
            failures.append(str(path.relative_to(ROOT)))
    if failures:
        record("FAIL", "Prompt templates drifted into customer-facing scope", "\n".join(failures))
    else:
        record("PASS", "Prompt templates stay within internal-only scope")


def check_promptfoo_configs() -> None:
    required = [
        "ai/promptfoo/promptfooconfig.ci.yaml",
        "ai/promptfoo/promptfooconfig.live.codex.yaml",
        "ai/promptfoo/promptfooconfig.live.claude-frontend.yaml",
    ]
    missing = [rel for rel in required if not (ROOT / rel).exists()]
    if missing:
        record("FAIL", "Missing promptfoo config file(s)", "\n".join(missing))
        return

    ci_config = read(required[0])
    codex_config = read(required[1])
    claude_frontend_config = read(required[2])
    issues = []
    if "echo" not in ci_config:
        issues.append("CI config must use the echo provider for deterministic checks")
    if "echo" not in codex_config:
        issues.append("Codex-style prompt pack must use the echo provider for no-cost checks")
    if "echo" not in claude_frontend_config:
        issues.append("Claude-style frontend prompt pack must use the echo provider for no-cost checks")
    if issues:
        record("FAIL", "Promptfoo configs are incomplete", "\n".join(issues))
    else:
        record("PASS", "Promptfoo configs are present and have the expected provider shape")


def check_package_scripts() -> None:
    package_json = read("package.json")
    required_scripts = [
        '"ai:context"',
        '"ai:audit"',
        '"ai:eval"',
        '"ai:eval:live"',
        '"ai:eval:live:codex"',
        '"ai:eval:live:claude-frontend"',
    ]
    missing = [script for script in required_scripts if script not in package_json]
    if missing:
        record("FAIL", "package.json is missing internal AI scripts", "\n".join(missing))
    else:
        record("PASS", "package.json exposes internal AI workflow scripts")


def check_ci_job() -> None:
    ci = read(".github/workflows/ci.yml")
    if "ai-workflow-guard" in ci and "npm run ai:eval" in ci:
        record("PASS", "CI workflow includes the AI workflow guard job")
    else:
        record(
            "FAIL",
            "CI workflow is missing the AI workflow guard job",
            "Expected job name: ai-workflow-guard with npm run ai:eval",
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit the internal AI workflow")
    parser.add_argument("--strict", action="store_true", help="Treat WARNs as failures")
    parser.parse_args()

    print(f"\n{BOLD}{'=' * 68}{RST}")
    print(f"{BOLD}  Lebensordner Internal AI Workflow Audit{RST}")
    print(f"{DIM}  Project root: {ROOT}{RST}")
    print(f"{BOLD}{'=' * 68}{RST}")

    section("Context Bundle")
    check_context_bundle_exists()
    check_context_bundle_current()
    check_manifest_mentions_all_sources()

    section("Prompt Templates")
    check_prompt_templates_reference_required_context()
    check_internal_only_scope()

    section("Promptfoo")
    check_promptfoo_configs()
    check_package_scripts()

    section("CI")
    check_ci_job()

    n_pass = sum(1 for result in results if result.status == "PASS")
    n_warn = sum(1 for result in results if result.status == "WARN")
    n_fail = sum(1 for result in results if result.status == "FAIL")

    print(f"\n{BOLD}{'-' * 68}{RST}")
    print(f"{BOLD}  Results:  {GRN}{n_pass} PASS{RST}  {YLW}{n_warn} WARN{RST}  {RED}{n_fail} FAIL{RST}")
    print(f"{BOLD}{'-' * 68}{RST}\n")

    if n_fail > 0:
        print(f"{RED}{BOLD}  X  Internal AI workflow audit BLOCKED.{RST}\n")
        return 1
    print(f"{GRN}{BOLD}  OK  Internal AI workflow audit passed.{RST}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
