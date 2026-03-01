#!/usr/bin/env python3
"""
Agent Rule Cross-Reference Audit.

Enforces that all AI agent instruction files explicitly reference every rule
file in .claude/rules before feature implementation is allowed.

Usage:
    python scripts/ops/agent-rules-audit.py
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RULES_DIR = ROOT / ".claude" / "rules"
REQUIRED_DOCS = ("AGENTS.md", "CLAUDE.md", "GEMINI.md")


def collect_rule_files() -> list[str]:
    if not RULES_DIR.exists() or not RULES_DIR.is_dir():
        raise FileNotFoundError(f"Missing rules directory: {RULES_DIR}")
    return sorted(path.name for path in RULES_DIR.glob("*.md"))


def read_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def main() -> int:
    errors: list[str] = []

    try:
        rule_files = collect_rule_files()
    except FileNotFoundError as exc:
        print(f"FAIL: {exc}")
        return 1

    if not rule_files:
        print(f"FAIL: No rule files found in {RULES_DIR}")
        return 1

    print("Agent Rule Cross-Reference Audit")
    print(f"Rules discovered ({len(rule_files)}):")
    for name in rule_files:
        print(f"  - {name}")

    for doc_name in REQUIRED_DOCS:
        path = ROOT / doc_name
        if not path.exists():
            errors.append(f"{doc_name}: file is missing")
            continue

        content = read_file(path)
        missing = [name for name in rule_files if name not in content]
        if missing:
            errors.append(
                f"{doc_name}: missing {len(missing)} rule reference(s): {', '.join(missing)}"
            )
        else:
            print(f"PASS: {doc_name} references all rule files")

    if errors:
        print("\nFAIL: Agent rule policy drift detected.")
        for error in errors:
            print(f"  - {error}")
        print("\nAction required: update agent docs to explicitly list every .claude/rules/*.md file.")
        return 1

    print("\nPASS: All agent instruction files cross-reference the full .claude/rules set.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
