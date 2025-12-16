-- Ensure clinic creators are always owners, and enforce owner-role on creator membership insert.

-- Backfill: if a creator membership exists but is 'staff', fix to 'owner'.
update public.clinic_members m
set role = 'owner'
from public.clinics c
where m.clinic_id = c.id
  and m.user_id = c.created_by
  and m.role <> 'owner';

drop policy if exists clinic_members_insert_owner on public.clinic_members;
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

