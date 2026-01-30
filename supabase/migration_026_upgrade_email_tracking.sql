-- Migration 026: Add upgrade email tracking fields
-- Tracks when promotional/upgrade emails have been sent to prevent duplicates

-- Add column to track when 7-day upgrade email was sent
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS upgrade_email_7d_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add column to track when 30-day upgrade email was sent (for future use)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS upgrade_email_30d_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient querying of users who haven't received emails yet
CREATE INDEX IF NOT EXISTS idx_profiles_upgrade_email_7d
ON profiles (created_at)
WHERE upgrade_email_7d_sent_at IS NULL
  AND subscription_status IS NULL;

COMMENT ON COLUMN profiles.upgrade_email_7d_sent_at IS 'Timestamp when 7-day upgrade email was sent';
COMMENT ON COLUMN profiles.upgrade_email_30d_sent_at IS 'Timestamp when 30-day upgrade email was sent';
