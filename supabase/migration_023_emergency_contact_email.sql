-- Migration 023: Add email field to emergency_contacts
-- Allows storing email addresses for emergency contacts

ALTER TABLE public.emergency_contacts
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_email ON public.emergency_contacts(email);

COMMENT ON COLUMN public.emergency_contacts.email IS 'Email address of the emergency contact';
