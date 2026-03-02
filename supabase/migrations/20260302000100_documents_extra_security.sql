-- Add optional per-document security toggle.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS extra_security_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.documents.extra_security_enabled IS
  'When true, document access requires an unlocked vault session.';
