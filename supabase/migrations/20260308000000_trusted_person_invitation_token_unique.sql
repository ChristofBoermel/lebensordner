-- Ensure invitation tokens are unique across trusted_persons rows.
-- This prevents ambiguous .single() token lookups in invitation APIs.

WITH duplicate_tokens AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY invitation_token
      ORDER BY created_at NULLS LAST, id
    ) AS row_number_in_token
  FROM public.trusted_persons
  WHERE invitation_token IS NOT NULL
)
UPDATE public.trusted_persons tp
SET invitation_token = gen_random_uuid()::text
FROM duplicate_tokens dt
WHERE tp.id = dt.id
  AND dt.row_number_in_token > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_persons_invitation_token_unique
ON public.trusted_persons (invitation_token)
WHERE invitation_token IS NOT NULL;
