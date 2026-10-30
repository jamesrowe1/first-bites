-- FIRST BITES: account deletion support
-- Run once in Supabase -> SQL Editor before processing account deletion requests.
-- This trigger runs immediately before an auth.users row is deleted by an admin.
-- It removes data authored by the deleting user, transfers any owned household to
-- another member when possible, and deletes single-member households.

create or replace function private.prepare_first_bites_user_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household record;
  v_replacement uuid;
begin
  -- Remove user-authored child activity before auth.users FK restrictions apply.
  delete from public.child_food_logs where logged_by = old.id;
  delete from public.child_favorites where created_by = old.id;

  -- Handle every household the departing user owns.
  for v_household in
    select hm.household_id
    from public.household_members hm
    where hm.user_id = old.id
      and hm.role = 'owner'
  loop
    select hm.user_id
      into v_replacement
    from public.household_members hm
    where hm.household_id = v_household.household_id
      and hm.user_id <> old.id
    order by hm.joined_at asc
    limit 1;

    if v_replacement is null then
      -- No one else needs this household; deleting it cascades children and logs.
      delete from public.households h where h.id = v_household.household_id;
    else
      -- Keep the shared household and transfer ownership to the oldest remaining member.
      update public.household_members
         set role = 'owner'
       where household_id = v_household.household_id
         and user_id = v_replacement;

      update public.households
         set created_by = v_replacement
       where id = v_household.household_id;
    end if;
  end loop;

  return old;
end;
$$;

-- Only the auth deletion operation should invoke this; app users cannot call it directly.
revoke all on function private.prepare_first_bites_user_deletion() from public, anon, authenticated;

drop trigger if exists first_bites_prepare_user_deletion on auth.users;
create trigger first_bites_prepare_user_deletion
before delete on auth.users
for each row execute function private.prepare_first_bites_user_deletion();
