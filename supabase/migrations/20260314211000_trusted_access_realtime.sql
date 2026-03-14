drop policy if exists "Linked users can view accepted trusted-person rows"
  on public.trusted_persons;

create policy "Linked users can view accepted trusted-person rows"
  on public.trusted_persons
  for select
  to authenticated
  using (
    linked_user_id = auth.uid()
    and invitation_status = 'accepted'
    and is_active = true
  );

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'trusted_persons'
    ) then
      execute 'alter publication supabase_realtime add table public.trusted_persons';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'document_share_tokens'
    ) then
      execute 'alter publication supabase_realtime add table public.document_share_tokens';
    end if;
  end if;
end
$$;
