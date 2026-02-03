-- Prevent duplicate emails for the same owner
CREATE UNIQUE INDEX IF NOT EXISTS unique_trusted_person_email_per_user
ON trusted_persons(user_id, LOWER(email))
WHERE is_active = true;

-- Add comment for documentation
COMMENT ON INDEX unique_trusted_person_email_per_user IS
'Ensures each user cannot add the same email as a trusted person multiple times (case-insensitive, only for active records)';
