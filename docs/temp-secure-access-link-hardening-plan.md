# Secure Access-Link Redemption Hardening For Trusted-Person Document Access

## Summary
Replace the current reusable client-side `Zugriffslink` bootstrap with a server-controlled redemption flow designed for sensitive personal documents. The new model must make the original link short-lived and single-use, preserve intent across authentication securely, bind redemption to the intended trusted person, and require a stronger identity confirmation on first redemption. The trusted person should never gain document access merely by possessing a long-lived URL fragment.

This plan also fixes the two product/security bugs discovered in the current implementation:
- opening the access link while logged out loses the bootstrap secret during login
- generating the access link currently bulk-shares all encrypted documents instead of only enabling future access

The resulting flow should match a safer enterprise SaaS pattern:
1. owner explicitly shares documents
2. owner generates an access invitation
3. invitation link is short-lived and one-time
4. trusted person authenticates
5. server verifies intended recipient binding
6. server requires first-redemption step-up verification
7. server redeems the invitation and registers that browser/device
8. future access on that browser/device works without reusing the original invitation link

## Security Model
### Goals
- The original access link becomes useless after successful redemption.
- An intercepted or forwarded link should not grant lasting access by itself.
- Logging in with the wrong account must fail redemption cleanly.
- First-time device/browser setup for shared encrypted documents must require stronger proof than only a session cookie.
- Browser persistence should avoid storing raw long-lived secrets directly in `localStorage`.

### Defaults Chosen
- Use a server-generated redemption token, not the relationship key itself, in the URL.
- Redemption token TTL: `15 minutes`.
- Redemption token use count: exactly `1`.
- Token is invalid after first successful redemption, expiry, explicit revocation, or replacement.
- First successful redemption requires email OTP to the invited trusted-person email.
- Optional stronger MFA integration can be layered later, but email OTP is mandatory in this phase.
- Device/browser enrollment persists until revoked, session loss, explicit unlink, or browser storage clear.
- Access to encrypted documents remains restricted to explicitly shared documents only.
- `Zugriffslink` generation must no longer auto-share all encrypted documents.

## Core Flows
### 1. Owner Shares Documents
1. Owner shares one or more documents with an accepted, linked trusted person.
2. This creates or reactivates `document_share_tokens` only for the selected documents.
3. If no browser/device enrollment exists yet for that trusted person relationship, the owner UI must show:
   - documents are shared
   - trusted person still needs secure access setup
   - access invitation has not been redeemed on any device yet
4. Sharing documents alone must not automatically create broad access to all encrypted files.

### 2. Owner Generates Access Invitation
1. Owner clicks `Zugriffslink erstellen`.
2. Backend creates a short-lived single-use redemption record for that owner/trusted-person relationship.
3. Backend returns a URL containing only the redemption token, never the raw relationship key.
4. Owner UI must state clearly:
   - the app does not send this automatically
   - the owner must send it manually
   - it expires after 15 minutes if unused
   - it can only be used once
   - if the trusted person uses the wrong account, setup will fail and the owner may need to generate a new link
5. Copy confirmation must clearly instruct the owner to send the link immediately.

### 3. Trusted Person Opens Link While Logged Out
1. Trusted person opens `/zugriff/access/redeem?token=...`.
2. Server validates basic token status without redeeming it yet.
3. If no session exists, server stores only a signed, HTTP-only, short-lived pending-redemption state cookie containing:
   - token id or opaque nonce
   - owner id
   - trusted_person_id or invited email binding
   - expiry
   - CSRF/state nonce
4. User is redirected to login.
5. After auth callback, server restores the pending redemption flow from the signed cookie/state, not from URL fragments.
6. If the cookie/state is missing or expired, redemption fails with a clear “link expired, ask owner for a new link” message.

### 4. Trusted Person Opens Link While Logged In
1. Server resolves the token and authenticated user.
2. It checks that the signed-in user is the intended recipient:
   - preferred binding: `trusted_persons.linked_user_id === auth.user.id`
   - fallback during pre-link invited flows only if explicitly supported: verified email matches invited email and server links safely
3. If the signed-in account does not match:
   - do not redeem
   - show a clear error: “This link was intended for another account”
   - offer sign-out and retry
   - optionally allow switching account, but never silently relink to a different identity
4. If the token is expired, redeemed, revoked, or replaced, fail with a deterministic state.

### 5. First Redemption Step-Up Verification
1. Before final redemption, server triggers email OTP to the trusted person’s invited email address.
2. Trusted person enters the OTP on a dedicated confirmation screen.
3. OTP constraints:
   - TTL `10 minutes`
   - attempt limit `5`
   - one active OTP challenge per pending redemption
   - invalidate on successful verification or redemption failure
4. If OTP fails or expires:
   - do not redeem the invitation
   - require a new OTP or new access invitation depending on failure state
5. This OTP is required only for first browser/device enrollment for the relationship, or for future high-risk re-enrollment if desired.

### 6. Successful Redemption
1. Server marks the redemption token as redeemed.
2. Server ensures the relationship key exists server-side for that owner/trusted-person relationship.
3. Server creates a browser/device enrollment artifact for the current browser.
4. Browser receives only the minimal encrypted bootstrap material needed to use the relationship on that device.
5. The original link token is now worthless.
6. Trusted person is redirected to the owner view/dashboard with a success banner.

### 7. Future Access On The Same Browser/Device
1. Trusted person later visits shared documents on that same browser.
2. Backend checks:
   - user is the accepted, active linked trusted person
   - documents are explicitly shared
   - a valid browser/device enrollment exists
3. If yes, encrypted documents can be viewed/downloaded without reopening the original access invitation.
4. If browser storage is cleared or device enrollment is revoked, access reverts to setup-required.

### 8. Wrong Account / Suspicious Access
1. If a different logged-in account tries to redeem:
   - block redemption
   - do not reveal sensitive document metadata beyond owner display name if even that
   - instruct user to sign in with the invited account
2. If multiple failed OTP attempts or repeated wrong-account redemptions occur:
   - rate-limit
   - log at `warn`
   - optionally invalidate the invitation and require owner to generate a new one
3. If owner revokes trusted person linkage or document sharing:
   - all future API access must fail
   - existing device enrollment must not bypass revoked sharing

## Backend Changes
### Data Model
Add dedicated tables for invitation redemption and device enrollment.

#### `trusted_access_invitations`
Purpose: short-lived one-time access invitation lifecycle.

Columns:
- `id uuid pk`
- `owner_id uuid not null`
- `trusted_person_id uuid not null`
- `token_hash text not null unique`
- `status text not null`
  - allowed values: `pending`, `redeemed`, `expired`, `revoked`, `replaced`
- `expires_at timestamptz not null`
- `redeemed_at timestamptz null`
- `redeemed_by_user_id uuid null`
- `redeemed_device_id uuid null`
- `created_by_user_id uuid not null`
- `created_at timestamptz not null default now()`
- `revoked_at timestamptz null`
- `replaced_by_invitation_id uuid null`
- `last_sent_at timestamptz null`
- `metadata jsonb not null default '{}'::jsonb`

Constraints:
- foreign keys to owner and trusted person
- check status enum semantics
- unique pending invitation policy per owner/trusted person should be enforced by service logic, not necessarily DB unique partial constraint if replacement is easier operationally

Store only a hash of the presented token, never the raw token.

#### `trusted_access_otp_challenges`
Purpose: step-up verification for first redemption.

Columns:
- `id uuid pk`
- `invitation_id uuid not null`
- `trusted_person_id uuid not null`
- `code_hash text not null`
- `expires_at timestamptz not null`
- `consumed_at timestamptz null`
- `attempt_count integer not null default 0`
- `max_attempts integer not null default 5`
- `created_at timestamptz not null default now()`

#### `trusted_access_devices`
Purpose: device/browser enrollment after successful redemption.

Columns:
- `id uuid pk`
- `owner_id uuid not null`
- `trusted_person_id uuid not null`
- `user_id uuid not null`
- `device_label text null`
- `device_secret_hash text not null`
- `created_from_invitation_id uuid not null`
- `last_used_at timestamptz null`
- `revoked_at timestamptz null`
- `created_at timestamptz not null default now()`

This record represents server-side enrollment for a browser/device. The browser stores only an opaque device secret or similarly scoped enrollment token, never the raw relationship key in the invitation URL.

### Relationship Key Handling
- Keep `document_relationship_keys` as the server-side canonical relationship key store.
- Do not expose direct browser reads to `document_relationship_keys`.
- During successful invitation redemption, server can deliver a device-scoped encrypted bootstrap package sufficient for the client to unwrap or request document decryption later.
- Prefer device-scoped wrapping over persisting the raw relationship key in `localStorage`.
- If a fully safer device-key wrapping model is too large for this phase, the minimum acceptable fallback is:
  - relationship key still ends up persisted client-side
  - but only after server-validated, one-time invitation redemption
  - and the original URL never contains the relationship key directly
- The invitation URL must never again contain raw key material in the fragment.

### API Changes
#### New owner endpoint
`POST /api/trusted-access/invitations`
- auth: owner only
- input:
  - `trustedPersonId`
- behavior:
  - verify trusted person is linked, accepted, active
  - create replacement invitation if a prior pending one exists
  - return `invitationUrl`, `expiresAt`, `status`
- response additions:
  - `deliveryMode: 'manual'`
  - `singleUse: true`
  - `expiresInMinutes: 15`

#### New recipient bootstrap endpoint
`GET /api/trusted-access/invitations/redeem?token=...`
- auth optional at first hit
- behavior:
  - validate token existence/status
  - if unauthenticated, set signed pending-redemption cookie and redirect to auth
  - if authenticated, verify identity binding and continue to step-up or completion
- no raw secrets in redirects

#### New OTP endpoints
`POST /api/trusted-access/invitations/otp/send`
`POST /api/trusted-access/invitations/otp/verify`
- auth: must match pending redemption user
- send endpoint throttled
- verify endpoint consumes challenge on success

#### New device enrollment completion endpoint
`POST /api/trusted-access/invitations/complete`
- auth required
- requires successful OTP and valid pending redemption
- redeems invitation
- creates `trusted_access_devices` record
- returns device-scoped bootstrap payload or completion status needed by frontend

#### Readiness endpoints adjustments
Existing recipient-facing APIs such as:
- `/api/documents/share-token/received`
- `/api/family/view`
- `/api/family/download`
- `/api/family/members`

must return additive readiness fields reflecting the new model:
- `accessLinkStatus: 'ready' | 'setup_required' | 'expired_invitation' | 'wrong_account' | 'revoked'`
- `requiresAccessLinkSetup: boolean`
- `deviceEnrollmentStatus: 'enrolled' | 'missing' | 'revoked'`
- `userMessageKey` stable enum string for frontend copy mapping

Owner-facing APIs used by `/zugriff` should expose:
- whether documents are shared
- whether a pending invitation exists
- whether it is expired
- whether any device enrollment exists for that trusted person
- whether owner should generate a new invitation

### Authorization Rules
- Redemption requires all of:
  - valid pending invitation
  - authenticated user
  - linked trusted person relationship
  - accepted invitation status
  - `is_active = true`
  - email/account match to intended trusted person
  - successful OTP step-up
- Wrong authenticated user must not be able to redeem by merely knowing the link.
- A redeemed or expired invitation must never be reusable.
- Revoking trusted person access or unlinking must invalidate future access even if device enrollment exists.
- Device enrollment alone is not enough without ongoing trusted-person authorization and active document share checks.

### Logging / Security Guardrails
- `warn` for:
  - expired invitation use
  - wrong-account redemption attempt
  - repeated OTP failures
  - revoked invitation use
- structured `error` only for unexpected system failures
- never log raw token, OTP, relationship key, or device secret
- run `python scripts/ops/logging-audit.py`

## Frontend Changes
### Owner UX
- `Zugriffslink` UI must be reframed as `Sicherer Zugriffslink`.
- Copy/send flow must clearly say:
  - this link is not sent automatically
  - you must send it manually
  - it expires after 15 minutes
  - it works only once
  - if your trusted person signs in with the wrong account, setup fails and you must generate a new link
- After copy:
  - show clear success state
  - show exact next step: “Now send this link to your trusted person”
- Elderly mode:
  - present as numbered wizard/dialog
  - step 1: share documents
  - step 2: create secure access link
  - step 3: send link manually
  - step 4: trusted person signs in with the invited account
  - step 5: trusted person confirms with a code sent to their email
- Owner dashboard should show status per trusted person:
  - no shared documents
  - documents shared but secure access not set up
  - invitation pending / expires soon
  - secure access set up on at least one device
  - invitation expired, create a new link

### Recipient UX
- The recipient should not see vault-key style prompts when the real missing step is secure access setup.
- Opening the secure link while logged out should survive login cleanly.
- If the wrong account is used:
  - show a specific error
  - show which email address was expected if policy allows
  - offer sign out and retry
- OTP step should be explicit and calm.
- After success:
  - show that this browser/device is now set up
  - explain that future shared documents from this owner will work here automatically unless access is removed or browser data is cleared
- Elderly mode:
  - dedicated step-by-step setup screen
  - larger type, short sentences, numbered steps
  - explicit “Use the same email address your trusted person invitation was sent to”
  - explicit recovery path if it fails

### Existing Shared Document Views
- `Geteilte Dokumente` and `vp-dashboard/view/[ownerId]` must:
  - show only explicitly shared documents
  - never show all encrypted documents just because access invitation was created
  - disable encrypted actions only when setup is genuinely missing
  - keep unencrypted documents accessible without unnecessary secure setup gating if product policy allows them to remain unencrypted
- If product policy is “all trusted-person shares should require secure setup regardless of encryption,” apply that consistently and document it. Default recommendation: require secure setup only for encrypted content.

## Code Changes By Area
### Remove current unsafe access-link behavior
- In owner `/zugriff` page:
  - remove logic that bulk-shares every encrypted document when generating the access link
  - generating the access link must only create an invitation
- In access page:
  - remove fragment-based raw relationship-key bootstrap
  - replace with token redemption flow
- In auth callback:
  - add pending-redemption resume handling using signed server-side state/cookie

### New backend security services
Implement reusable services for:
- invitation creation
- token hashing and lookup
- invitation status transitions
- OTP generation, hashing, delivery, verification
- device enrollment creation and validation
- recipient access readiness computation
- invitation revocation/replacement

### Notification delivery
For this phase:
- keep final delivery manual by owner
- OTP email is automatic and mandatory
- do not silently rely on SMS
- if email infrastructure exists, use the trusted person’s invited email already on record
- if delivery fails, do not redeem; show actionable error and allow resend with rate limiting

## Test Plan
### API tests
- owner can create invitation for accepted active trusted person
- creating a new invitation invalidates prior pending invitation
- expired invitation cannot redeem
- redeemed invitation cannot redeem again
- unauthenticated open sets pending redemption state and redirects to login
- authenticated callback resumes pending redemption safely
- wrong account cannot redeem
- correct account receives OTP challenge
- OTP success redeems invitation and creates device enrollment
- OTP failure/expiry does not redeem
- recipient readiness endpoints reflect:
  - `setup_required`
  - `ready`
  - `expired_invitation`
  - `wrong_account`
  - `revoked`
- shared document endpoints only return explicitly shared documents
- generating invitation no longer creates share tokens for unrelated documents

### Frontend/page/component tests
- owner sees manual-send explanation and expiry/single-use messaging
- owner copy action shows clear post-copy next step
- elderly mode renders numbered access-setup flow
- recipient logged-out open survives auth and resumes setup
- wrong-account screen is specific and recoverable
- OTP screen works and handles resend/rate limit messaging
- post-success screen explains device/browser setup persistence
- `Geteilte Dokumente` shows only shared docs
- encrypted actions blocked only when secure setup missing
- no misleading vault key prompt for missing invitation redemption

### Security/regression tests
- no API route logs raw tokens, OTPs, relationship keys, or device secrets
- no browser route directly queries `document_relationship_keys`
- no URL fragment contains raw relationship key after implementation
- redeemed link replay fails
- replaced invitation replay fails
- revoked trusted person loses access even with prior device enrollment
- clearing browser storage or revoking device enrollment forces re-setup

### Verification commands
- `python scripts/ops/logging-audit.py`
- `npm run type-check`
- `npm run lint`
- focused vitest runs for:
  - trusted access invitation APIs
  - auth callback resume logic
  - trusted-person shared document pages
  - owner `/zugriff` flows
- targeted E2E:
  - owner shares one doc
  - owner creates access invitation
  - trusted person opens while logged out
  - logs in with correct account
  - completes OTP
  - sees only the shared doc
  - can reopen later on same browser
  - wrong account flow is blocked
  - replayed link is rejected

## Migration / Compatibility Notes
- This is a schema and flow migration, not a small patch.
- Keep existing `document_relationship_keys` and `document_share_tokens`.
- Add new invitation and device-enrollment tables in additive migrations.
- During rollout, old fragment-style links should be treated as unsupported or migrated behind a temporary compatibility page only if absolutely necessary.
- Recommended default: invalidate old raw-key access links after deployment and require owners to generate new secure links.

## Assumptions
- Sensitive personal documents justify the stricter flow and additional friction.
- Email OTP is acceptable as the mandatory first-redemption step in this phase.
- Manual sending of the invitation link remains acceptable for now.
- Trusted-person identity is primarily bound to the linked invited account; no silent relinking to a different account is allowed during redemption.
- The immediate target is safest practical implementation, not backward compatibility for old access links.
