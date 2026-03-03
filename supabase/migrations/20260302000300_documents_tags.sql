-- Add tags array to documents for plaintext label storage.
alter table public.documents
  add column if not exists tags text[] not null default '{}';

create index if not exists documents_tags_gin_idx
  on public.documents using gin (tags);

comment on column public.documents.tags is
  'Plaintext tags for document labels (not encrypted); maximum 10 tags enforced at the application layer.';
