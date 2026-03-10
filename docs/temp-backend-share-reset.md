# Backend Share Reset

## Goal
- Make document sharing server-authoritative for outgoing shares, incoming shares, and active-share filtering.
- Allow Basic and Premium owners to grant downloadable trusted-person access and download links.

## Required Changes
- Fix `GET /api/documents/share-token?ownerId=...` to return the authenticated owner's active outgoing shares for that owner.
- Fix `GET /api/documents/share-token/received` to return only active incoming shares for the authenticated trusted person.
- Filter revoked and expired shares server-side everywhere the backend exposes share state.
- Allow Basic owners through `allowsFamilyDownloads`, `/api/family/download`, and `/api/download-link/create`.
- Update backend-generated invitation/download-link email copy to remove any "Premium required for download" language.
- Update `/api/family/members` tier/share capability payload so Basic incoming members are no longer marked as view-only.

## API Contract Expectations
- Outgoing-share API should include:
  - share id
  - document id/title/category/file name
  - trusted person id/name/email
  - permission
  - expires_at
  - created_at
- Incoming-share API should include only active shares plus nested document/sharer metadata already used by the UI.
- Per-share `permission` remains explicit and is not downgraded by tier.

## Tests To Update
- `tests/api/share-token.test.ts`
- `tests/subscription-tier.test.ts`
- focused backend-facing assertions in `tests/pages/zugriff.test.tsx` only where route semantics changed

## Verification Target
- `python scripts/ops/logging-audit.py`
- `python scripts/ops/hook-discipline-audit.py`
- `npm run type-check`
- `npm run lint`
- `npx vitest run tests/api/share-token.test.ts tests/subscription-tier.test.ts tests/pages/zugriff.test.tsx`
