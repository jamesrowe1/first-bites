-- FIRST BITES v2: multi-user household schema
-- Run this in Supabase -> SQL Editor.
-- It intentionally uses new table names (child_food_logs, child_favorites, etc.)
-- so an earlier single-user starter schema can coexist without deleting data.

create extension if not exists pgcrypto;
create schema if not exists private;

-- ---------- Core tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_food_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  logged_by uuid not null references auth.users(id) on delete restrict,
  food_id text not null,
  eaten_at timestamptz not null default now(),
  liked text check (liked in ('liked', 'neutral', 'disliked')),
  reaction text not null default 'none' check (reaction in ('none', 'possible', 'mild', 'significant')),
  amount text,
  notes text,
  first_exposure boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.child_favorites (
  child_id uuid not null references public.children(id) on delete cascade,
  food_id text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (child_id, food_id)
);

create index if not exists household_members_user_idx on public.household_members(user_id, household_id);
create index if not exists children_household_idx on public.children(household_id, created_at);
create index if not exists child_food_logs_child_eaten_idx on public.child_food_logs(child_id, eaten_at desc);
create index if not exists child_food_logs_logged_by_idx on public.child_food_logs(logged_by);
create index if not exists child_favorites_child_idx on public.child_favorites(child_id);

-- ---------- updated_at helper ----------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists households_touch_updated_at on public.households;
create trigger households_touch_updated_at before update on public.households
for each row execute function private.touch_updated_at();

drop trigger if exists children_touch_updated_at on public.children;
create trigger children_touch_updated_at before update on public.children
for each row execute function private.touch_updated_at();

-- ---------- RLS helper functions ----------
-- These live in a non-exposed schema and use SECURITY DEFINER to avoid
-- recursive membership policies. search_path is pinned for safety.

create or replace function private.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_household_owner(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = (select auth.uid())
      and hm.role = 'owner'
  );
$$;

create or replace function private.can_access_child(p_child_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.children c
    join public.household_members hm on hm.household_id = c.household_id
    where c.id = p_child_id
      and hm.user_id = (select auth.uid())
  );
$$;

create or replace function private.users_share_household(p_other_user uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_other_user
  );
$$;

-- ---------- Controlled household creation / joining ----------

create or replace function private.create_household_core(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Household name is required.';
  end if;

  insert into public.households(name, created_by)
  values (trim(p_name), v_user)
  returning id into v_household;

  insert into public.household_members(household_id, user_id, role)
  values (v_household, v_user, 'owner');

  return v_household;
end;
$$;

create or replace function private.join_household_core(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;

  select h.id into v_household
  from public.households h
  where upper(h.invite_code) = upper(trim(p_code))
  limit 1;

  if v_household is null then
    raise exception 'Invite code not found.';
  end if;

  insert into public.household_members(household_id, user_id, role)
  values (v_household, v_user, 'member')
  on conflict (household_id, user_id) do nothing;

  return v_household;
end;
$$;

create or replace function public.create_household(p_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_household_core($1);
$$;

create or replace function public.join_household(p_code text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.join_household_core($1);
$$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.children enable row level security;
alter table public.child_food_logs enable row level security;
alter table public.child_favorites enable row level security;

-- Profiles: you can manage yourself, and household members can see each other's names/avatars.
drop policy if exists "profiles_select_family" on public.profiles;
create policy "profiles_select_family" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or private.users_share_household(id)
);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Households: members can read; owners can update name/invite code.
drop policy if exists "households_select_members" on public.households;
create policy "households_select_members" on public.households
for select to authenticated
using (private.is_household_member(id));

drop policy if exists "households_update_owner" on public.households;
create policy "households_update_owner" on public.households
for update to authenticated
using (private.is_household_owner(id))
with check (private.is_household_owner(id));

-- Membership: household members may see who else belongs to their household.
drop policy if exists "household_members_select_family" on public.household_members;
create policy "household_members_select_family" on public.household_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_household_member(household_id)
);

-- Children: any household member can add/edit/read children in that household.
drop policy if exists "children_select_members" on public.children;
create policy "children_select_members" on public.children
for select to authenticated
using (private.is_household_member(household_id));

drop policy if exists "children_insert_members" on public.children;
create policy "children_insert_members" on public.children
for insert to authenticated
with check (private.is_household_member(household_id));

drop policy if exists "children_update_members" on public.children;
create policy "children_update_members" on public.children
for update to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

drop policy if exists "children_delete_members" on public.children;
create policy "children_delete_members" on public.children
for delete to authenticated
using (private.is_household_member(household_id));

-- Food logs: members can read/delete a child's logs; inserts are attributed to the signed-in user.
drop policy if exists "child_food_logs_select_members" on public.child_food_logs;
create policy "child_food_logs_select_members" on public.child_food_logs
for select to authenticated
using (private.can_access_child(child_id));

drop policy if exists "child_food_logs_insert_members" on public.child_food_logs;
create policy "child_food_logs_insert_members" on public.child_food_logs
for insert to authenticated
with check (
  logged_by = (select auth.uid())
  and private.can_access_child(child_id)
);

drop policy if exists "child_food_logs_delete_members" on public.child_food_logs;
create policy "child_food_logs_delete_members" on public.child_food_logs
for delete to authenticated
using (private.can_access_child(child_id));

-- Favorites are shared per child across the household.
drop policy if exists "child_favorites_select_members" on public.child_favorites;
create policy "child_favorites_select_members" on public.child_favorites
for select to authenticated
using (private.can_access_child(child_id));

drop policy if exists "child_favorites_insert_members" on public.child_favorites;
create policy "child_favorites_insert_members" on public.child_favorites
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_access_child(child_id)
);

drop policy if exists "child_favorites_delete_members" on public.child_favorites;
create policy "child_favorites_delete_members" on public.child_favorites
for delete to authenticated
using (private.can_access_child(child_id));

-- ---------- Grants ----------
-- RLS is the authorization layer; grants specify which operations are possible at all.

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.households from anon, authenticated;
revoke all on table public.household_members from anon, authenticated;
revoke all on table public.children from anon, authenticated;
revoke all on table public.child_food_logs from anon, authenticated;
revoke all on table public.child_favorites from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, update on table public.households to authenticated;
grant select on table public.household_members to authenticated;
grant select, insert, update, delete on table public.children to authenticated;
grant select, insert, delete on table public.child_food_logs to authenticated;
grant select, insert, delete on table public.child_favorites to authenticated;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.is_household_owner(uuid) from public;
revoke all on function private.can_access_child(uuid) from public;
revoke all on function private.users_share_household(uuid) from public;
revoke all on function private.create_household_core(text) from public;
revoke all on function private.join_household_core(text) from public;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;
grant execute on function private.can_access_child(uuid) to authenticated;
grant execute on function private.users_share_household(uuid) to authenticated;
grant execute on function private.create_household_core(text) to authenticated;
grant execute on function private.join_household_core(text) to authenticated;
