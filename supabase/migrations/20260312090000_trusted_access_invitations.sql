create table if not exists public.trusted_access_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  trusted_person_id uuid not null references public.trusted_persons(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'redeemed', 'expired', 'revoked', 'replaced')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_user_id uuid references auth.users(id) on delete set null,
  redeemed_device_id uuid,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  replaced_by_invitation_id uuid references public.trusted_access_invitations(id) on delete set null,
  last_sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_trusted_access_invitations_owner_tp
  on public.trusted_access_invitations(owner_id, trusted_person_id, created_at desc);

create index if not exists idx_trusted_access_invitations_status_expires
  on public.trusted_access_invitations(status, expires_at);

create table if not exists public.trusted_access_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.trusted_access_invitations(id) on delete cascade,
  trusted_person_id uuid not null references public.trusted_persons(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  created_at timestamptz not null default now()
);

create index if not exists idx_trusted_access_otp_invitation
  on public.trusted_access_otp_challenges(invitation_id, created_at desc);

create table if not exists public.trusted_access_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  trusted_person_id uuid not null references public.trusted_persons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text,
  device_secret_hash text not null,
  created_from_invitation_id uuid not null references public.trusted_access_invitations(id) on delete cascade,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_trusted_access_devices_lookup
  on public.trusted_access_devices(owner_id, trusted_person_id, user_id, revoked_at);

alter table public.trusted_access_invitations
  add constraint trusted_access_invitations_redeemed_device_fk
  foreign key (redeemed_device_id) references public.trusted_access_devices(id) on delete set null;

grant select, insert, update, delete on public.trusted_access_invitations to service_role;
grant select, insert, update, delete on public.trusted_access_otp_challenges to service_role;
grant select, insert, update, delete on public.trusted_access_devices to service_role;

alter table public.trusted_access_invitations enable row level security;
alter table public.trusted_access_otp_challenges enable row level security;
alter table public.trusted_access_devices enable row level security;
