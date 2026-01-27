-- Migration 025: Add profile picture support
-- Allows users to upload a custom profile picture

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

COMMENT ON COLUMN public.profiles.profile_picture_url IS 'URL to the user profile picture in storage';

-- Create avatars bucket if not exists (run manually if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;
