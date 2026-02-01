-- Fix for generic upload error 22P02: invalid input value for enum document_category
-- Adding missing enum values that exist in the frontend but not in the database

ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'familie';
ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'arbeit';
ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'religion';
ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'sonstige';
