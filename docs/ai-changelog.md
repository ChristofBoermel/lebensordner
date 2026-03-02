# AI Changelog

Rolling memory for major AI-driven changes. Newest entry first.

## Entry Template
```
## YYYY-MM-DD HH:MM UTC | Agent: Codex|Gemini|Claude | Commit: <hash|uncommitted>
Change:
- ...

Why:
- ...

Risk / Regression Watch:
- ...

Verification:
- <command>
- <command>

Rollback:
- <short rollback instruction>

Open Issues:
- none
```

---

## 2026-03-02 02:20 UTC | Agent: Codex | Commit: uncommitted
Change:
- Added multi-agent collaboration protocol in `docs/ai-collaboration.md`.
- Introduced structured rolling memory file `docs/ai-changelog.md`.
- Added mandatory AI memory/handoff rule reference in `AGENTS.md`.

Why:
- Multiple AI agents are used regularly; decisions and implementation context need stable, file-based handoff.

Risk / Regression Watch:
- Process-only documentation change. No runtime impact.

Verification:
- Reviewed repository docs structure and existing AI instruction files.

Rollback:
- Remove the two docs files and the AGENTS.md section.

Open Issues:
- none
