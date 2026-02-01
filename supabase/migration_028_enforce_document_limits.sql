-- Enforce document limits on server side
-- Free tier: 10 documents
-- Paid tiers: Handled laxly here (unlimited) because we lack price_id in profiles to distinguish Basic (50) vs Premium (Unlimited)

CREATE OR REPLACE FUNCTION check_document_limits()
RETURNS TRIGGER AS $$
DECLARE
  sub_status text;
  doc_count int;
  max_docs int;
BEGIN
  -- Get subscription status
  SELECT subscription_status INTO sub_status
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Logic for Free Tier detection
  IF sub_status IS NULL OR sub_status = 'canceled' THEN
    max_docs := 10;
    
    SELECT count(*) INTO doc_count
    FROM public.documents
    WHERE user_id = NEW.user_id;

    IF doc_count >= max_docs THEN
      RAISE EXCEPTION 'Document limit reached for Free Tier (% documents max). Please upgrade to upload more.', max_docs;
    END IF;
  END IF;

  -- For active subscriptions, we currently allow upload (bypass limit check) 
  -- because we cannot distinguish Basic vs Premium easily in SQL without price_id.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_document_limit ON public.documents;

CREATE TRIGGER enforce_document_limit
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION check_document_limits();
