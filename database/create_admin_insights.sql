-- Admin Insights table to store AI-generated summaries for the admin dashboard
-- Safe to run multiple times

create table if not exists public.admin_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists admin_insights_user_id_idx on public.admin_insights(user_id);
create index if not exists admin_insights_created_at_idx on public.admin_insights(created_at desc);

-- Enable RLS
alter table public.admin_insights enable row level security;

-- Policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_insights' and policyname = 'Admins can insert insights'
  ) then
    create policy "Admins can insert insights"
      on public.admin_insights
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin'
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_insights' and policyname = 'Admins can read their insights'
  ) then
    create policy "Admins can read their insights"
      on public.admin_insights
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- Service role full access
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_insights' and policyname = 'Service role full access to admin_insights'
  ) then
    create policy "Service role full access to admin_insights"
      on public.admin_insights
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;


