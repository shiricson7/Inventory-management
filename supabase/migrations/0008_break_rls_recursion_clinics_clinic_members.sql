-- Break cross-table RLS recursion between clinics <-> clinic_members.
--
-- Problem pattern:
-- - clinic_members policies query clinics
-- - clinics_select policy queries clinic_members
-- => Postgres detects infinite recursion (42P17).
--
-- Fix:
-- - Introduce a SECURITY DEFINER helper that checks creator without invoking clinics RLS.
-- - Recreate clinic_members policies to use the helper (no direct clinics query).
-- - Ensure accept_clinic_invite also runs with row_security=off for reliable inserts.

create or replace function public.is_clinic_creator(p_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.clinics c
    where c.id = p_clinic_id
      and c.created_by = auth.uid()
  );
$$;

revoke all on function public.is_clinic_creator(uuid) from public;
grant execute on function public.is_clinic_creator(uuid) to authenticated;

-- Reset clinic_members policies to avoid touching clinics directly.
drop policy if exists clinic_members_select on public.clinic_members;
drop policy if exists clinic_members_insert_owner on public.clinic_members;
drop policy if exists clinic_members_delete_owner on public.clinic_members;

create policy clinic_members_select
on public.clinic_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_clinic_creator(clinic_id)
);

create policy clinic_members_insert_owner
on public.clinic_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and public.is_clinic_creator(clinic_id)
);

create policy clinic_members_delete_owner
on public.clinic_members
for delete
to authenticated
using (public.is_clinic_creator(clinic_id));

-- Make invitation acceptance robust to RLS by turning row_security off inside the RPC.
create or replace function public.accept_clinic_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  inv record;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into inv
  from public.clinic_invitations
  where token = invite_token
    and used_at is null
    and expires_at > now()
  limit 1;

  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  insert into public.clinic_members (clinic_id, user_id, role)
  values (inv.clinic_id, uid, inv.role)
  on conflict (clinic_id, user_id) do nothing;

  update public.clinic_invitations
  set used_at = now(), used_by = uid
  where id = inv.id;

  insert into public.profiles (user_id, current_clinic_id)
  values (uid, inv.clinic_id)
  on conflict (user_id) do update
  set current_clinic_id = coalesce(public.profiles.current_clinic_id, excluded.current_clinic_id);

  return inv.clinic_id;
end;
$$;

revoke all on function public.accept_clinic_invite(uuid) from public;
grant execute on function public.accept_clinic_invite(uuid) to authenticated;

