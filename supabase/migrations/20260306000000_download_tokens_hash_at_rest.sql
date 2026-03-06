-- Store download tokens as hashes at rest.
create extension if not exists pgcrypto;

alter table public.download_tokens
  add column if not exists token_hash varchar(64);

update public.download_tokens
set token_hash = encode(digest(token, 'sha256'), 'hex')
where token is not null
  and token_hash is null;

alter table public.download_tokens
  alter column token_hash set not null;

create unique index if not exists idx_download_tokens_token_hash
  on public.download_tokens (token_hash);

alter table public.download_tokens
  alter column token drop not null;

update public.download_tokens
set token = null
where token is not null;

comment on column public.download_tokens.token_hash is
  'SHA-256 hash of the raw download token. Raw token is never stored.';
