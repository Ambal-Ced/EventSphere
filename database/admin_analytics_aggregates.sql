-- Optional SQL to push heavy admin analytics aggregation to Postgres.
-- Run this in Supabase SQL editor to create an RPC usable from the app.

-- Requires: plpgsql (default) and standard functions like percentile_cont

create or replace function public.admin_get_analytics_summary(
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_start timestamptz := coalesce(p_start, now() - interval '30 days');
  v_end   timestamptz := coalesce(p_end, now());
  v_total_users int;
  v_active_subs int;
  v_tx_paid int;
  v_tx_cancelled int;
  v_revenue_cents bigint;
  v_mean numeric;
  v_median numeric;
  v_mode bigint;
  v_series jsonb;
  v_sub_breakdown jsonb;
  v_sales_by_category jsonb;
  v_growth_rate numeric := 0;
  v_users_7_days_ago int := 0;
begin
  select count(*) into v_total_users
  from public.profiles
  where created_at <= v_end;

  select count(*) into v_active_subs
  from public.user_subscriptions s
  where s.status = 'active'
    and s.current_period_end > now()
    and (s.plan_id like '111%' or s.plan_id like '222%');

  -- Transactions (paid and cancelled) within range
  select
    coalesce(sum(case when status='paid' and transaction_type='purchase' then net_amount_cents else 0 end),0) as revenue,
    coalesce(count(*) filter (where status='paid' and transaction_type='purchase'),0) as paid_cnt,
    coalesce(count(*) filter (where status='cancelled' and transaction_type='cancellation'),0) as cancelled_cnt
  into v_revenue_cents, v_tx_paid, v_tx_cancelled
  from public.transactions
  where created_at >= v_start and created_at <= v_end;

  -- Revenue stats (paid only)
  select
    coalesce(avg(net_amount_cents),0),
    coalesce(percentile_cont(0.5) within group (order by net_amount_cents),0),
    coalesce((select net_amount_cents
              from public.transactions t2
              where t2.created_at >= v_start and t2.created_at <= v_end
                and t2.status='paid' and t2.transaction_type='purchase'
              group by net_amount_cents
              order by count(*) desc
              limit 1),0)
  into v_mean, v_median, v_mode
  from public.transactions
  where created_at >= v_start and created_at <= v_end
    and status='paid' and transaction_type='purchase';

  -- Time series (events, transactions, revenue by day)
  select coalesce(jsonb_agg(x order by day), '[]'::jsonb) into v_series
  from (
    select to_char(day, 'YYYY-MM-DD') as date,
           coalesce(ev_cnt,0) as events,
           coalesce(paid_cnt,0) as transactions,
           coalesce(revenue_cents,0) as revenue_cents
    from (
      select d::date as day
      from generate_series(date_trunc('day', v_start), date_trunc('day', v_end), interval '1 day') d
    ) days
    left join (
      select date_trunc('day', created_at) as day, count(*) as ev_cnt
      from public.events
      where created_at >= v_start and created_at <= v_end
      group by 1
    ) ev on ev.day = days.day
    left join (
      select date_trunc('day', created_at) as day,
             count(*) filter (where status='paid' and transaction_type='purchase') as paid_cnt,
             coalesce(sum(net_amount_cents) filter (where status='paid' and transaction_type='purchase'),0) as revenue_cents
      from public.transactions
      where created_at >= v_start and created_at <= v_end
      group by 1
    ) tx on tx.day = days.day
  ) x;

  -- Sales by category (events count by category)
  select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', cnt) order by cnt desc), '[]'::jsonb)
  into v_sales_by_category
  from (
    select coalesce(category,'Uncategorized') as category, count(*) as cnt
    from public.events
    where created_at >= v_start and created_at <= v_end
    group by 1
  ) c;

  -- Subscriptions breakdown by plan (count + revenue from transactions plan_name)
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', cnt, 'revenue_cents', rev) order by cnt desc), '[]'::jsonb)
  into v_sub_breakdown
  from (
    select coalesce(p.name,'Unknown') as name,
           count(s.id) as cnt,
           coalesce((
             select sum(case when t.status='paid' and t.transaction_type='purchase' then t.net_amount_cents
                             when t.status='cancelled' and t.transaction_type='cancellation' then -t.net_amount_cents else 0 end)
             from public.transactions t
             where t.created_at >= v_start and t.created_at <= v_end and t.plan_name = p.name
           ),0) as rev
    from public.user_subscriptions s
    left join public.subscription_plans p on p.id = s.plan_id
    where s.created_at <= v_end
    group by 1
  ) sb;

  -- Growth: compare current users vs 7 days ago
  select count(*) into v_users_7_days_ago from public.profiles where created_at <= (v_end - interval '7 days');
  if v_users_7_days_ago > 0 then
    v_growth_rate := ((v_total_users - v_users_7_days_ago)::numeric / v_users_7_days_ago::numeric) * 100.0;
  elsif v_total_users > 0 then
    v_growth_rate := 100;
  end if;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'users', v_total_users,
      'events', (select count(*) from public.events where created_at >= v_start and created_at <= v_end),
      'transactions', v_tx_paid,
      'subscriptions', (select count(*) from public.user_subscriptions where created_at <= v_end),
      'active_subscriptions', v_active_subs,
      'revenue_cents', greatest(0, v_revenue_cents)
    ),
    'revenue_stats', jsonb_build_object(
      'mean', coalesce(v_mean,0),
      'median', coalesce(v_median,0),
      'mode', coalesce(v_mode,0),
      'total', greatest(0, v_revenue_cents)
    ),
    'time_series', v_series,
    'subscription_breakdown', v_sub_breakdown,
    'additional_metrics', jsonb_build_object(
      'user_growth_rate', coalesce(v_growth_rate,0),
      'conversion_rate', case when v_total_users > 0 then (v_active_subs::numeric / v_total_users::numeric) * 100 else 0 end,
      'avg_revenue_per_transaction', case when v_tx_paid > 0 then greatest(0, v_revenue_cents)::numeric / v_tx_paid else 0 end
    ),
    'sales_by_category', v_sales_by_category,
    'transaction_rates', jsonb_build_object(
      'paid', v_tx_paid,
      'cancelled', v_tx_cancelled,
      'paid_rate', case when (v_tx_paid+v_tx_cancelled) > 0 then (v_tx_paid::numeric/(v_tx_paid+v_tx_cancelled)) * 100 else 0 end,
      'cancelled_rate', case when (v_tx_paid+v_tx_cancelled) > 0 then (v_tx_cancelled::numeric/(v_tx_paid+v_tx_cancelled)) * 100 else 0 end
    )
  );
end;
$$;


