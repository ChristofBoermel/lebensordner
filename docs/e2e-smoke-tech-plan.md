# E2E Smoke Implementation Plan

## Goal
Add a small browser-based smoke suite that catches security-sensitive and core-product regressions without turning the whole test strategy into a slow full-UI net.

## Scope
- Trusted-person invite pending UX
- Trusted-person shared-document visibility gating
- Core document upload
- Upload into a subcategory
- Core document lock/unlock flow

## Environment Strategy
- Use a dedicated E2E Supabase/staging project.
- Do not rely on manually maintained shared user accounts.
- Create deterministic users per run with service-role helpers.
- Seed tier state directly in `profiles` instead of driving Stripe checkout.
- Seed vault key material programmatically so upload and lock flows can run against the real UI.

## Implementation Steps
1. Build an E2E harness for:
   - run-scoped user creation
   - profile/tier seeding
   - privacy consent seeding
   - vault key seeding
   - trusted-person relationship seeding
   - document/share-token seeding
   - best-effort cleanup
2. Reuse magic-link auth bootstrapping so tests authenticate without depending on the login UI.
3. Add stable `data-testid` hooks only where the current DOM would otherwise make browser tests brittle.
4. Implement smoke specs under `tests/e2e/smoke`.
5. Keep the legacy GDPR browser spec separate from the new smoke lane.
6. Gate PR CI on the smoke suite only.

## Data Rules
- Owner and trusted-person users are created per run.
- Owner tier is seeded directly:
  - `basic` for invite/view/upload coverage
  - `premium` for shared-download visibility coverage
- Seed only the minimum DB state required by each test.
- Cleanup deletes seeded DB rows, best-effort storage objects, and auth users.

## Acceptance Criteria
- Clicking `Einladen` disables the button immediately and prevents duplicate invite requests.
- A connected trusted person with zero explicit shares sees no bulk download CTA.
- A connected trusted person with one explicit share sees exactly that document.
- Upload succeeds through the real browser file input.
- Upload into a subcategory renders the document with the subcategory context in the UI.
- Lock and unlock can be performed through the real app UI.
