-- Backfill accepted trusted-person invitations that were never linked to an account.
-- Dry-run before update:
--   select count(*) as pending_unlinked
--   from public.trusted_persons tp
--   where tp.invitation_status = 'accepted'
--     and tp.linked_user_id is null
--     and exists (
--       select 1
--       from public.profiles p
--       where lower(trim(p.email)) = lower(trim(tp.email))
--     );
--
-- Post-check after update:
--   select count(*) as still_unlinked_with_profile
--   from public.trusted_persons tp
--   where tp.invitation_status = 'accepted'
--     and tp.linked_user_id is null
--     and exists (
--       select 1
--       from public.profiles p
--       where lower(trim(p.email)) = lower(trim(tp.email))
--     );

with matched_links as (
  select
    tp.id as trusted_person_id,
    p.id as linked_user_id
  from public.trusted_persons tp
  join lateral (
    select profile.id
    from public.profiles profile
    where lower(trim(profile.email)) = lower(trim(tp.email))
    order by profile.id
    limit 1
  ) p on true
  where tp.invitation_status = 'accepted'
    and tp.linked_user_id is null
)
update public.trusted_persons tp
set linked_user_id = matched_links.linked_user_id
from matched_links
where tp.id = matched_links.trusted_person_id
  and tp.linked_user_id is null;
