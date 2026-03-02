# AI Collaboration Protocol

This repository uses multiple AI agents with different strengths:
- `Codex`: backend, infrastructure, CI/CD, reliability, functional engineering.
- `Gemini`: frontend UI/UX implementation and polish.
- `Claude`: planning, architecture, review, and selective implementation.

The goal is consistent handoffs, low duplication, and fewer regressions.

## Source Of Truth Files
- `AGENTS.md`: mandatory behavior rules and coding guardrails for all agents.
- `docs/ai-context.md`: stable project context and architecture snapshot.
- `docs/ops/*.md`: operational runbooks and incident procedures.
- `docs/ai-changelog.md`: rolling memory for major implementation changes.

## Required Workflow For Every AI Session
1. Read `AGENTS.md` and cross-reference `.claude/rules/*` before implementing.
2. Read `docs/ai-context.md` and the latest entries in `docs/ai-changelog.md`.
3. Implement only the requested scope.
4. Run relevant checks before finalizing:
- backend and API changes: `npm run type-check`, `npm run lint`
- CI/CD or deploy changes: `python scripts/ops/pre-deploy-qa.py --no-tsc`
- logging-sensitive API changes: `python scripts/ops/logging-audit.py`
5. Add one entry to `docs/ai-changelog.md` for every major change.

## What Counts As A Major Change
- Auth/session behavior or security flow changes.
- API contract changes (request/response semantics, status handling).
- Deployment or workflow changes (`.github/workflows`, `deploy/*`, smoke checks).
- Observability/alerting/logging behavior changes.
- Data model, migration, or critical business logic changes.

## Changelog Entry Requirements
Each entry in `docs/ai-changelog.md` must include:
- date (UTC)
- agent name (`Codex` / `Gemini` / `Claude`)
- commit hash (or `uncommitted`)
- summary of change
- risk/regression notes
- verification commands run
- rollback notes

Keep entries concise and factual.

## Handoff Rules
- Do not assume another AI has the same context window.
- Do not rely on chat history as source of truth.
- Capture decisions and non-obvious tradeoffs in `docs/ai-changelog.md`.
- If an issue is unresolved, explicitly write `Open Issues` in the changelog entry.

## Anti-Patterns To Avoid
- One giant free-form `memory.md` with mixed architecture, runbooks, and logs.
- Silent behavior changes without changelog entries.
- Treating expected auth outcomes (`401`/`403`) as server errors (`500`).
- Creating issue/alert automation without context-quality checks.
