-- Add encryption metadata columns for encrypted document storage
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encryption_version text,
  ADD COLUMN IF NOT EXISTS encryption_metadata jsonb;

COMMENT ON COLUMN public.documents.is_encrypted IS 'Whether the stored storage object is encrypted client-side';
COMMENT ON COLUMN public.documents.encryption_version IS 'Client-side document encryption version identifier';
COMMENT ON COLUMN public.documents.encryption_metadata IS 'Encryption metadata payload required for client-side decryption';
