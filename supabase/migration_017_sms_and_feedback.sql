-- Migration 017: SMS notifications and feedback support
-- Run this migration in your Supabase SQL editor

-- Add SMS notification settings to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS sms_reminders_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_reminder_days_before INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on feedback
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert feedback
CREATE POLICY "Users can create feedback" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Add sms_sent field to reminders (similar to email_sent)
ALTER TABLE reminders
ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT false;

-- Add sms_reminder_sent field to documents
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS sms_reminder_sent BOOLEAN DEFAULT false;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
