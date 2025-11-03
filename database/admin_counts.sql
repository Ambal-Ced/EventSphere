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


