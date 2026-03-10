# Frontend Share Reset

## Goal
- Replace client-derived share visibility with backend-authoritative share state.
- Remove all Basic-tier "view only" UX for trusted-person document sharing and download links.

## Build On Top Of These Backend Surfaces
- `GET /api/documents/share-token?ownerId=<current-user-id>`
  - now returns the owner's active outgoing shares
  - includes nested `documents` and `trusted_persons` metadata
- `GET /api/documents/share-token/received`
  - now returns only active incoming shares
- `/api/family/members`
  - Basic incoming members should now come through as download-capable, not view-only
- `/api/family/download`
  - Basic owners are now allowed
- `/api/download-link/create`
  - Basic owners now create download links, not view-only links

## Files To Update
- `src/components/sharing/ActiveSharesList.tsx`
- `src/components/sharing/ReceivedSharesList.tsx`
- `src/app/(dashboard)/dokumente/page.tsx`
- `src/app/(dashboard)/zugriff/page.tsx`
- any shared tier/info UI touched by the family tab or download-link dialog

## Required Frontend Changes
- Refactor `ActiveSharesList` to fetch from `/api/documents/share-token?ownerId=...` instead of querying `document_share_tokens`, `documents`, and `trusted_persons` directly from the browser.
- Keep `ReceivedSharesList` API-backed and render the server-returned active incoming shares as-is.
- Add a shared owner-side refresh path:
  - after single-share success in `/dokumente`
  - after bulk-share success in `/zugriff`
  - after revoke in `ActiveSharesList`
- Make owner-side share visibility immediate:
  - a newly created share should appear in the outgoing shares list without a full page reload
  - "connected but not shared yet" must remain distinct from "shared"

## UI / UX Fixes
- Remove all Basic-tier "Nur Ansicht", "Download nur mit Premium", and similar copy from:
  - family tab highlighted banners
  - tier explanation cards
  - download-link dialog copy
  - document viewer info banners
  - any CTA or badge that still frames Basic as view-only
- Keep permission labels share-specific:
  - `Nur ansehen`
  - `Herunterladen erlaubt`
- Show share metadata clearly in outgoing shares:
  - document title
  - recipient name
  - permission
  - expiry if present
- Keep free-tier messaging intact unless a separate product change is requested.

## Specific Integration Notes
- In `/dokumente/page.tsx`, `ShareDocumentDialog.onSuccess` currently only closes the dialog. Add the outgoing-share refresh hook there.
- In `/zugriff/page.tsx`, the bulk-share success path already bumps `sharesVersion`; keep that pattern or replace it with one shared source, but the active-share list must re-render from the outgoing-share API.
- Update any family-tab rendering branches that key off `tier.viewOnly` so Basic users are presented as download-capable when `canDownloadSharedDocuments` is true.
- Update any mocked `DocumentViewer` banner text/tests that still mention Premium-only downloads for Basic.

## Frontend Test Targets
- `tests/components/sharing.test.tsx`
- `tests/pages/zugriff.test.tsx`
- `tests/pages/dokumente.test.tsx`
- any fixture files that still encode Basic as `viewOnly: true`

## Acceptance Criteria
- Owner shares a document and immediately sees an outgoing share row.
- Trusted person sees only active incoming shares.
- Basic-tier owners no longer see any "view only" trusted-person/download-link messaging.
- Family tab and viewer banners describe access based on share permission and active share state, not the old Basic-vs-Premium split.
