-- First Bites: bulk previously-tried food support
-- Run once in Supabase -> SQL Editor for an existing database.

alter table public.child_food_logs
  add column if not exists is_backfill boolean not null default false;

comment on column public.child_food_logs.is_backfill is
  'True when the food was added as previously tried without a known meal date.';
