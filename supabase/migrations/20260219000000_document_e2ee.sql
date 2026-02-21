alter table public.documents
  add column if not exists wrapped_dek text,
  add column if not exists file_iv text,
  add column if not exists title_encrypted text,
  add column if not exists notes_encrypted text,
  add column if not exists file_name_encrypted text;

create table if not exists public.user_vault_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  kdf_salt text not null,
  kdf_params jsonb not null,
  wrapped_mk text not null,
  wrapped_mk_with_recovery text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.user_vault_keys enable row level security;

create policy "user_vault_keys_owner_access" on public.user_vault_keys
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.document_relationship_keys (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  trusted_person_id uuid not null references auth.users(id) on delete cascade,
  wrapped_dek_for_tp text not null,
  created_at timestamptz default now() not null,
  unique (document_id, trusted_person_id)
);

alter table public.document_relationship_keys enable row level security;

create policy "document_relationship_keys_owner_manage" on public.document_relationship_keys
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "document_relationship_keys_trusted_person_select" on public.document_relationship_keys
  for select using (trusted_person_id = auth.uid());

create table if not exists public.document_share_tokens (
  id uuid primary key default gen_random_uuid(),
  download_token_id uuid not null references public.download_tokens(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  wrapped_dek_for_share text not null,
  created_at timestamptz default now(),
  unique (download_token_id, document_id)
);

alter table public.document_share_tokens enable row level security;

create policy "document_share_tokens_owner_manage" on public.document_share_tokens
  for all using (
    exists (
      select 1
      from public.documents
      where public.documents.id = document_id
        and public.documents.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.documents
      where public.documents.id = document_id
        and public.documents.user_id = auth.uid()
    )
  );

create table if not exists public.download_link_documents (
  id uuid primary key default gen_random_uuid(),
  download_token_id uuid not null references public.download_tokens(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz default now(),
  unique (download_token_id, document_id)
);

create index if not exists download_link_documents_download_token_id_idx
  on public.download_link_documents (download_token_id);

create table if not exists public.download_link_wrapped_deks (
  id uuid primary key default gen_random_uuid(),
  download_token_id uuid not null references public.download_tokens(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  wrapped_dek_for_share text not null,
  file_iv text not null,
  file_name_encrypted text,
  created_at timestamptz default now(),
  unique (download_token_id, document_id)
);

create index if not exists download_link_wrapped_deks_download_token_id_idx
  on public.download_link_wrapped_deks (download_token_id);
