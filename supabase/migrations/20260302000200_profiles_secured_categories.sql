-- Add per-profile secured category keys used by documents extra-security flow.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS secured_categories text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.secured_categories IS
  'List of category keys (including custom:<id>) requiring vault unlock before access.';
