# Internal AI Workflow

This directory contains the internal-only AI workflow for coding, review, CI, and design-reference use.

## Goals

- Keep internal prompts anchored to `AGENTS.md`, `.claude/rules/*`, and the AI handoff docs.
- Make prompt drift visible in CI.
- Support local `promptfoo` evals without writing outside the repository.
- Avoid any customer-facing AI or access to sensitive vault/document data.

## Layout

- `context/`: source-of-truth manifest and generated context bundle for internal agents.
- `prompts/`: repository-owned assistant prompts for implementation, frontend implementation, review, ops, and design critique.
- `promptfoo/`: eval configs for CI-safe prompt checks and no-cost profile-specific prompt packs.

## Commands

- `npm run ai:context`
  - Rebuilds `ai/context/repo-guardrails.md` from `AGENTS.md`, `.claude/rules/*`, and AI docs.
- `npm run ai:audit`
  - Verifies prompt/workflow structure and that prompt templates reference required context.
- `npm run ai:eval`
  - Runs the full CI-safe `promptfoo` check with the local `echo` provider.
- `npm run ai:eval:live`
  - Alias for the Codex-style general engineering prompt pack.
- `npm run ai:eval:live:codex`
  - Runs the no-cost Codex-style prompt pack for implementation, review, and incident prompts.
- `npm run ai:eval:live:claude-frontend`
  - Runs the no-cost Claude-style frontend prompt pack for frontend implementation and design critique prompts.

## Operating Rules

- Treat `ai/context/repo-guardrails.md` as generated output. Rebuild it after editing `AGENTS.md`, `.claude/rules/*`, `docs/ai-context.md`, or `docs/ai-collaboration.md`.
- Keep prompts internal-only. They must not instruct or assume customer-facing AI features.
- Never add secrets, vault data, decrypted documents, relationship keys, OTPs, or production user payloads to prompt fixtures.
- If an internal AI route or tool is added later, it must still pass the existing logging guardrails and use structured logging only.

## No-Cost Prompt Packs

All prompt packs now use Promptfoo's local `echo` provider, so they do not require any API key, paid model access, or additional SDK installation.

Use them as role-specific guardrail checks:

```powershell
npm run ai:eval:live:codex
npm run ai:eval:live:claude-frontend
```

These are not live model evals. They validate that the prompt packs for your usual workflows still carry the required repository context, `.claude` rules, internal-only scope, and sensitive-data guardrails.
