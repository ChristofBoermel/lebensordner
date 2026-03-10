# E2E CI/CD Optimization Plan

## Goal
Run browser tests often enough to catch regressions while keeping PR pipelines stable and reasonably fast.

## Recommended Execution Model
- PRs run only the smoke suite.
- Legacy or broader browser coverage runs manually or on a schedule later.
- Chromium-only is the default for PR gating.

## Current Implementation Baseline
- `npm run test:e2e:smoke` runs only `tests/e2e/smoke`.
- CI uploads Playwright artifacts on failure.
- Existing caching for npm, Playwright browsers, and Next.js build output stays in place.

## Next Optimizations To Apply
1. Move smoke E2E off the `Production` environment and onto a dedicated E2E environment.
2. Add a nightly workflow for:
   - legacy GDPR browser tests
   - broader multi-role coverage
   - longer-running public-link flows
3. Keep retries low and fix flakes instead of masking them.
4. Add auth-state setup projects only if the smoke suite becomes login-bound.
5. Add sharding only after runtime data shows the smoke suite is large enough to benefit.

## Performance Expectations
- No meaningful production runtime impact.
- PR CI impact should stay limited to a small browser lane rather than a full-app E2E matrix.
- The main cost is CI time, not frontend runtime performance.

## Guardrails
- Prefer programmatic setup over long UI setup chains.
- One core journey per spec.
- No dependence on long-lived shared E2E users.
- Every escaped production regression should add one targeted browser regression test if lower-level tests would not have caught it.
