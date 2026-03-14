# Trusted User Linking Frontend Tech Plan

## Status
- This plan is aligned to the backend shipped on `2026-03-13` / `2026-03-14`.
- Claude can implement against this plan without inventing backend contracts.
- Legacy `/api/trusted-access/invitations/*` endpoints still exist as compatibility wrappers, but new frontend work should target the new route surface below.

## Backend Contract Claude Must Use
- Relationship states on `trusted_persons.relationship_status`:
  - `invited`
  - `accepted_pending_setup`
  - `setup_link_sent`
  - `active`
  - `revoked`
- New backend routes:
  - `POST /api/trusted-person/invitations/:id/accept`
  - `POST /api/trusted-access/setup-links`
  - `GET /api/trusted-access/setup/claim?token=...`
  - `POST /api/trusted-access/setup/otp/send`
  - `POST /api/trusted-access/setup/otp/verify`
  - `POST /api/trusted-access/setup/complete`
  - `GET /api/trusted-access/relationship-status`
- Share/access guardrails already enforced by backend:
  - owner share creation is rejected unless relationship state is `active`
  - trusted-person document access is rejected unless relationship state is `active`
  - `GET /api/documents/share-token/received` now returns explicit `relationships` state when there are no active shares yet

## Important Backend Reality Checks
- Do not build the frontend around `trusted_access_events` yet.
- The table exists, but there is no read API for events/history in this implementation.
- Persistent banners/cards should therefore be driven by:
  - `GET /api/trusted-access/relationship-status`
  - `GET /api/documents/share-token/received`
  - existing owner-side list/family APIs already enriched with access-link status
- There is no trusted-user “invitation inbox” API for pre-acceptance invites.
- Pre-acceptance still begins from the invitation link/token flow.
- After login or redeem, the frontend should route into a stable task/status surface.

## Summary
- Rewrite the trusted-user linking experience around one explicit, stateful flow for both owner and trusted user.
- The UI must clearly separate:
  - invitation sent
  - invitation accepted
  - secure access setup
  - documents shared
  - access active
- Claude should use `impeccable` as a frontend implementation and review reference if it is available in the workflow.

## Core Frontend Flow
- Use one explicit checklist with the same vocabulary on both sides:
  - `1. Einladung gesendet`
  - `2. Einladung angenommen`
  - `3. Sicheren Zugriff einrichten`
  - `4. Dokumente freigeben`
  - `5. Zugriff aktiv`

## Owner Experience
- Surface this in `Zugriff & Familie`.
- Each trusted person gets a status card, not only a generic action row.
- Primary CTA by relationship state:
  - `invited` -> `Auf Annahme warten`
  - `accepted_pending_setup` -> `Sicheren Link erstellen`
  - `setup_link_sent` -> `Neuen Link senden`
  - `active` -> `Dokumente freigeben`
  - `revoked` -> `Erneut einladen` or `Status: deaktiviert`, depending on current product rules
- Document share controls must stay disabled until `active`.
- After creating/copying the setup link, show a persistent next-step panel:
  - who to send it to
  - that the exact invited account/email must be used
  - when the link expires
  - that the trusted user must verify the OTP and enroll the current browser/device
- Owner state sources:
  - use existing owner/family APIs where they already expose `accessLinkSetup`
  - use `GET /api/trusted-access/relationship-status?trustedPersonId=...` for the detail/status card source of truth where needed

## Trusted User Experience
- Add a dedicated stable surface such as `Einladungen & Zugriff` or equivalent task/status page.
- Do not drop the user straight into an ambiguous redeem-only screen as the primary model.
- Deep links are still acceptable entrypoints, but after login or claim they should resolve into the same status/task surface.
- Before secure setup is complete, show exactly one primary next action:
  - accept invitation
  - open secure setup
  - verify email code
  - device ready, waiting for owner shares
- After secure setup succeeds, show:
  - owner name
  - `Verbindung hergestellt`
  - whether documents are already shared
  - CTA to either `Geteilte Dokumente ansehen` or `Auf Freigaben warten`

## Trusted User Data Sources
- Pre-acceptance:
  - invitation link/token flow remains the entrypoint
  - use existing invitation page flow, but wire acceptance to `POST /api/trusted-person/invitations/:id/accept`
- Setup flow:
  - claim via `GET /api/trusted-access/setup/claim?token=...`
  - load/setup state via existing redeem surface or new task-center loader using:
    - `GET /api/trusted-access/relationship-status?ownerId=...` when owner/trusted-person context is known
    - `GET /api/trusted-access/invitations/pending` only as compatibility if needed during migration
  - send OTP via `POST /api/trusted-access/setup/otp/send`
  - verify OTP via `POST /api/trusted-access/setup/otp/verify`
  - complete device enrollment via `POST /api/trusted-access/setup/complete`
- Post-setup / waiting-for-share:
  - use `GET /api/documents/share-token/received`
  - if `shares` is empty, inspect `relationships`
  - distinguish:
    - `relationshipStatus !== active` -> `not_linked_yet`
    - `relationshipStatus === active` with no shares -> `linked, waiting for owner to share`

## Required UX Rules
- `accepted but not linked yet` is not an error.
- `linked but no documents shared yet` is not an error.
- `wrong account` must show:
  - the invited email/account expectation
  - a clear switch-account CTA
- `expired setup link` must tell the user to ask for a new secure setup link.
- Do not imply that the relationship invitation itself failed.
- Never imply that “accepted invitation” already means “document access active”.
- Do not show decrypt/download CTAs before both are true:
  - relationship state is `active`
  - explicit shares exist

## Senior Mode Requirements
- Render this flow as large step cards with one primary action per screen.
- Keep instructions in plain, literal German.
- Do not rely on icon-only meaning.
- Repeat current step and next step at the top of every screen.
- Avoid hiding critical state in tabs-only or modal-only UI.
- Use larger hit targets, stronger contrast, larger body text, and fewer choices per step.
- Never force users to remember what happened on a previous screen; restate:
  - what already happened
  - what happens next

## Recommended UI Structure
- Owner:
  - trusted-person row list for overview
  - expandable/detail card for lifecycle and next step
  - disabled share controls with explicit explanation until `active`
- Trusted user:
  - task/status page as the steady-state home
  - redeem page can remain the link landing surface, but should hand off into the task/status view
  - one primary CTA per state

## Suggested State Mapping
- Owner card mapping:
  - `invited` -> checklist through step 1, show waiting state
  - `accepted_pending_setup` -> highlight step 3, CTA `Sicheren Link erstellen`
  - `setup_link_sent` -> highlight step 3, CTA `Neuen Link senden`
  - `active` + no shares -> highlight step 4, CTA `Dokumente freigeben`
  - `active` + shares -> highlight step 5, show active state
- Trusted-user mapping:
  - relationship not yet accepted -> acceptance state
  - `accepted_pending_setup` -> waiting for owner to send setup link
  - `setup_link_sent` + OTP incomplete -> setup required
  - `active` + no shares -> waiting-for-share success state
  - `active` + shares -> shared-documents CTA

## Explicit Non-Goals For Claude
- Do not assume there is an events/history API yet.
- Do not build a UI that requires `GET trusted_access_events`.
- Do not delete legacy trusted-access screens/endpoints during this frontend pass.
- Do not introduce a separate frontend-only state machine that diverges from backend `relationship_status`.

## Migration Strategy
- Phase 1:
  - update owner cards and disabled share UX to respect `relationship_status`
  - update trusted-user redeem/setup screens to use the new setup routes
- Phase 2:
  - add the stable trusted-user status/task surface
  - route deep-link users into that surface after claim/login
- Phase 3:
  - remove frontend dependence on legacy `/api/trusted-access/invitations/*` endpoints once the new surfaces are fully wired

## Test Plan
- Owner side:
  - each relationship state renders the correct card and CTA
  - share controls remain disabled until relationship state is `active`
  - copy-link flow shows persistent next-step instructions
- Trusted user side:
  - task/status flow shows exactly one primary next step
  - wrong-account, expired-link, not-linked-yet, and no-documents-yet states are distinct
  - post-setup success state routes correctly to either waiting-for-share or shared-documents
- API wiring:
  - new setup flow uses `/api/trusted-access/setup/*`
  - status cards use `/api/trusted-access/relationship-status`
  - waiting-for-share uses `relationships` from `/api/documents/share-token/received`
- Senior mode:
  - large text, large targets, and step hints remain readable and unambiguous
  - no critical action depends on hidden tabs, icon-only controls, or transient toast-only feedback

## Assumptions And Defaults
- Persistent status UI is required for both users; toast-only confirmation is insufficient.
- Manual secure-link forwarding remains the product choice.
- The frontend should treat backend `relationship_status` as the canonical lifecycle source.
- Claude may keep compatibility reads/writes to legacy trusted-access routes only where needed during migration, but all new work should prefer the new route surface above.
