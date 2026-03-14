# Trusted User Linking Backend Tech Plan

## Summary
- Replace the current “share documents first, then bootstrap access with a short-lived secure link” model with an explicit two-phase backend flow:
  - `Phase 1: relationship invitation and acceptance`
  - `Phase 2: secure access setup and device enrollment`
- Do not allow document sharing until the trusted-user relationship is fully linked and at least one trusted device/browser is enrolled.
- Keep secure-link delivery as `manual send`, but make it operationally safe: single-use, revocable, stateful, and resilient across login.

## Core Backend Changes
- Introduce an explicit relationship state machine on the trusted-person relationship:
  - `invited`
  - `accepted_pending_setup`
  - `setup_link_sent`
  - `active`
  - `revoked`
- Add a small event/history table for cross-user status propagation and auditability:
  - `trusted_access_events`
  - fields: relationship id, actor user id, event type, occurred at, owner seen at, trusted user seen at, metadata
  - event types: `invited`, `accepted`, `setup_link_sent`, `setup_started`, `otp_verified`, `device_enrolled`, `revoked`
- Keep `trusted_access_devices` for browser/device enrollment, but make device enrollment depend on an already accepted relationship instead of combining acceptance and enrollment into one brittle token flow.

## API And State Flow
- Replace the current secure-link contract with these backend stages:
  - `POST /api/trusted-person/invitations/:id/accept`
    - trusted user accepts the owner’s invitation
    - validates exact invited email / linked user
    - moves relationship to `accepted_pending_setup`
  - `POST /api/trusted-access/setup-links`
    - owner creates a setup link only for an `accepted_pending_setup` relationship
    - revokes prior unused setup links
    - returns `setupUrl`, `expiresAt`, `singleUse`, `deliveryMode=manual`
  - `GET /api/trusted-access/setup/claim?token=...`
    - validates token
    - requires login with invited account
    - establishes server-side pending setup state
    - never grants document access directly
  - `POST /api/trusted-access/setup/otp/send`
  - `POST /api/trusted-access/setup/otp/verify`
  - `POST /api/trusted-access/setup/complete`
    - creates device enrollment
    - marks relationship `active` if first successful device
    - emits `device_enrolled`
  - `GET /api/trusted-access/relationship-status`
    - returns normalized state and next-action metadata for owner and trusted user UIs

## Policy And Guardrails
- Enforce sharing policy:
  - all share creation APIs must reject sharing to trusted persons unless relationship state is `active`
  - received-shares APIs must return an explicit `not_linked_yet` state instead of an empty/expired-style error
  - trusted user should never see decrypt/download CTAs until both conditions are true:
    - relationship state is `active`
    - explicit document shares exist
- Chosen defaults:
  - invitation acceptance window: `7 days`
  - manual secure setup link: `24 hours`, single-use, newest link wins
  - OTP: `10 minutes`
  - device enrollment validity: persistent until revoked or browser storage cleared
- Failure handling:
  - if setup link expires, owner can reissue without re-inviting
  - if trusted user logs in with the wrong account, show `wrong_account` state, do not consume link
  - if trusted user accepted invitation but owner shared nothing yet, show “linked, waiting for owner to share”
  - if owner revokes relationship, all devices and future document access are invalid immediately
- Compatibility:
  - keep current trusted-access endpoints temporarily as compatibility wrappers/redirectors
  - migrate owner/trusted-user dashboards to the new relationship status API before deleting old bootstrap assumptions

## Test Plan
- Relationship lifecycle:
  - owner invites trusted user
  - trusted user accepts
  - owner creates setup link
  - trusted user logs in, verifies OTP, enrolls device
  - owner can then share documents
  - trusted user can then view/download only explicitly shared documents
- Negative paths:
  - trusted user accepts invitation but owner has not shared documents yet
  - owner tries to share before relationship is `active`
  - wrong-account login during setup
  - expired setup link
  - revoked relationship after device enrollment
  - new browser without enrollment
- Regression/security:
  - no document access from link possession alone
  - no access without accepted relationship, authenticated invited user, OTP verification, and enrolled device
  - logs remain structured and non-sensitive
  - device/browser revocation immediately blocks access

## Assumptions And Defaults
- Manual secure-link forwarding remains the chosen delivery model.
- The trusted user must authenticate with the exact invited email-linked account.
- Document sharing is intentionally blocked until the relationship is fully linked and at least one device is enrolled.
