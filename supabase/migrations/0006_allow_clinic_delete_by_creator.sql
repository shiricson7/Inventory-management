-- Allow clinic creator to delete their clinic.

drop policy if exists clinics_delete on public.clinics;
create policy clinics_delete
on public.clinics
for delete
to authenticated
using (created_by = auth.uid());

