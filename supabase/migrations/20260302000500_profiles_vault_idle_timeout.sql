-- Add idle auto-lock timeout preference for the vault.
alter table public.profiles
  add column if not exists vault_idle_timeout_minutes integer not null default 15;

comment on column public.profiles.vault_idle_timeout_minutes is
  'Minutes of inactivity before the vault auto-locks. 0 = never. Valid values: 0, 5, 15, 30, 60. Enforced at application layer.';
