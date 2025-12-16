-- Clinic invitations + owner member listing

create table if not exists public.clinic_invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  token uuid not null unique,
  role public.member_role not null default 'staff',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  constraint clinic_invitations_used_pair check ((used_at is null) = (used_by is null))
);

alter table public.clinic_invitations enable row level security;

-- Allow owners to see all members in their clinic (still allow anyone to see their own membership).
drop policy if exists clinic_members_select on public.clinic_members;
create policy clinic_members_select
on public.clinic_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.clinic_members self
    where self.clinic_id = clinic_members.clinic_id
      and self.user_id = auth.uid()
      and self.role = 'owner'
  )
);

-- Invitations: owners can manage for their clinic.
drop policy if exists clinic_invitations_select_owner on public.clinic_invitations;
create policy clinic_invitations_select_owner
on public.clinic_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.clinic_members m
    where m.clinic_id = clinic_invitations.clinic_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

drop policy if exists clinic_invitations_insert_owner on public.clinic_invitations;
create policy clinic_invitations_insert_owner
on public.clinic_invitations
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.clinic_members m
    where m.clinic_id = clinic_invitations.clinic_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

drop policy if exists clinic_invitations_delete_owner on public.clinic_invitations;
create policy clinic_invitations_delete_owner
on public.clinic_invitations
for delete
to authenticated
using (
  exists (
    select 1
    from public.clinic_members m
    where m.clinic_id = clinic_invitations.clinic_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

-- Accept invitation: done via security definer RPC to avoid leaking tokens via RLS.
create or replace function public.accept_clinic_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
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

