#!/usr/bin/env python3
"""
Hook-discipline regression guard.

Fails only when manual-hook usage grows above baseline, so teams can
incrementally refactor without breaking CI today.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "src"


PATTERNS: dict[str, re.Pattern[str]] = {
    "useMemo(": re.compile(r"\buseMemo(?:<[^>]+>)?\("),
    "useCallback(": re.compile(r"\buseCallback(?:<[^>]+>)?\("),
    "useEffect(": re.compile(r"\buseEffect(?:<[^>]+>)?\("),
    "useRef(": re.compile(r"\buseRef(?:<[^>]+>)?\("),
    "React.memo(": re.compile(r"React\.memo\("),
    "React.useMemo(": re.compile(r"React\.useMemo\("),
    "React.useCallback(": re.compile(r"React\.useCallback\("),
    "React.useEffect(": re.compile(r"React\.useEffect\("),
    "React.useRef(": re.compile(r"React\.useRef\("),
}


# Baseline captured on 2026-03-03 after React Compiler rollout.
BASELINE_COUNTS: dict[str, int] = {
    "useMemo(": 11,
    "useCallback(": 58,
    "useEffect(": 101,
    "useRef(": 23,
    "React.memo(": 0,
    "React.useMemo(": 0,
    "React.useCallback(": 0,
    "React.useEffect(": 1,
    "React.useRef(": 0,
}


def count_pattern(pattern: re.Pattern[str], text: str) -> int:
    return len(pattern.findall(text))


def main() -> int:
    if not SRC_DIR.exists():
        print("FAIL: src/ directory not found.")
        return 1

    totals = {key: 0 for key in PATTERNS}
    for path in SRC_DIR.rglob("*"):
        if not path.is_file() or path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for key, pattern in PATTERNS.items():
            totals[key] += count_pattern(pattern, content)

    regressions: list[str] = []
    print("Hook Discipline Audit (regression guard)")
    print("Counts (current / baseline):")
    for key in PATTERNS:
        current = totals[key]
        baseline = BASELINE_COUNTS[key]
        print(f"- {key}: {current} / {baseline}")
        if current > baseline:
            regressions.append(f"{key} grew from {baseline} to {current}")

    if regressions:
        print("\nFAIL: Hook usage regression detected.")
        for item in regressions:
            print(f"- {item}")
        print(
            "\nRefactor policy: case-by-case benchmarked cleanup (see GitHub issue #26)."
        )
        return 1

    print("\nPASS: Hook usage did not grow beyond baseline.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
