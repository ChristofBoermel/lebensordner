CREATE TABLE IF NOT EXISTS public.vaccinations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  is_standard  boolean NOT NULL DEFAULT false,
  month        integer NULL CHECK (month BETWEEN 1 AND 12),
  year         integer NULL CHECK (year BETWEEN 1900 AND 2100),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vaccinations_owner ON public.vaccinations;

CREATE POLICY vaccinations_owner
  ON public.vaccinations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
