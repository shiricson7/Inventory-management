-- Inventory Management (clinic) schema

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type public.member_role as enum ('owner', 'staff');
  end if;
  if not exists (select 1 from pg_type where typname = 'txn_type') then
    create type public.txn_type as enum ('in', 'out', 'adjust');
  end if;
end$$;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_members (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  current_clinic_id uuid references public.clinics (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  unit text not null default '개',
  reorder_threshold int not null default 0,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  type public.txn_type not null,
  qty int not null check (qty <> 0),
  memo text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create or replace view public.item_stock
with (security_invoker = on) as
select
  i.id as item_id,
  i.clinic_id,
  coalesce(
    sum(
      case t.type
        when 'in' then t.qty
        when 'out' then -t.qty
        when 'adjust' then t.qty
      end
    ),
    0
  )::int as stock
from public.items i
left join public.inventory_transactions t on t.item_id = i.id
where i.is_archived = false
group by i.id, i.clinic_id;

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.inventory_transactions enable row level security;

-- Clinics
drop policy if exists clinics_select on public.clinics;
create policy clinics_select
on public.clinics
for select
to authenticated
using (
  exists (
    select 1
    from public.clinic_members m
    where m.clinic_id = clinics.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists clinics_insert on public.clinics;
create policy clinics_insert
on public.clinics
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists clinics_update on public.clinics;
create policy clinics_update
on public.clinics
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- Clinic members (minimal: users can see their own membership rows)
drop policy if exists clinic_members_select on public.clinic_members;
create policy clinic_members_select
on public.clinic_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists clinic_members_insert_owner on public.clinic_members;
create policy clinic_members_insert_owner
on public.clinic_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clinics c
    where c.id = clinic_members.clinic_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists clinic_members_delete_owner on public.clinic_members;
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

-- Profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Categories
drop policy if exists categories_select on public.categories;
create policy categories_select
on public.categories
for select
to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = categories.clinic_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists categories_insert on public.categories;
create policy categories_insert
on public.categories
for insert
to authenticated
with check (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = categories.clinic_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists categories_update on public.categories;
create policy categories_update
on public.categories
for update
to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = categories.clinic_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = categories.clinic_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists categories_delete on public.categories;
create policy categories_delete
on public.categories
for delete
to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = categories.clinic_id
      and m.user_id = auth.uid()
  )
);

-- Items
drop policy if exists items_select on public.items;
create policy items_select
on public.items
for select
to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = items.clinic_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists items_insert on public.items;
create policy items_insert
on public.items
for insert
to authenticated
with check (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = items.clinic_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists items_update on public.items;
create policy items_update
on public.items
for update
to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = items.clinic_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = items.clinic_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists items_delete on public.items;
create policy items_delete
on public.items
for delete
to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = items.clinic_id
      and m.user_id = auth.uid()
  )
);

-- Transactions
drop policy if exists inventory_tx_select on public.inventory_transactions;
create policy inventory_tx_select
on public.inventory_transactions
for select
to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = inventory_transactions.clinic_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists inventory_tx_insert on public.inventory_transactions;
create policy inventory_tx_insert
on public.inventory_transactions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.clinic_members m
    where m.clinic_id = inventory_transactions.clinic_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists inventory_tx_delete on public.inventory_transactions;
create policy inventory_tx_delete
on public.inventory_transactions
for delete
to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = inventory_transactions.clinic_id
      and m.user_id = auth.uid()
  )
);

-- Timestamp helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row execute function public.set_updated_at();
