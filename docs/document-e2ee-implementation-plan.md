# End-to-end encryption plan for uploaded documents

## Why this is needed
Today, document files are uploaded as plaintext bytes to the `documents` bucket via `POST /api/documents/upload`.
That means anyone with direct Supabase project access (including project owners) can open raw files in Storage.

If the goal is: **"even Supabase project owners must not be able to read uploaded documents"**, then Storage-side privacy/RLS alone is not enough. You need **client-side end-to-end encryption (E2EE)** where plaintext exists only in the user’s browser.

## Current codebase findings (relevant paths)

- Upload path is plaintext file upload from API route to Supabase Storage:
  - `src/app/api/documents/upload/route.ts`
- User downloads use signed URLs (still plaintext in bucket):
  - `src/app/(dashboard)/dokumente/page.tsx` (`createSignedUrl`)
  - `src/app/(dashboard)/notfall/page.tsx` (`createSignedUrl`)
- Shared/family/download-link flows stream bytes from Storage through server APIs:
  - `src/app/api/family/view/stream/route.ts`
  - `src/app/api/family/download/route.ts`
  - `src/app/api/download-link/[token]/view/stream/route.ts`
- Export currently explicitly treats documents as not encrypted:
  - `src/app/(dashboard)/export/page.tsx`
- Existing `src/lib/security/encryption.ts` is server-side key encryption (`ENCRYPTION_KEY`), which does **not** satisfy "Supabase owner cannot read files" for uploaded documents.

## Target security model

### Hard requirement
- Stored document blob in Supabase must be ciphertext only.
- No server-side secret (env var, service role, edge function secret) should be sufficient to decrypt document files.

### Practical requirement
- Authenticated owner can decrypt in browser.
- Optional: trusted-person viewing/downloading should remain possible through explicit key sharing.

## Recommended architecture

### 1) Encrypt files in browser before upload
- Generate random per-document key `DEK` (AES-256-GCM).
- Encrypt file bytes in browser using Web Crypto.
- Upload ciphertext to Storage (`application/octet-stream`), not original MIME bytes.

### 2) Protect DEK with user key material
Use envelope encryption:
- Create user master key `MK` from passphrase with Argon2id/scrypt + strong params + salt.
- Wrap `DEK` with `MK` (`wrapped_dek`).
- Store `wrapped_dek`, key derivation metadata, and algorithm version in DB metadata.

Important:
- Server should never receive plaintext passphrase.
- Server should never possess plaintext `MK`.

### 3) Minimize metadata leakage
If you also want to hide semantic hints from project owners:
- Encrypt `title`, `notes`, `metadata`, original filename, maybe category/subcategory labels.
- Keep only minimal routing metadata in cleartext (e.g., owner id, created_at, size estimate).

### 4) Decrypt only on client
- Download ciphertext from Storage (signed URL or authenticated download).
- Browser unwraps DEK, decrypts blob, and renders/downloads plaintext locally.

## Database/storage changes

## Migration A: document envelope columns
Add columns to `documents`:
- `encryption_version text` (e.g. `e2ee-v1`)
- `wrapped_dek text` (base64/JSON)
- `dek_wrap_alg text`
- `file_iv text`
- `file_auth_tag text`
- `ciphertext_sha256 text` (integrity/checksum optional)
- `is_encrypted boolean default false`
- `original_mime_encrypted text` (or inside encrypted metadata payload)

Alternative: single `encryption_meta jsonb` + `is_encrypted`.

## Migration B: user key material table
Create table `user_key_material`:
- `user_id uuid pk`
- `kdf_alg text` (`argon2id`)
- `kdf_params jsonb`
- `kdf_salt text`
- `wrapped_mk text` (if you use recovery/rotation model)
- `key_version int`
- `created_at`, `updated_at`

RLS: user can only access own key-material row.

## API and frontend integration plan

### Phase 1 — crypto primitives and typed envelope
- Add `src/lib/security/document-e2ee.ts` (browser-safe):
  - file encrypt/decrypt helpers
  - wrap/unwrap key helpers
  - payload schema validation
- Add unit tests for deterministic roundtrip behavior and tamper detection.

### Phase 2 — upload flow conversion
- Update `src/app/(dashboard)/dokumente/page.tsx` `handleUpload`:
  - encrypt file client-side
  - send ciphertext blob + envelope metadata to `/api/documents/upload`
- Update `src/app/api/documents/upload/route.ts`:
  - validate envelope fields
  - store ciphertext as opaque binary
  - persist encryption metadata in `documents` row

### Phase 3 — view/download conversion
Replace direct signed URL open for docs with client decryption pipeline:
- `src/app/(dashboard)/dokumente/page.tsx`
- `src/app/(dashboard)/notfall/page.tsx`

Flow:
1. fetch ciphertext
2. decrypt in browser
3. render preview / trigger download

### Phase 4 — sharing/trusted-person flows
Current server-stream routes break E2EE assumptions unless recipient gets keys.
Two options:
- **Option A (strict E2EE first):** disable trusted-person direct file access for encrypted docs initially.
- **Option B (full feature parity):** add recipient key pairs and per-recipient wrapped DEK rows.

Recommended rollout: start with Option A to reduce risk, then add Option B.

### Phase 5 — export/download-link compatibility
- Update export pipeline to decrypt in client before zip generation.
- For link-based external downloads, either:
  1. serve ciphertext + browser decryption UX, or
  2. require owner-mediated temporary re-encryption for recipient.

## Handling existing plaintext documents

- Add a background/UX migration:
  - list plaintext docs (`is_encrypted = false`)
  - client downloads plaintext (owner session), encrypts locally, re-uploads ciphertext, updates row atomically
- During migration period, support mixed mode reads.

## Product/security UX decisions required

1. **Passphrase lifecycle**: when/how user sets document vault passphrase.
2. **Recovery**: if passphrase is lost, files are unrecoverable unless recovery key is configured.
3. **Multi-device onboarding**: key sync vs manual recovery phrase.
4. **Search/indexing tradeoff**: encrypted metadata limits server-side filtering and full-text search.
5. **Shared access semantics**: explicit key sharing workflow for trusted persons.

## Suggested rollout checklist

1. Add schema + feature flag (`document_e2ee_enabled`).
2. Implement upload encryption for new docs behind flag.
3. Implement client-side decrypt for owner view/download.
4. Add telemetry + integrity checks.
5. Ship plaintext-to-ciphertext migration assistant.
6. Move sharing/export flows to encrypted-compatible paths.
7. Enforce `is_encrypted=true` for all new uploads and eventually block plaintext uploads.

## Acceptance criteria

- Raw Supabase Storage object is unreadable binary/ciphertext.
- Supabase dashboard preview of uploaded docs is unintelligible.
- Owner can still open/download documents in app.
- Server logs and DB rows never contain plaintext file contents.
- Key rotation and passphrase reset behaviors are explicitly documented.

## Notes on current server-side encryption utilities

The existing `ENCRYPTION_KEY` utility is still useful for server-side encrypted fields (PII columns), but it is not sufficient for "platform owner cannot view files" protection because server environment secrets remain under project control.

For this requirement, file encryption keys must remain client-controlled.
