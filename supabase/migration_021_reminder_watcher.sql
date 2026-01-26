-- Migration: Add reminder watcher (trusted person) to documents
-- This allows users to assign a trusted person to be notified when a document reminder is due

-- Add reminder_watcher_id column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reminder_watcher_id UUID REFERENCES trusted_persons(id) ON DELETE SET NULL;

-- Add reminder_watcher_notified_at to track when the watcher was last notified
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reminder_watcher_notified_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_documents_reminder_watcher ON documents(reminder_watcher_id) WHERE reminder_watcher_id IS NOT NULL;
