-- NOTE: This migration was never applied to production; the encryption_metadata column does not exist and should not be used.
-- Add encryption metadata columns for encrypted document storage
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encryption_version text,
  ADD COLUMN IF NOT EXISTS encryption_metadata jsonb;

COMMENT ON COLUMN public.documents.is_encrypted IS 'Whether the stored storage object is encrypted client-side';
COMMENT ON COLUMN public.documents.encryption_version IS 'Client-side document encryption version identifier';
COMMENT ON COLUMN public.documents.encryption_metadata IS 'Encryption metadata payload required for client-side decryption';
