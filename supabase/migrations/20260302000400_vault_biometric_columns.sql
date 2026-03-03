-- Add biometric/WebAuthn PRF unlock support columns for user vault keys.
alter table public.user_vault_keys
  add column if not exists wrapped_mk_with_biometric text,
  add column if not exists webauthn_credential_id text,
  add column if not exists webauthn_rp_id text;

comment on column public.user_vault_keys.wrapped_mk_with_biometric is
  'PRF-wrapped master key used for biometric/WebAuthn unlock.';

comment on column public.user_vault_keys.webauthn_credential_id is
  'Base64-encoded WebAuthn credential ID associated with biometric unlock.';

comment on column public.user_vault_keys.webauthn_rp_id is
  'WebAuthn RP ID used when creating/verifying the biometric credential.';
