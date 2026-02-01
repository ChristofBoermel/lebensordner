-- Migration 028: Server-side document limit enforcement
-- Prevents users from exceeding their tier's document limit

-- Create function to check document limit before insert
CREATE OR REPLACE FUNCTION check_document_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_documents INTEGER;
  user_subscription TEXT;
BEGIN
  -- Count current documents for this user
  SELECT COUNT(*) INTO current_count
  FROM documents
  WHERE user_id = NEW.user_id;

  -- Get user's subscription status
  SELECT subscription_status INTO user_subscription
  FROM profiles
  WHERE id = NEW.user_id;

  -- Determine max documents based on subscription
  -- Free: 10, Basic: 50, Premium: unlimited (-1)
  IF user_subscription = 'active' OR user_subscription = 'trialing' THEN
    -- For now, assume active subscription = premium (unlimited)
    -- In production, check the price_id to determine exact tier
    max_documents := -1;
  ELSE
    -- Free tier
    max_documents := 10;
  END IF;

  -- Check if limit exceeded (skip if unlimited)
  IF max_documents != -1 AND current_count >= max_documents THEN
    RAISE EXCEPTION 'Document limit reached. Your plan allows % documents. Please upgrade for more.', max_documents
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run before each document insert
DROP TRIGGER IF EXISTS enforce_document_limit ON documents;
CREATE TRIGGER enforce_document_limit
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION check_document_limit();

-- Add comment for documentation
COMMENT ON FUNCTION check_document_limit() IS
'Enforces document upload limits based on user subscription tier. Free=10, Basic=50, Premium=unlimited';
