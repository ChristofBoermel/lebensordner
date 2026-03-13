<proposed_plan>
# Internal AI Development Workflow Going Forward

## Summary
- You now have an internal-only AI workflow in the repo that does three things:
  - keeps a shared AI context bundle generated from `AGENTS.md`, `.claude/rules/*`, and the AI docs
  - checks internal prompt packs with `promptfoo` using free deterministic `echo` runs
  - blocks CI if the AI workflow drifts away from repo guardrails
- The system is not running autonomous coding or deploys on its own.
- The current setup is a guardrail and prompt-pack workflow for internal engineering use, not an autonomous agent platform.

## What Is New
- New internal AI workspace under `ai/`
  - prompt packs for general engineering, frontend engineering, review, incident/CI, and design critique
  - generated guardrail bundle at `ai/context/repo-guardrails.md`
  - promptfoo configs for:
    - full repo-wide AI guard checks
    - Codex-style engineering pack
    - Claude-style frontend pack
- New scripts in `package.json`
  - `npm run ai:context`
  - `npm run ai:audit`
  - `npm run ai:eval`
  - `npm run ai:eval:live:codex`
  - `npm run ai:eval:live:claude-frontend`
- New CI guard
  - `.github/workflows/ci.yml` now runs the AI workflow guard before the main jobs

## How You Should Work Now
- For normal development, keep doing implementation the same way, but add the AI workflow when you change prompts, AI docs, or internal agent usage.
- Recommended ongoing process:
  1. Change code or docs as usual.
  2. If you touch `AGENTS.md`, `.claude/rules/*`, `docs/ai-context.md`, `docs/ai-collaboration.md`, `docs/ai-changelog.md`, or anything under `ai/`, run `npm run ai:context`.
  3. Run `npm run ai:audit`.
  4. Run `npm run ai:eval`.
  5. Then run the normal checks for the kind of change you made:
     - frontend/backend code: `npm run lint` and `npm run type-check`
     - backend/logging-sensitive work: `python scripts/ops/logging-audit.py`
- Use the role-specific packs as internal checklists:
  - `npm run ai:eval:live:codex` for implementation, review, ops prompts
  - `npm run ai:eval:live:claude-frontend` for frontend and design prompts
- Despite the `live` name, those two are currently free prompt-pack checks, not paid model runs.

## Are Things Running On Their Own
- No autonomous implementation is happening in the repo by itself.
- What runs automatically:
  - CI runs the AI workflow guard on push/PR
  - that guard rebuilds/verifies context and runs prompt checks
- What does not run automatically:
  - code changes
  - agent decisions
  - fixes
  - deploys
  - live model calls
- So the model is still operator-driven. You or the active coding agent decide what to change.

## Development Plan Moving Forward
- Keep the current setup as phase 1:
  - free guardrails
  - prompt packs
  - CI enforcement
  - no API spend
- Use it as a discipline layer for internal AI-assisted development:
  - Codex-style for backend/general engineering
  - Claude-style for frontend/design
- Near-term improvements I’d recommend:
  - rename `ai:eval:live:*` to something clearer like `ai:eval:pack:*`
  - add a small contributor doc section in the main README explaining when to run the AI commands
  - optionally add a pre-commit or local QA wrapper that runs `ai:context`, `ai:audit`, and `ai:eval` together
- Only consider a later phase if you actually need it:
  - local-model prompt evals
  - deeper repo-aware code-review prompts
  - issue/PR templates that reference the AI packs
  - eventually a true agent runtime, but only if there is a real workflow gap

## Assumptions
- The intended use remains internal-only.
- You want no paid API dependency for now.
- AI should assist development, not act autonomously without review.
</proposed_plan>
