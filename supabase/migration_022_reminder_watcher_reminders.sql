-- Migration: Add reminder watcher to reminders table
-- This allows users to assign a trusted person to be notified about custom reminders

-- Add reminder_watcher_id column to reminders table
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS reminder_watcher_id UUID REFERENCES trusted_persons(id) ON DELETE SET NULL;

-- Add reminder_watcher_notified_at to track when the watcher was last notified
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS reminder_watcher_notified_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_reminders_watcher ON reminders(reminder_watcher_id) WHERE reminder_watcher_id IS NOT NULL;
