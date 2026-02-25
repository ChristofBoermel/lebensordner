ALTER TABLE public.document_share_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL;

ALTER TABLE public.document_share_tokens
  ADD COLUMN IF NOT EXISTS permission text NOT NULL DEFAULT 'view';

ALTER TABLE public.document_share_tokens
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL;

DROP POLICY IF EXISTS share_tokens_tp_select ON public.document_share_tokens;

CREATE POLICY share_tokens_tp_select
  ON public.document_share_tokens
  FOR SELECT
  USING (
    trusted_person_id IN (
      SELECT id FROM public.trusted_persons WHERE linked_user_id = auth.uid()
    )
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );
