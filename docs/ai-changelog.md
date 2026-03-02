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

## 2026-03-02 06:46 UTC | Agent: Codex | Commit: uncommitted
Change:
- Fixed senior-mode dialog close affordance by hardening global `Dialog` close button styling/placement and adding bordered close icon treatment.
- Added bordered X-close treatment in onboarding custom close controls.
- Changed encrypted upload persistence to keep plaintext `title`/`file_name` (while still storing encrypted payload/fields) so the documents list/search no longer degrades to `[Verschlüsselt]`.
- Improved upload-dialog scroll UX with explicit scroll container, persistent gradient cue, and a floating down-arrow quick-scroll button.

Why:
- User reported missing dialog close controls in senior mode, poor X-button affordance consistency, degraded documents search/list UX due placeholder titles, and hard-to-discover scrollable content in upload dialog.

Risk / Regression Watch:
- Keeping plaintext title/file name for encrypted docs improves usability but reduces metadata confidentiality versus prior placeholder-only behavior.
- Upload dialog now includes a floating scroll affordance; verify no overlap with keyboard on small touch devices.

Verification:
- `npm run type-check`
- `npm run lint`
- `npm run test -- --run tests/components/dialog.test.tsx tests/pages/onboarding-category-cards.test.tsx tests/pages/dokumente.test.tsx`

Rollback:
- Revert dialog/onboarding/documents/upload-dialog changes in this patch and remove this changelog entry.

Open Issues:
- none

## 2026-03-02 06:20 UTC | Agent: Codex | Commit: uncommitted
Change:
- Improved dialog UX consistency via shared `DialogContent` defaults (mobile width, safer max-height, built-in scroll, footer spacing).
- Fixed onboarding documents card text wrapping/alignment and standardized onboarding step button alignment/order for mobile + desktop.
- Reworked notfall form dialogs to be responsive and scroll-safe (including medication/BMP edit grid behavior on small screens).
- Fixed profile loading 400 fallback in documents page when `secured_categories` column is unavailable.
- Fixed avatar loading/removal by moving to signed URL resolution (`avatars` bucket) and robust storage-path extraction across old/new stored formats.
- Added automatic inactivity logout after 10 minutes for authenticated dashboard sessions.
- Updated dialog regression test for new max-height class.

Why:
- User reported multiple dialog layout breakages, onboarding card text/button misalignment, profile query/storage image errors, and requested enforced idle logout.

Risk / Regression Watch:
- Shared dialog primitive changes affect all dialogs; spot-check high-traffic flows on small screens.
- Avatar URLs now use signed links; if storage policies change, image rendering/removal should be re-validated.
- Inactivity logout currently applies to dashboard-wrapped routes.

Verification:
- `npm run type-check`
- `npm run test -- --run tests/pages/onboarding-category-cards.test.tsx tests/pages/notfall-consent.test.tsx tests/pages/einstellungen-name-fields.test.tsx tests/components/dialog.test.tsx`
- `python scripts/ops/logging-audit.py`

Rollback:
- Revert `src/components/ui/dialog.tsx`, onboarding/notfall/settings/documents/dashboard-nav/account-delete/avatar helper/inactivity files, and this changelog entry.

Open Issues:
- none
```

---

## 2026-03-02 05:48 UTC | Agent: Codex | Commit: uncommitted
Change:
- Fixed `scripts/ops/verify-deploy.sh` syntax by restoring the full `check_internal_supabase_from_nextjs` heredoc/function block and removing stray Node.js lines that were outside any function.

Why:
- Deploy workflow `smoke-check` failed on server with `syntax error near unexpected token '('` at line 142.

Risk / Regression Watch:
- Internal nextjs->supabase probe logic is now scoped correctly; deployment verification should proceed to runtime checks instead of shell parse failure.

Verification:
- Reviewed fixed function boundaries and heredoc closure around lines 73-174.
- `gh run view 22563086668 --job 65353776719 --log-failed` (confirmed prior failure signature).

Rollback:
- Revert `scripts/ops/verify-deploy.sh` and this changelog entry.

Open Issues:
- pending re-run of Deploy workflow to confirm smoke-check passes end-to-end.

## 2026-03-02 05:39 UTC | Agent: Codex | Commit: uncommitted
Change:
- Stabilized `tests/pages/dokumente.test.tsx` against current UI behavior:
- Updated mobile upload-dialog class expectation to `max-h-[95dvh]`.
- Fixed free-tier manipulated watcher test to assert null watcher payload.
- Reworked brittle search, custom-category, and bulk-action assertions to use current tab behavior and robust selectors.
- Confirmed `erinnerungen` and new `vault-context` tests pass in combination with the dokumente suite.

Why:
- User requested pre-commit readiness with tests; targeted suite still failed due stale test assumptions after UI refactors.

Risk / Regression Watch:
- Assertions now reflect current UI contracts, reducing false negatives from fragile DOM coupling.
- Remaining stderr warnings in passing tests are accessibility warnings from mocked dialog usage, not test failures.

Verification:
- `npm test -- --run tests/pages/dokumente.test.tsx`
- `npm test -- --run tests/pages/dokumente.test.tsx tests/pages/erinnerungen.test.tsx tests/pages/einstellungen-tier.test.tsx tests/pages/einstellungen-name-fields.test.tsx tests/pages/notfall-consent.test.tsx tests/pages/onboarding-category-cards.test.tsx tests/components/dialog.test.tsx tests/components/vault-unlock-modal.test.tsx tests/lib/vault-context.test.tsx`

Rollback:
- Revert `tests/pages/dokumente.test.tsx` and this changelog entry.

Open Issues:
- none

## 2026-03-02 05:33 UTC | Agent: Codex | Commit: uncommitted
Change:
- Updated `tests/pages/erinnerungen.test.tsx` to match current watcher-gate UI semantics (watcher-specific option assertions, robust upgrade-hint assertions).
- Added `tests/lib/vault-context.test.tsx` to cover session-cached vault passphrase behavior: auto-unlock success, auto-unlock failure cache cleanup, and lock-triggered cache removal.

Why:
- Align failing reminders tests with current UI copy/structure and add explicit regression coverage for newly introduced vault session-caching behavior.

Risk / Regression Watch:
- Focused suite is now green for reminders and vault context; `tests/pages/dokumente.test.tsx` still has pre-existing selector/expectation failures and keeps the full targeted pre-commit suite red.

Verification:
- `npm test -- --run tests/pages/erinnerungen.test.tsx tests/lib/vault-context.test.tsx`
- `npm test -- --run tests/pages/dokumente.test.tsx tests/pages/erinnerungen.test.tsx tests/pages/einstellungen-tier.test.tsx tests/pages/einstellungen-name-fields.test.tsx tests/pages/notfall-consent.test.tsx tests/pages/onboarding-category-cards.test.tsx tests/components/dialog.test.tsx tests/components/vault-unlock-modal.test.tsx tests/lib/vault-context.test.tsx`

Rollback:
- Revert `tests/pages/erinnerungen.test.tsx`, remove `tests/lib/vault-context.test.tsx`, and remove this changelog entry.

Open Issues:
- `tests/pages/dokumente.test.tsx` (10 failing tests) requires follow-up to update selectors/expectations against current dokumente UI.

## 2026-03-02 05:14 UTC | Agent: Codex | Commit: uncommitted
Change:
- Added standalone prototype SPA file `refactored-redesigned-spa.html` demonstrating responsive layout cleanup, category/document manual lock UX, session-cached vault unlock behavior, and search term highlighting over decrypted titles.

Why:
- User requested a redesigned `.html` SPA artifact to validate UX direction before or alongside framework integration.

Risk / Regression Watch:
- Standalone prototype file only; no runtime behavior changes in production Next.js routes.

Verification:
- Open `refactored-redesigned-spa.html` in browser and validate mobile/desktop behavior.

Rollback:
- Delete `refactored-redesigned-spa.html` and this changelog entry.

Open Issues:
- none

## 2026-03-02 05:05 UTC | Agent: Codex | Commit: uncommitted
Change:
- Reviewed and repaired uncommitted UI changes across dashboard pages/components.
- Fixed malformed JSX and duplicated/hallucinated blocks in onboarding and document upload flows.
- Removed duplicate imports and missing symbol issues in documents/reminders pages.
- Fixed mobile nav overlay accessibility warning (`div onClick` -> button) from `ui-audit`.

Why:
- Restore build stability, remove accidental duplicated fragments, and reduce merge risk before commit.

Risk / Regression Watch:
- Remaining `ui-audit` warnings are repository-wide baseline (React19 migration and route scaffolding), not introduced by this patch.
- Documents overview introduced larger category cards; verify mobile behavior manually if this UI is high traffic.

Verification:
- `npm run type-check`
- `npm run lint`
- `npm run ui-audit`

Rollback:
- Revert touched files in this working tree and restore prior uncommitted state.

Open Issues:
- none

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

## 2026-03-02 07:32 UTC | Agent: Codex | Commit: uncommitted
Change:
- Completed documents/security flow hardening in `src/app/(dashboard)/dokumente/page.tsx`:
- Removed duplicate legacy category overview sections and kept the new card system only.
- Added category-level extra-security controls in standard/custom category detail headers with senior-mode text CTA and normal icon CTA.
- Added per-category privacy mode toggle (`docs_privacy_mode`) for masked titles when locked.
- Added custom-category icon picker/search in category dialog and Enter-to-save form submission.
- Unified free-tier gating for custom category creation via `openCategoryDialog`.
- Added custom category icon rendering in tabs/detail/empty states and retained add-action card behavior.
- Added migration/type support for document-level `extra_security_enabled`.
- Added unload/session hardening and idle-logout warning UX (`src/lib/vault/VaultContext.tsx`, `src/components/auth/inactivity-logout.tsx`).
- Added safe optional theme hook for isolated renders/tests (`useThemeSafe`) and switched documents page to use it.

Why:
- User requested full implementation of the agreed documents/security plan, including senior/mobile-safe UI behavior and stronger unlock/security ergonomics.

Risk / Regression Watch:
- Documents page now contains additional security controls and icon-search UI; verify interaction density on very small mobile screens.
- Idle warning banner introduces a fixed overlay; verify it does not conflict with other fixed dialogs on dashboard pages.

Verification:
- `npm run type-check`
- `npm run lint`
- `npm test -- --run tests/pages/dokumente.test.tsx tests/components/vault-unlock-modal.test.tsx tests/lib/vault-context.test.tsx`

Rollback:
- Revert `src/app/(dashboard)/dokumente/page.tsx`, `src/components/theme/theme-provider.tsx`, `src/components/auth/inactivity-logout.tsx`, `src/lib/vault/VaultContext.tsx`, `src/types/database.ts`, and `supabase/migrations/20260302000100_documents_extra_security.sql`.

Open Issues:
- none
