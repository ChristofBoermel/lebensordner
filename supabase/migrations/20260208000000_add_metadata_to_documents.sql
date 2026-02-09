-- Add metadata jsonb column to documents table for category-specific metadata
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN documents.metadata IS 'Category-specific metadata fields (e.g., Ausweisnummer, Versicherungsnummer) stored as JSON';
