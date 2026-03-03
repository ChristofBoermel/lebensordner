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

## 2026-03-03 14:23 UTC | Agent: Codex | Commit: uncommitted
Change:
- Added `scripts/ops/hook-discipline-audit.py` as a baseline regression guard for React Compiler hook discipline.
- Added npm script `audit:hook-discipline` in `package.json`.
- Added new CI job `hook-discipline-guard` to `.github/workflows/ci.yml` and wired it as a prerequisite for lint/type-check/unit/e2e jobs.

Why:
- User requested a CI/CD improvement before committing: enforce no hook-discipline regression while web app refactors remain incremental.

Risk / Regression Watch:
- Guard intentionally blocks only growth above baseline; it does not enforce immediate reduction.
- Baseline values are snapshot-based and may need explicit updates after future cleanup milestones.

Verification:
- `python scripts/ops/hook-discipline-audit.py`
- `npm run type-check`
- `npm run lint`

Rollback:
- Revert `.github/workflows/ci.yml`, `package.json`, remove `scripts/ops/hook-discipline-audit.py`, and remove this changelog entry.

Open Issues:
- none

## 2026-03-03 14:04 UTC | Agent: Codex | Commit: uncommitted
Change:
- Applied global React Compiler hook-discipline refactor on current uncommitted web changes.
- Easy wins: removed unnecessary `useMemo` usage from `src/components/dokumente/ExpiryDashboardWidget.tsx`, `src/components/settings/document-audit-log.tsx`, `src/lib/dokumente/useCategoryLockState.ts`, and `src/app/(dashboard)/dokumente/UploadDialog.tsx`.
- Replaced `useMemo(() => createClient(), [])` with stable `useState(() => createClient())` in `src/lib/vault/VaultContext.tsx` and `src/components/vault/VaultIdleLock.tsx`.
- High-review pass: removed non-essential `useCallback` usage for new logic in `src/app/(dashboard)/dokumente/page.tsx` (`handleEncryptedNoteSaveSuccess`, recent-unlock boolean helper, category lock helper usage in highlight effect) and in `src/lib/vault/VaultContext.tsx` (`refreshBiometricStatus`, biometric support detection helper, `setupBiometric`, `unlockWithBiometric`).
- Adjusted highlight-lock effect dependencies in `src/app/(dashboard)/dokumente/page.tsx` to satisfy exhaustive-deps without reintroducing callback memoization.

Why:
- User requested cross-referenced cleanup against the new global React Compiler rule and temp rollout plan: do easy wins first, test, then high-review items.

Risk / Regression Watch:
- Hook identity changes in vault/documents flows could affect subtle render/effect timing; monitor unlock/deferred-action paths and biometric setup/unlock UX.
- Stable Supabase client instances now rely on state initializer pattern instead of memoization.

Verification:
- `npm run type-check`
- `npm run lint`

Rollback:
- Revert the touched files listed above and remove this changelog entry.

Open Issues:
- none

## 2026-03-03 13:55 UTC | Agent: Codex | Commit: uncommitted
Change:
- Renamed `.claude/rules/react-compiler-expo-default-no-manual-memoization-effects.md` to `.claude/rules/react-compiler-global-default-hook-discipline.md`.
- Updated rule content/title/scope from Expo-specific to global repository usage wherever React Compiler is enabled.
- Updated `AGENTS.md` mandatory rule list to reference `react-compiler-global-default-hook-discipline.md`.
- Renamed `docs/temp-expo-react-compiler-plan.md` to `docs/temp-react-compiler-hook-discipline-plan.md` and refocused the plan on global policy with web-first rollout.

Why:
- User requested changing the new hook-discipline policy from Expo-only to global, with Expo planned later after web app completion.

Risk / Regression Watch:
- Policy/docs-only change; no runtime behavior changes.
- Existing internal references or habits using old Expo-specific filenames should be updated to the new global names.

Verification:
- `git diff -- AGENTS.md .claude/rules/react-compiler-global-default-hook-discipline.md docs/temp-react-compiler-hook-discipline-plan.md docs/ai-changelog.md`

Rollback:
- Rename the two files back to their prior names, restore prior Expo-only wording in the rule and temp plan, and revert `AGENTS.md` + this changelog entry.

Open Issues:
- none

## 2026-03-03 13:47 UTC | Agent: Codex | Commit: uncommitted
Change:
- Added new Expo-specific React Compiler rule file at `.claude/rules/react-compiler-expo-default-no-manual-memoization-effects.md`.
- Updated `AGENTS.md` mandatory rule list to include `react-compiler-expo-default-no-manual-memoization-effects.md`.
- Added implementation handoff doc `docs/temp-expo-react-compiler-plan.md` with warn-first lint rollout and exception protocol.

Why:
- User requested codified guidance for Expo SDK 54+ React Compiler usage to default away from `useMemo`, `useCallback`, `React.memo`, `useEffect`, and `useRef`, plus a temporary plan document for Expo skill enablement.

Risk / Regression Watch:
- Policy/docs-only change; no runtime behavior changes.
- New rule is explicitly scoped to Expo/RN to avoid accidental over-application to web/server code.

Verification:
- `git diff -- AGENTS.md .claude/rules/react-compiler-expo-default-no-manual-memoization-effects.md docs/temp-expo-react-compiler-plan.md docs/ai-changelog.md`

Rollback:
- Revert `AGENTS.md`, remove `.claude/rules/react-compiler-expo-default-no-manual-memoization-effects.md`, remove `docs/temp-expo-react-compiler-plan.md`, and remove this changelog entry.

Open Issues:
- none

## 2026-03-03 13:31 UTC | Agent: Codex | Commit: uncommitted
Change:
- Refactored locked upload submit flow in `src/app/(dashboard)/dokumente/UploadDialog.tsx` to avoid unlock/upload race conditions.
- Added root-level `pendingSubmitAfterUnlock` state and a `useEffect` that triggers `handleUpload` only when `vaultState === "unlocked"`.
- Updated both passphrase and biometric unlock actions to set pending submit after successful unlock instead of calling upload immediately.
- Cleared pending submit state on cancel and after upload completion/failure.

Why:
- Prevent false "Tresor nicht entsperrt" upload failures caused by asynchronous vault context propagation after successful unlock.

Risk / Regression Watch:
- `Entsperren & Hochladen` now relies on post-unlock effect timing; verify locked-vault upload UX manually for both passphrase and biometric flows.

Verification:
- `npm run type-check`
- `npm test -- --run tests/pages/dokumente.test.tsx` (fails with pre-existing baseline failures in this suite)

Rollback:
- Revert `src/app/(dashboard)/dokumente/UploadDialog.tsx` and remove this changelog entry.

## 2026-03-03 13:23 UTC | Agent: Codex | Commit: uncommitted
Change:
- Fix 1: replaced plaintext `else` branch in `handleUpload` with a `throw new Error(...)` enforcing zero-plaintext guarantee; added `Tresor nicht entsperrt` branch to the upload `catch` block to surface vault-locked error directly.
- Fix 2: extended `VaultUnlockContextValue` with `hasBiometricSetup`, `isBiometricSupported`, `unlockWithBiometric`, `onClose`; added `Fingerprint` import; wired biometric button into `VaultUnlockPassphrase` with local loading/error state and `onClose` on success.
- Fix 3: confirmed `UploadDialog.tsx` scroll container already has the correct classes; no code change made.

Risk / Regression Watch:
- Fix 1 changes behavior for any code path where vault is not unlocked — previously silent plaintext upload, now hard error. `SubmitLocked`/`SubmitNotSetup` UI gates should prevent this in practice.
- Fix 2 adds new biometric button that only renders when both flags are true; existing passphrase/recovery flows are unaffected.

Verification:
- `npm run type-check`
- `npm run lint`
- `python scripts/ops/logging-audit.py`
- `npm test -- --testPathPattern=vault-unlock-modal`

Rollback:
- Revert changes to `page.tsx` (restore original `else` branch and two-branch catch), revert `VaultUnlockModal.tsx` to remove the four new context fields and biometric button; no DB migrations involved.

Open Issues:
- none

## 2026-03-03 13:17 UTC | Agent: Codex | Commit: uncommitted
Change:
- Enabled Next.js React Compiler via `reactCompiler: true` in `next.config.js`.
- Installed `babel-plugin-react-compiler` as a dev dependency in `package.json` and `package-lock.json` so Next can resolve the compiler during build.

Why:
- User requested React Compiler implementation in this codebase, and Next 16 requires both config enablement and the compiler package to be present.

Risk / Regression Watch:
- React Compiler may change memoization behavior in client components; monitor for subtle UI behavior differences in highly stateful views.
- Build/runtime now depends on `babel-plugin-react-compiler` being present in lockfile-consistent installs.

Verification:
- `npm run build`

Rollback:
- Remove `reactCompiler` from `next.config.js` and uninstall `babel-plugin-react-compiler`; restore lockfile.

Open Issues:
- none

## 2026-03-03 13:06 UTC | Agent: Codex | Commit: uncommitted
Change:
- Updated `src/app/api/documents/audit/route.ts` to accept optional `event_data`, merge it with flat mapped fields (`document_id`, `document_title`, `category_key`), and emit success/failure route logs based on actual persistence result.
- Refactored `src/lib/security/audit-log.ts` so `logSecurityEvent()` returns explicit `{ ok: true | false }` result, handles Supabase insert errors deterministically, and uses structured error logs instead of raw console logging.
- Adjusted biometric unlock audit payload in `src/lib/vault/VaultContext.tsx` to explicitly send only a truncated credential identifier under `event_data.credential_id_truncated`.
- Moved `EVENT_DOCUMENT_VIEWED` / `EVENT_DOCUMENT_DOWNLOADED` emits in `src/app/(dashboard)/dokumente/page.tsx` to run only after successful open/download completion.
- Updated `src/components/settings/document-audit-log.tsx` table to separate `Kategorie` and `Dokumenttitel` columns, sourcing title from `event_data.document_title`.

Why:
- Fix verification findings where biometric metadata was dropped, access events were logged before successful access, and route success logs were emitted even when persistence failed.

Risk / Regression Watch:
- Some existing callers of `logSecurityEvent()` still ignore its return value; they retain non-blocking behavior but may not add caller-specific failure handling.
- Unencrypted download auditing now depends on successful signed URL retrieval and `window.open()` returning a window handle.

Verification:
- `npm run type-check`
- `npm run lint`
- `python scripts/ops/logging-audit.py`

Rollback:
- Revert `src/lib/security/audit-log.ts`, `src/app/api/documents/audit/route.ts`, `src/lib/vault/VaultContext.tsx`, `src/app/(dashboard)/dokumente/page.tsx`, `src/components/settings/document-audit-log.tsx`, and this changelog entry.

Open Issues:
- none

## 2026-03-03 03:00 UTC | Agent: Claude | Commit: uncommitted
Change:
- Added six document/category audit event constants in `src/lib/security/audit-log.ts`.
- Updated `src/app/api/documents/audit/route.ts` to accept seven allowed event types, validate via allowlist set, accept flat request fields (`document_id`, `document_title`, `category_key`), build `event_data` from flat fields, emit structured info for success, and swallow audit persistence failures while still returning `{ ok: true }`.
- Added new fire-and-forget audit emitter module `src/lib/security/useDocumentAuditLog.ts`.
- Wired document/category audit emits into `src/app/(dashboard)/dokumente/page.tsx` for view, download, document lock/unlock, and category lock/unlock actions.
- Added per-document "Zugriffsprotokoll" action in the document dropdown and implemented a per-document audit dialog with Supabase query, loading/empty states, icon mapping, and relative time formatting.
- Extended `src/components/settings/security-activity-log.tsx` event labels with biometric unlock and document/category event labels.
- Added new `src/components/settings/document-audit-log.tsx` settings card with Supabase-backed loading, client-side filter chips, and event table for document/category audit history.
- Integrated `<DocumentAuditLog />` into `src/app/(dashboard)/einstellungen/page.tsx`.

Why:
- Implement document/category access auditing end-to-end in both document actions and settings visibility while keeping audit write failures non-blocking for user workflows.

Risk / Regression Watch:
- Audit write failures in `/api/documents/audit` are swallowed by design and will no longer surface as user-facing API failures.
- `/api/documents/audit` now accepts seven event types and rejects others with 400 via allowlist validation.
- `security-activity-log.tsx` event label map now includes additional audit event types; unknown events still fall back to raw key.
- `DocumentAuditLog` fetches Supabase audit data directly client-side and depends on user auth session availability.

Verification:
- `npm run type-check`
- `npm run lint`
- `python scripts/ops/logging-audit.py`

Rollback:
- Revert `src/lib/security/audit-log.ts`, `src/app/api/documents/audit/route.ts`, `src/app/(dashboard)/dokumente/page.tsx`, `src/components/settings/security-activity-log.tsx`, `src/app/(dashboard)/einstellungen/page.tsx`, and `docs/ai-changelog.md`; delete `src/lib/security/useDocumentAuditLog.ts` and `src/components/settings/document-audit-log.tsx`.

Open Issues:
- none

## 2026-03-03 02:30 UTC | Agent: Codex | Commit: uncommitted
Change:
- Hardened deferred bulk `Sperren`/`Entsperren` flow in `src/app/(dashboard)/dokumente/page.tsx` by snapshotting selected document IDs at action start and applying deferred updates only to that snapshot.
- Added deferred-state lifecycle handling: clear pending bulk action + snapshot when selection is explicitly cleared, and clear pending deferred action when unlock is dismissed/canceled before completion.
- Ensured deferred execution requires both pending action and snapshot IDs, clears both states before applying updates, and then performs updates with snapshot-bound IDs.
- Extended `tests/pages/dokumente.test.tsx` bulk-action suite with coverage for `Sperren`/`Entsperren` visibility, vault-locked gating, mixed locked/unlocked selections, deferred execution after unlock, and count-toast assertions.
- Exposed `isUnlockRequested` on vault context (`src/lib/vault/VaultContext.tsx`) so page logic can differentiate active unlock modal vs dismissed unlock.

Why:
- Prevent stale deferred bulk security actions from executing later on unintended selections and add regression protection for vault-gated batch lock/unlock behavior.

Risk / Regression Watch:
- `VaultContext` now exposes `isUnlockRequested`; downstream consumers/mocks that hardcode context shape may require this field.
- `tests/pages/dokumente.test.tsx` has pre-existing broad instability and environment-specific Vitest spawn limitations; new assertions were added but full suite remains noisy.

Verification:
- `npm run type-check`
- `npm test -- --run tests/pages/dokumente.test.tsx` (fails in this environment due existing suite instability and `TooltipProvider`/spawn-related issues outside this patch scope)

Rollback:
- Revert `src/app/(dashboard)/dokumente/page.tsx`, `src/lib/vault/VaultContext.tsx`, `tests/pages/dokumente.test.tsx`, and remove this changelog entry.

Open Issues:
- `tests/pages/dokumente.test.tsx` currently contains multiple unrelated failing expectations in this environment.

## 2026-03-03 02:25 UTC | Agent: Codex | Commit: uncommitted
Change:
- Updated `src/components/dokumente/EncryptedNotesEditor.tsx` save flow to persist `notes_encrypted` and clear legacy plaintext `notes` in the same Supabase update.
- Added save-success callback wiring from `EncryptedNotesEditor.Unlocked` into `src/app/(dashboard)/dokumente/page.tsx`.
- Patched local `documents` and `notesEditorDoc` state on note-save success so reopening the editor uses freshly saved encrypted data.

Why:
- Address verification findings for inline legacy migration completeness (no plaintext left persisted) and stale note content after save/reopen.

Risk / Regression Watch:
- Notes save path now always nulls `notes`; verify no legacy UI path still expects plaintext notes after encrypted save.
- Local state patching is id-scoped and should be safe, but confirm no other optimistic updates overwrite the note fields shortly after save.

Verification:
- `npm run type-check`

Rollback:
- Revert `src/components/dokumente/EncryptedNotesEditor.tsx` and `src/app/(dashboard)/dokumente/page.tsx`, and remove this changelog entry.

Open Issues:
- none

## 2026-03-03 00:33 UTC | Agent: Codex | Commit: uncommitted
Change:
- Implemented T7 foundations in `src/app/(dashboard)/dokumente/page.tsx` and new `src/components/dokumente/ExpiryDashboardWidget.tsx`.
- Added overview expiry widget (90-day window) with urgency grouping (`Diese Woche`, `Diesen Monat`, `Bald`) and per-row `Öffnen` action wired to existing `navigateToDocument()`.
- Added bulk action bar actions `Sperren` / `Entsperren` with vault recent-unlock gating and individual Supabase `update()` calls over selected documents.
- Added focused widget tests in `tests/components/dokumente/ExpiryDashboardWidget.test.tsx`.

Why:
- Ticket `T7 – Expiry Dashboard Widget + Bulk Lock/Unlock` requires expiry-at-a-glance UX plus bulk security toggles that respect vault unlock state.

Risk / Regression Watch:
- Bulk lock/unlock currently keeps selection active after action; verify this matches expected UX.
- Category label in expiry widget uses document category mapping (custom-category names are not shown in the widget row metadata).
- Focused Vitest run could not execute in this environment due process spawn restrictions.

Verification:
- `npm run type-check`
- `npm run lint`
- `npm test -- --run tests/components/dokumente/ExpiryDashboardWidget.test.tsx` (fails in sandbox with `spawn EPERM`)

Rollback:
- Revert `src/app/(dashboard)/dokumente/page.tsx`, remove `src/components/dokumente/ExpiryDashboardWidget.tsx`, remove `tests/components/dokumente/ExpiryDashboardWidget.test.tsx`, and remove this changelog entry.

## 2026-03-03 00:20 UTC | Agent: Codex | Commit: uncommitted
Change:
- Hardened vault idle-lock timeout loading in `src/components/vault/VaultIdleLock.tsx` to always fall back to `15` on missing user/auth error/profile error/exception and keep timeout state non-null.
- Added latest-state guard via `isUnlockedRef` in idle timer callback so lock/banner only run when vault is currently unlocked.
- Updated `handleVaultIdleTimeoutChange` in `src/app/(dashboard)/einstellungen/page.tsx` to validate Supabase update result, only show success on no error, rollback optimistic UI value on failure, and show inline error feedback.
- Added the same controlled idle-timeout selector (with shared saving/success/error feedback) to senior-mode `Sicherheit` section.

Risk / Regression Watch:
- Timeout selector now rolls back on save failure; verify expected UX when auth session expires during settings edits.
- Senior security section has one additional control row; verify spacing in narrow mobile widths.

Verification:
- `npm run type-check`
- `npm test -- --run tests/pages/einstellungen-tier.test.tsx tests/pages/einstellungen-name-fields.test.tsx tests/lib/vault-context.test.tsx`

Rollback:
- Revert `src/components/vault/VaultIdleLock.tsx` and `src/app/(dashboard)/einstellungen/page.tsx`, and remove this changelog entry.

Open Issues:
- none

## 2026-03-02 23:43 UTC | Agent: Traycer.AI | Commit: uncommitted
Change:
- Created src/components/vault/VaultIdleLock.tsx: client-side idle lock component that fetches vault_idle_timeout_minutes, tracks DOM activity events, calls vault.lock() on timeout, shows 4-second banner.
- Mounted <VaultIdleLock /> in vault-client-wrapper.tsx alongside <InactivityLogout />.
- Added "Tresor-Sicherheit" card to einstellungen/page.tsx with controlled <select> for vault_idle_timeout_minutes; persisted via direct Supabase update; success indicator auto-dismisses after 2s.

Risk / Regression Watch:
- InactivityLogout is untouched (byte-for-byte).
- VaultIdleLock only calls vault.lock() when vault.isUnlocked is true.
- dashboard layout.tsx remains a server component.

Verification:
- npm run type-check
- npm run lint

Rollback:
- Delete src/components/vault/VaultIdleLock.tsx, revert vault-client-wrapper.tsx and einstellungen/page.tsx.

## 2026-03-02 21:43 UTC | Agent: Traycer.AI | Commit: uncommitted
Change:
- Vault setup callout added to documents onboarding step; session-dismissible via `vaultSetupDismissed` local state; auto-replaced by green success badge when `vault.isSetUp` becomes `true`.

Risk / Regression Watch:
- Low - additive UI only, no API changes, no state persistence, no other steps touched.

Verification:
- `npm run type-check`
- `npm run lint`

Rollback:
- Revert `src/app/(dashboard)/onboarding/page.tsx` changes and remove this changelog entry.

## 2026-03-02 21:19 UTC | Agent: Codex | Commit: uncommitted
Change:
- Implemented T4 category lock timing in documents UI by adding `src/lib/dokumente/useCategoryLockState.ts` with `FIVE_MINUTES_MS = 300000` and a 10s tick for lock/timer state.
- Refactored `src/app/(dashboard)/dokumente/page.tsx` to use one shared `CategoryCard` component for standard and custom categories, with locked-only tooltip, keyboard a11y, and secured-category amber styling always applied.
- Replaced legacy unlock freshness logic (`RECENT_UNLOCK_WINDOW_MS`, `lastVaultUnlockRef`, old `isCategoryLocked`) with vault timestamp checks based on `vaultContext.lastUnlockTimestamp + FIVE_MINUTES_MS`, including pending unlock resume gating.
- Switched documents page to React 19 context usage via `use(VaultContext)` and exported `VaultContext` from `src/lib/vault/VaultContext.tsx`.

Why:
- Close the pending-unlock bypass where secured categories could be resumed after stale unlock windows and align category lock UX with 5-minute re-lock behavior.

Risk / Regression Watch:
- Category lock state now depends on vault `lastUnlockTimestamp`; verify environments with stale/missing timestamp initialization still prompt unlock as expected.
- Overview card visual behavior changed substantially (tooltip replaces locked overlay); verify desktop/mobile interactions for secured custom categories.

Verification:
- `npm run type-check`
- `npm run lint`

Rollback:
- Revert `src/app/(dashboard)/dokumente/page.tsx`, `src/lib/dokumente/useCategoryLockState.ts`, `src/lib/vault/VaultContext.tsx`, and this changelog entry.

Open Issues:
- none

## 2026-03-02 21:06 UTC | Agent: Codex | Commit: uncommitted
Change:
- Scoped T3 changes to allowed surfaces by removing out-of-scope category lock hook extraction and reverting `VaultUnlockModal` edits.
- Updated documents upload flow toast behavior to reflect real lock-update outcome (show locked state only on DB success; show explicit failure toast otherwise).
- Hardened `/api/documents/upload` tags validation: require JSON array, require string items, enforce max 10, normalize via trim + dedupe.

Why:
- Prevent cross-ticket coupling and misleading security state messaging while enforcing stricter API input contracts.

Risk / Regression Watch:
- Category lock behavior in documents overview is restored to pre-refactor logic and no longer uses the extracted timer hook.
- Upload success now may show two toasts when lock-after-upload fails (failure + success with actions), which is intentional for clarity.

Verification:
- `python scripts/ops/logging-audit.py`
- `npm run type-check`
- `npm run lint`

Rollback:
- Revert `src/app/(dashboard)/dokumente/page.tsx`, `src/app/api/documents/upload/route.ts`, and this changelog entry.

Open Issues:
- none

## 2026-03-02 20:56 UTC | Agent: Codex | Commit: uncommitted
Change:
- Added toast infrastructure in `src/components/ui/toast.tsx` (Radix wrapper + imperative `toast()` / `useToast`) and mounted `ToastProvider` + `ToastViewport` in `src/app/(dashboard)/layout.tsx`.
- Refactored `src/app/(dashboard)/dokumente/UploadDialog.tsx` to remove the conflicting nested scroll setup, remove the scroll-arrow state/button, and implement compound submit variants (`SubmitUnlocked`, `SubmitLocked`, `SubmitNotSetup`) with vault-aware upload gating.
- Added upload tags input and lock-after-upload toggle to `UploadDialog`, with new props wiring from `src/app/(dashboard)/dokumente/page.tsx`.
- Updated `src/app/(dashboard)/dokumente/page.tsx` upload flow: removed old vault gate in `handleUpload`, appended `tags` in FormData, added post-upload toast actions, added optional post-upload document lock, added upload reset wrapper, added tag-filter state/UI/filter pass, and made plaintext title fallback explicit in `getDisplayTitle` when vault is locked and privacy mode is off.
- Updated `src/app/api/documents/upload/route.ts` to parse/validate/cap incoming `tags` and persist them to `insertPayload`.

Why:
- Implemented the planned Dokumente upload/security UX changes end-to-end: explicit vault-state submit flows, tag capture/filtering, optional immediate locking, post-upload actions, and toast feedback.

Risk / Regression Watch:
- `UploadDialog` now requires additional props (`vaultState`, `tags`, `onTagsChange`, `lockAfterUpload`, `onLockAfterUploadChange`, `vault`); any caller must provide them.
- The previous upload-dialog scroll gradient/arrow affordance was removed with the scroll-container simplification and may require test expectation updates.

Verification:
- `python scripts/ops/logging-audit.py`
- `npm run type-check`
- `npm run lint`
- `npm run test -- dokumente` (fails: existing/updated Dokumente test expectations now mismatch new upload dialog/vault-flow behavior and removed scroll-gradient assertion)

Rollback:
- Revert `src/components/ui/toast.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dokumente/UploadDialog.tsx`, `src/app/(dashboard)/dokumente/page.tsx`, `src/app/api/documents/upload/route.ts`, and this changelog entry.

Open Issues:
- `tests/pages/dokumente.test.tsx` contains failing assertions tied to prior reminder-watcher upload assumptions and prior upload-dialog scroll-gradient expectation.

## 2026-03-02 18:17 UTC | Agent: Codex | Commit: uncommitted
Change:
- Added authenticated `POST /api/documents/audit` endpoint at `src/app/api/documents/audit/route.ts` and wired it to `logSecurityEvent()` for biometric vault unlock audits.
- Updated `src/lib/vault/VaultContext.tsx` to expose `isBiometricSupported` via WebAuthn PRF capability detection, use it for setup/unlock guards, and post biometric unlock audits with only a truncated credential id.
- Updated biometric management rendering in `src/app/(dashboard)/einstellungen/page.tsx` so active setup/removal controls only render when the vault is unlocked.
- Updated `src/components/vault/VaultUnlockModal.tsx` to show the biometric unlock affordance only when biometric setup exists and PRF capability is supported.

Why:
- Restore required biometric unlock audit persistence and align biometric management/unlock UX with vault-unlock and browser-capability gates.

Risk / Regression Watch:
- PRF detection relies on `PublicKeyCredential.getClientCapabilities`; browsers without this API will hide biometric affordances as a safety fallback.

Verification:
- `python scripts/ops/logging-audit.py`
- `npm run type-check`
- `npm test -- --run tests/components/vault-unlock-modal.test.tsx tests/lib/vault-context.test.tsx` (fails in sandbox with `spawn EPERM` while loading Vitest/esbuild config)

Rollback:
- Revert `src/app/api/documents/audit/route.ts`, `src/lib/vault/VaultContext.tsx`, `src/components/vault/VaultUnlockModal.tsx`, `src/app/(dashboard)/einstellungen/page.tsx`, and this changelog entry.

Open Issues:
- Targeted Vitest execution is blocked in this environment by `spawn EPERM` (esbuild process startup), so runtime test assertions could not be executed locally.

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

## 2026-03-02 18:31 UTC | Agent: Traycer.AI | Commit: uncommitted
Change:
- Added `src/lib/dokumente/useCategoryLockState.ts` with exported `FIVE_MINUTES_MS` and 10-second interval recomputation for `{ isLocked, secondsRemaining }`.
- Extracted a reusable `CategoryCard` sub-component in `src/app/(dashboard)/dokumente/page.tsx` for both default and custom categories, and wired tooltip-based locked guidance.
- Applied secured-category amber styling updates, added shield-adjacent countdown badge, and removed legacy locked card overlay UI.
- Updated category/document lock checks to use `vaultContext.lastUnlockTimestamp` + `FIVE_MINUTES_MS`, and removed dead code (`RECENT_UNLOCK_WINDOW_MS`, `lastVaultUnlockRef`, `isCategoryLocked`).

Risk / Regression Watch:
- Interval-driven state updates now run every 10 seconds per visible category card; verify no noticeable render/perf regressions with large category lists.

Verification:
- `npm run type-check`
- `npm run lint`
- `npm test -- --run tests/pages/dokumente.test.tsx`

Rollback:
- Revert `src/lib/dokumente/useCategoryLockState.ts` and revert the `CategoryCard`/lock-check/import cleanup changes in `src/app/(dashboard)/dokumente/page.tsx`.

Open Issues:
- none

## 2026-03-02 18:27 UTC | Agent: Traycer.AI | Commit: uncommitted
Change:
- Added `src/lib/dokumente/useCategoryLockState.ts` with `FIVE_MINUTES_MS` and a 10-second interval-based lock/timer recomputation hook.
- Extracted a unified `CategoryCard` sub-component in `src/app/(dashboard)/dokumente/page.tsx` for both standard and custom categories, wired to `useCategoryLockState`.
- Replaced locked hover overlay with tooltip-based locked guidance and added amber secured-card styling plus shield-adjacent countdown timer badge.
- Replaced legacy category lock checks to use `vaultContext.lastUnlockTimestamp` + `FIVE_MINUTES_MS`, removed `RECENT_UNLOCK_WINDOW_MS`, removed `lastVaultUnlockRef`, and removed `isCategoryLocked`.

Why:
- Implement time-window-based secured category behavior directly from vault unlock timestamps and align category-card lock UX with tooltip and countdown requirements.

Risk / Regression Watch:
- Each visible secured category card now runs a 10-second interval recomputation; watch for performance impact with many categories rendered simultaneously.

Verification:
- `npm run type-check`
- `npm run lint`
- `npm test -- --run tests/pages/dokumente.test.tsx`

Rollback:
- Revert `src/lib/dokumente/useCategoryLockState.ts` and the related `CategoryCard`/import/lock-check cleanup changes in `src/app/(dashboard)/dokumente/page.tsx`.

Open Issues:
- none

## 2026-03-02 18:11 UTC | Agent: Traycer.AI | Commit: uncommitted
Change:
- Added biometric vault unlock audit event constant (`EVENT_VAULT_UNLOCKED_BIOMETRIC`).
- Extended vault key-material GET response to include `webauthn_credential_id`.
- Added new biometric vault API route with GET/POST/DELETE handlers at `src/app/api/vault/biometric-key/route.ts`.
- Extended `VaultContext` with biometric setup/unlock/status refresh methods plus `lastUnlockTimestamp`/`hasBiometricSetup` and user identity state.
- Implemented WebAuthn PRF-based biometric setup + unlock flow in `VaultProvider`, including timestamp updates and biometric unlock audit fire-and-forget call.
- Added `VaultUnlockModal.Biometric` compound sub-component and biometric unlock UI/error state handling.
- Added biometric management UI blocks in settings page for both senior and standard layouts with explicit setup/locked/enabled variants.

Why:
- Implements T2 biometric unlock/management flow end-to-end while preserving existing passphrase/recovery unlock behavior.

Risk / Regression Watch:
- Biometric unlock introduces a new WebAuthn PRF-dependent unlock path; browser support or credential policy differences may affect availability.
- Existing passphrase/recovery unlock flow remains unchanged, but shared unlock state now also tracks biometric status/timestamps.

Verification:
- `npm run type-check`
- `npm run lint`
- `python scripts/ops/logging-audit.py`

Rollback:
- Revert biometric route/context/modal/settings/audit-log/key-material changes and remove this changelog entry.

Open Issues:
- none

## 2026-03-02 17:58 UTC | Agent: Traycer.AI | Commit: uncommitted
Change:
- Created supabase/migrations/20260302000300_documents_tags.sql — adds `tags text[]` column + GIN index to documents.
- Created supabase/migrations/20260302000400_vault_biometric_columns.sql — adds three nullable biometric/WebAuthn columns to user_vault_keys.
- Created supabase/migrations/20260302000500_profiles_vault_idle_timeout.sql — adds `vault_idle_timeout_minutes integer` column to profiles.
- Updated src/types/database.ts — extended documents, user_vault_keys, and profiles Row/Insert/Update types with new columns.

Why:
- T1 prerequisite migrations for the Document Vault UX Overhaul epic; all other tickets (T2–T9) depend on these schema changes.

Risk / Regression Watch:
- Additive schema changes only; no existing columns altered. TypeScript additions are all optional in Insert/Update.
- Confirm no existing INSERT sites for documents/profiles/user_vault_keys omit `tags`/`vault_idle_timeout_minutes` in a way that would miss the DB default.

Verification:
- npm run type-check
- npm run lint

Rollback:
- Delete the three migration files and revert the three table blocks in src/types/database.ts.

Open Issues:
- none

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
