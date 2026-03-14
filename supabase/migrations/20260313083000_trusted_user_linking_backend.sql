alter table public.trusted_persons
  add column if not exists relationship_status text,
  add column if not exists invitation_expires_at timestamptz;

update public.trusted_persons
set relationship_status = case
  when is_active = false then 'revoked'
  when invitation_status = 'accepted' then 'accepted_pending_setup'
  when invitation_status in ('pending', 'sent') then 'invited'
  when invitation_status = 'declined' then 'revoked'
  else 'invited'
end
where relationship_status is null;

update public.trusted_persons
set invitation_expires_at = coalesce(invitation_sent_at, created_at) + interval '7 days'
where invitation_expires_at is null;

alter table public.trusted_persons
  alter column relationship_status set default 'invited';

alter table public.trusted_persons
  alter column relationship_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trusted_persons_relationship_status_check'
  ) then
    alter table public.trusted_persons
      add constraint trusted_persons_relationship_status_check
      check (
        relationship_status in (
          'invited',
          'accepted_pending_setup',
          'setup_link_sent',
          'active',
          'revoked'
        )
      );
  end if;
end $$;

create index if not exists idx_trusted_persons_relationship_status
  on public.trusted_persons(user_id, relationship_status);

create index if not exists idx_trusted_persons_linked_relationship_status
  on public.trusted_persons(linked_user_id, relationship_status);

alter table public.trusted_access_invitations
  add column if not exists claimed_at timestamptz,
  add column if not exists otp_verified_at timestamptz;

create table if not exists public.trusted_access_events (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.trusted_persons(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'invited',
      'accepted',
      'setup_link_sent',
      'setup_started',
      'otp_verified',
      'device_enrolled',
      'revoked'
    )
  ),
  occurred_at timestamptz not null default now(),
  owner_seen_at timestamptz,
  trusted_user_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_trusted_access_events_relationship
  on public.trusted_access_events(relationship_id, occurred_at desc);

grant select, insert, update, delete on public.trusted_access_events to service_role;

alter table public.trusted_access_events enable row level security;
