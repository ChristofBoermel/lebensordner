-- Migration 027: Add missing document categories to enum
-- The TypeScript code defines more categories than exist in the database enum

-- Add missing categories to the document_category enum
-- PostgreSQL requires this specific syntax for adding values to an enum

ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'familie';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'arbeit';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'religion';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'sonstige';

-- Note: ALTER TYPE ADD VALUE cannot be run inside a transaction block
-- If running manually, execute each line separately or use:
-- COMMIT; before each ALTER TYPE statement
