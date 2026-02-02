-- Migration 029: Add stripe_price_id to profiles table
-- Enables accurate tier detection by storing the Stripe price ID from subscriptions
-- This allows distinguishing between Basic and Premium tiers

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.profiles.stripe_price_id IS 'Stripe price ID from the subscription (e.g., price_xxx for Basic Monthly/Yearly or Premium Monthly/Yearly)';

-- Add index for efficient tier lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_price_id
ON public.profiles (stripe_price_id)
WHERE stripe_price_id IS NOT NULL;
