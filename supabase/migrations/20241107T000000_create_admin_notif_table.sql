create extension if not exists pgcrypto;

-- Create admin_notif table to store admin-driven user notifications
create table if not exists public.admin_notif (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text,
  title text,
  message text,
  level text,
  link_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz
);

alter table public.admin_notif enable row level security;

create index if not exists admin_notif_user_id_idx on public.admin_notif(user_id, read_at);
create index if not exists admin_notif_created_at_idx on public.admin_notif(created_at desc);

alter publication supabase_realtime add table public.admin_notif;

-- Allow end users to read their own admin notifications
create policy "Users can read admin notifications"
on public.admin_notif
for select
using (auth.uid() = user_id);

-- Allow end users to mark their admin notifications as read
create policy "Users can update admin notifications"
on public.admin_notif
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Allow the service role (admin edge functions) to manage notifications
create policy "Service role can insert admin notifications"
on public.admin_notif
for insert
to service_role
with check (true);

create policy "Service role can update admin notifications"
on public.admin_notif
for update
to service_role
using (true)
with check (true);

create policy "Service role can read admin notifications"
on public.admin_notif
for select
to service_role
using (true);

