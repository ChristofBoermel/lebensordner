# AI Repo Adoption Review For Lebensordner

## Summary

- Adopt now: [promptfoo](https://github.com/promptfoo/promptfoo). It is the strongest immediate fit for internal prompt regression testing, agent safety checks, and CI quality gates around coding and ops assistants.
- Use as reference material: [agency-agents](https://github.com/msitarzewski/agency-agents) and [impeccable](https://github.com/pbakaus/impeccable). Both are useful as patterns for internal agent roles, workflows, and design-review prompts, but neither should become a runtime dependency for this repo.
- Defer for now: [OpenViking](https://github.com/volcengine/OpenViking). It only becomes useful if we later want a larger internal agent platform with retrieval, memory, and orchestration across docs and runbooks. It is not needed for the current internal-only use case.

## Implementation Changes

### Phase 1: Add internal AI quality gates with `promptfoo`

- Create a dedicated prompt/eval workspace for internal coding and ops use cases.
- Start with 4 eval tracks:
  - coding assistant prompts for repo-aware implementation guidance
  - code review prompts focused on security, regressions, and logging quality
  - incident/runbook assistant prompts for deploy and monitoring workflows
  - frontend/design critique prompts for onboarding and accessibility reviews
- Evaluate factuality against repository docs, refusal behavior when context is missing, prompt-injection resistance, and leakage of secrets or sensitive user data.
- Wire the evals into CI as a targeted check for prompt/config changes, similar to the existing audit scripts.

### Phase 2: Use `agency-agents` as an internal agent-pattern reference

- Adapt its role-based agent ideas into repository-owned playbooks for:
  - implementation assistant
  - reviewer assistant
  - CI/CD or incident assistant
  - UI/UX critique assistant
- Keep those roles as Markdown guidance and prompt templates in this repo rather than importing the framework wholesale.
- Align those internal roles with the existing AI collaboration model in [docs/ai-collaboration.md](/D:/Projects/Lebensordner/docs/ai-collaboration.md).

### Phase 3: Use `impeccable` as an internal design and quality reference

- Apply it to internal design generation and review workflows, especially for senior-friendly UX, onboarding clarity, and accessibility.
- Use it to improve specs, critique screens, and generate stronger design-review prompts for the team.
- Do not embed it into the product runtime or build process beyond prompt/reference material.

### Phase 4: Revisit `OpenViking` only if internal AI tooling expands significantly

- Valid future use: an internal knowledge agent across runbooks, architecture docs, changelog entries, incident playbooks, and approved codebase metadata.
- Not valid in the current phase: indexing user vault contents, decrypted documents, relationship keys, or private production data.
- Only reconsider it if the internal AI surface grows beyond prompt templates and evals into a dedicated multi-agent platform.

## Internal Interfaces And Guardrails

- Add a new internal prompt/eval area, for example `ai/` or `packages/ai-evals`, containing:
  - prompt definitions
  - test fixtures
  - provider config
  - safety assertions
  - internal agent role templates
- Add CI commands for AI evals alongside the existing audits.
- Restrict all internal AI workflows to approved inputs:
  - repository code
  - repository docs
  - runbooks
  - non-sensitive fixtures
- Enforce defaults:
  - no use of decrypted vault state
  - no export of sensitive production data to external models
  - no autonomous write or deploy actions without explicit operator review
  - no retention of secrets, tokens, or user data in eval fixtures

## Test Plan

- `promptfoo` eval sets for:
  - repo-aware coding guidance quality
  - code review accuracy for security and regression detection
  - refusal when required repository context is absent
  - no leakage of secrets, OTPs, relationship keys, or sensitive sample data
  - prompt-injection resistance when prompts include untrusted text from issues, logs, or docs
- CI validation:
  - prompt changes must pass eval thresholds before merge
  - failing evals should report the weak scenario and prompt under test
- If internal assistant APIs or tooling routes are added later:
  - run `python scripts/ops/logging-audit.py`
  - verify structured logs only, no raw `console.error`, and no sensitive prompt or repo-secret content in logs

## Assumptions

- The scope is internal-only: coding assistance, agent reference patterns, QA/review support, design critique, and ops/runbook assistance.
- There is no current plan to ship a customer-facing AI feature.
- Sensitive profile, medical, document, and vault data must remain outside external LLM context unless a separate security/compliance decision changes that.
- Recommendation basis used:
  - [promptfoo docs](https://www.promptfoo.dev/docs/red-team/) and [CI/code-scanning docs](https://www.promptfoo.dev/docs/code-scanning/)
  - [agency-agents](https://github.com/msitarzewski/agency-agents)
  - [impeccable](https://github.com/pbakaus/impeccable)
  - [OpenViking](https://github.com/volcengine/OpenViking)
