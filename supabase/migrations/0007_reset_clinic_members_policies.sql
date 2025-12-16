-- Reset clinic_members RLS policies to avoid any self-referential recursion.

-- Drop potentially recursive / legacy policies (ignore if missing).
drop policy if exists clinic_members_select on public.clinic_members;
drop policy if exists clinic_members_insert_owner on public.clinic_members;
drop policy if exists clinic_members_delete_owner on public.clinic_members;

-- SELECT:
-- - Users can always see their own membership rows.
-- - Clinic creator (created_by) can list all members in their clinic.
create policy clinic_members_select
on public.clinic_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.clinics c
    where c.id = clinic_members.clinic_id
      and c.created_by = auth.uid()
  )
);

-- INSERT:
-- - Only the clinic creator can create the initial owner membership for themselves.
create policy clinic_members_insert_owner
on public.clinic_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.clinics c
    where c.id = clinic_members.clinic_id
      and c.created_by = auth.uid()
  )
);

-- DELETE:
-- - Only the clinic creator can remove members (including themselves) from their clinic.
create policy clinic_members_delete_owner
on public.clinic_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.clinics c
    where c.id = clinic_members.clinic_id
      and c.created_by = auth.uid()
  )
);

