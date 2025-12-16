-- Allow clinic creator to select their own clinic row before membership exists.

drop policy if exists clinics_select on public.clinics;
create policy clinics_select
on public.clinics
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.clinic_members m
    where m.clinic_id = clinics.id
      and m.user_id = auth.uid()
  )
);

