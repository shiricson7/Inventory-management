-- Fix infinite recursion in clinic_members select RLS policy by avoiding self-references.

drop policy if exists clinic_members_select on public.clinic_members;
create policy clinic_members_select
on public.clinic_members
for select
to authenticated
using (
  -- Always allow users to see their own membership rows.
  user_id = auth.uid()
  -- Also allow the clinic creator (owner) to list all members in their clinic.
  or exists (
    select 1
    from public.clinics c
    where c.id = clinic_members.clinic_id
      and c.created_by = auth.uid()
  )
);

