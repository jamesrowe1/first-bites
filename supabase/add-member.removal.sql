-- First Bites migration: allow owners to remove household members and members to leave.
-- Safe to run once in Supabase SQL Editor after the main schema.sql has already been installed.

create or replace function private.remove_household_member_core(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target_role text;
begin
  if v_actor is null then raise exception 'You must be signed in.'; end if;
  if not private.is_household_owner(p_household_id) then raise exception 'Only the household owner can remove members.'; end if;

  select hm.role into v_target_role
  from public.household_members hm
  where hm.household_id = p_household_id and hm.user_id = p_user_id;

  if v_target_role is null then raise exception 'That user is not a member of this household.'; end if;
  if p_user_id = v_actor then raise exception 'The household owner cannot remove themselves.'; end if;
  if v_target_role = 'owner' then raise exception 'A household owner cannot be removed.'; end if;

  delete from public.household_members
  where household_id = p_household_id and user_id = p_user_id;
end;
$$;

create or replace function private.leave_household_core(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
begin
  if v_user is null then raise exception 'You must be signed in.'; end if;
  select hm.role into v_role
  from public.household_members hm
  where hm.household_id = p_household_id and hm.user_id = v_user;
  if v_role is null then raise exception 'You are not a member of this household.'; end if;
  if v_role = 'owner' then raise exception 'The household owner cannot leave until ownership transfer is supported.'; end if;
  delete from public.household_members where household_id = p_household_id and user_id = v_user;
end;
$$;

create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.remove_household_member_core($1, $2); $$;

create or replace function public.leave_household(p_household_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.leave_household_core($1); $$;

revoke all on function public.remove_household_member(uuid, uuid) from public;
revoke all on function public.leave_household(uuid) from public;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;

revoke all on function private.remove_household_member_core(uuid, uuid) from public;
revoke all on function private.leave_household_core(uuid) from public;
grant execute on function private.remove_household_member_core(uuid, uuid) to authenticated;
grant execute on function private.leave_household_core(uuid) to authenticated;
