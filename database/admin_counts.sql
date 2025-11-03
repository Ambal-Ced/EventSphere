-- Admin aggregate helpers (bypass RLS safely)
-- Run this in Supabase SQL editor once.

-- Count all profiles
create or replace function public.admin_count_profiles()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint from public.profiles;
$$;

-- Allow authenticated users to call it (the function body runs as owner)
grant execute on function public.admin_count_profiles() to authenticated;

-- Check if a user is admin (by profiles.account_type)
create or replace function public.admin_is_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select account_type = 'admin' from public.profiles where id = p_user_id limit 1), false);
$$;

grant execute on function public.admin_is_admin(uuid) to authenticated;

-- Count all events
create or replace function public.admin_count_events()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint from public.events;
$$;

grant execute on function public.admin_count_events() to authenticated;


