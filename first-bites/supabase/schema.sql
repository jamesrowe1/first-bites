-- FIRST BITES: run this once in Supabase -> SQL Editor.
-- This schema assumes one shared family login used on both phones.

create extension if not exists pgcrypto;

create table if not exists public.baby_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Baby',
  birth_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id text not null,
  eaten_at timestamptz not null default now(),
  liked text check (liked in ('liked','neutral','disliked')),
  reaction text check (reaction in ('none','possible','mild','significant')) default 'none',
  amount text,
  notes text,
  first_exposure boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_eaten_idx on public.food_logs (user_id, eaten_at desc);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.baby_profiles enable row level security;
alter table public.food_logs enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "Users manage own baby profile" on public.baby_profiles;
create policy "Users manage own baby profile" on public.baby_profiles
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own food logs" on public.food_logs;
create policy "Users manage own food logs" on public.food_logs
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites" on public.favorites
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.baby_profiles to authenticated;
grant select, insert, update, delete on public.food_logs to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
