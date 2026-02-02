-- Add link_type column to download_tokens table
ALTER TABLE download_tokens
ADD COLUMN link_type TEXT NOT NULL DEFAULT 'download'
CHECK (link_type IN ('view', 'download'));

-- Add index for better query performance
CREATE INDEX idx_download_tokens_link_type ON download_tokens(link_type);
