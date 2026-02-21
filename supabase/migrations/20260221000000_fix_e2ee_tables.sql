ALTER TABLE public.user_vault_keys ADD COLUMN IF NOT EXISTS recovery_key_salt text;

DROP TABLE IF EXISTS public.document_share_tokens;
DROP TABLE IF EXISTS public.document_relationship_keys;

CREATE TABLE public.document_relationship_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trusted_person_id uuid NOT NULL REFERENCES public.trusted_persons(id) ON DELETE CASCADE,
  wrapped_rk text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, trusted_person_id)
);

ALTER TABLE public.document_relationship_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY relationship_keys_owner
  ON public.document_relationship_keys
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY relationship_keys_tp_select
  ON public.document_relationship_keys
  FOR SELECT
  USING (
    trusted_person_id IN (
      SELECT id
      FROM public.trusted_persons
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE TABLE public.document_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trusted_person_id uuid NOT NULL REFERENCES public.trusted_persons(id) ON DELETE CASCADE,
  wrapped_dek_for_tp text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, trusted_person_id)
);

ALTER TABLE public.document_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_tokens_owner_manage
  ON public.document_share_tokens
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY share_tokens_tp_select
  ON public.document_share_tokens
  FOR SELECT
  USING (
    trusted_person_id IN (
      SELECT id
      FROM public.trusted_persons
      WHERE linked_user_id = auth.uid()
    )
  );
