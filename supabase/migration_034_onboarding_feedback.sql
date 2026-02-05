-- Migration 034: Onboarding Feedback Table
-- Tracks user feedback for each onboarding step to improve the experience

CREATE TABLE IF NOT EXISTS onboarding_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  step_name TEXT NOT NULL CHECK (step_name IN ('welcome', 'profile', 'documents', 'emergency', 'complete')),
  clarity_rating INTEGER NOT NULL CHECK (clarity_rating >= 1 AND clarity_rating <= 5),
  was_helpful BOOLEAN,
  comments TEXT,
  time_spent_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE onboarding_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON onboarding_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON onboarding_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (admin) can view all feedback
CREATE POLICY "Service role can view all feedback"
  ON onboarding_feedback
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Indexes for query performance
CREATE INDEX idx_onboarding_feedback_user_id ON onboarding_feedback(user_id);
CREATE INDEX idx_onboarding_feedback_step_name ON onboarding_feedback(step_name);
CREATE INDEX idx_onboarding_feedback_created_at ON onboarding_feedback(created_at);
