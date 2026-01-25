-- Add custom reminder days to documents table
-- Allows users to override the default reminder setting on a per-document basis

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS custom_reminder_days INTEGER DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN documents.custom_reminder_days IS 'Optional custom reminder days before expiry. NULL means use profile default.';
