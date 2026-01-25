-- Download Tokens for One-Time Document Downloads
-- Allows users to share a time-limited download link without requiring recipient login

CREATE TABLE IF NOT EXISTS download_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  recipient_name VARCHAR(255),
  recipient_email VARCHAR(255)
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
CREATE INDEX IF NOT EXISTS idx_download_tokens_user ON download_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires ON download_tokens(expires_at);

-- RLS Policies
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own download tokens"
  ON download_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create tokens for themselves
CREATE POLICY "Users can create their own download tokens"
  ON download_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own download tokens"
  ON download_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own download tokens"
  ON download_tokens FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE download_tokens IS 'Stores one-time download tokens for sharing documents without login';
COMMENT ON COLUMN download_tokens.token IS 'Unique token string for the download link';
COMMENT ON COLUMN download_tokens.expires_at IS 'Token expires after this time (default 12 hours)';
COMMENT ON COLUMN download_tokens.used_at IS 'Timestamp when the token was used for download';
