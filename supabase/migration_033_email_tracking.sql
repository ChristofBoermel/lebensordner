-- Migration: Add email tracking fields to trusted_persons and create email retry queue
-- This migration adds support for email timeout handling and retry mechanisms

-- Add email tracking columns to trusted_persons table
ALTER TABLE trusted_persons
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_error TEXT,
ADD COLUMN IF NOT EXISTS email_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_status TEXT CHECK (email_status IN ('pending', 'sending', 'sent', 'failed'));

-- Create email retry queue table
CREATE TABLE IF NOT EXISTS email_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trusted_person_id UUID NOT NULL REFERENCES trusted_persons(id) ON DELETE CASCADE,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_retry_queue_status_next_retry
ON email_retry_queue(status, next_retry_at)
WHERE status = 'pending';

-- Create index for finding queue items by trusted person
CREATE INDEX IF NOT EXISTS idx_email_retry_queue_trusted_person
ON email_retry_queue(trusted_person_id);

-- Add RLS policies for email_retry_queue (service role only)
ALTER TABLE email_retry_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access email_retry_queue
CREATE POLICY "Service role can manage email retry queue"
ON email_retry_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comment on new columns
COMMENT ON COLUMN trusted_persons.email_sent_at IS 'Timestamp when the invitation email was successfully sent';
COMMENT ON COLUMN trusted_persons.email_error IS 'Last error message from failed email send attempt';
COMMENT ON COLUMN trusted_persons.email_retry_count IS 'Number of email send retry attempts';
COMMENT ON COLUMN trusted_persons.email_status IS 'Current status of email delivery: pending, sending, sent, or failed';

COMMENT ON TABLE email_retry_queue IS 'Queue for retrying failed email sends with exponential backoff';
COMMENT ON COLUMN email_retry_queue.trusted_person_id IS 'Reference to the trusted person whose invitation email failed';
COMMENT ON COLUMN email_retry_queue.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN email_retry_queue.last_error IS 'Error message from the last failed attempt';
COMMENT ON COLUMN email_retry_queue.next_retry_at IS 'Timestamp for when to attempt the next retry';
COMMENT ON COLUMN email_retry_queue.status IS 'Queue item status: pending, processing, completed, or failed';
