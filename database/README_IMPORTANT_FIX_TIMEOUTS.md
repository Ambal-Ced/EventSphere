# 🔧 CRITICAL: Fix Timeout Issues

## Problem
Both transaction inserts and subscription operations are timing out. This is caused by:
1. **RLS policies blocking inserts/updates**
2. **Missing database indexes** causing slow queries
3. **Slow database triggers** for invoice number generation

## ✅ Solution - Run These SQL Scripts in Order

### Step 1: Fix RLS Policies
**File:** `database/fix_rls_policies.sql`

1. Open your Supabase SQL Editor
2. Copy and paste the contents of `database/fix_rls_policies.sql`
3. Click "Run" or press F5
4. Wait for all queries to complete successfully

**What this does:**
- Fixes RLS policies for `transactions` table (allows users to INSERT, UPDATE, SELECT their own transactions)
- Fixes RLS policies for `user_subscriptions` table (allows users to INSERT, UPDATE, SELECT their own subscriptions)
- Fixes RLS policies for `subscription_plans` table (allows authenticated users to SELECT plans)

### Step 2: Optimize Database Performance
**File:** `database/optimize_transactions_performance.sql`

1. After Step 1 completes successfully
2. Copy and paste the contents of `database/optimize_transactions_performance.sql`
3. Click "Run" or press F5
4. Wait for all queries to complete successfully

**What this does:**
- Optimizes the invoice number trigger to skip when invoice_number is provided (FAST PATH)
- Generates timestamp-based invoice numbers (matching client-side format)
- Adds indexes on commonly queried columns for faster lookups:
  - `transactions.user_id`
  - `transactions.invoice_number`
  - `user_subscriptions.user_id`
  - `user_subscriptions.status`
  - Composite indexes for common query patterns
- Analyzes tables for better query planning

## ✅ Verification

After running both scripts, verify the fixes worked:

```sql
-- Check RLS policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions')
ORDER BY tablename, policyname;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions')
ORDER BY tablename, indexname;
```

## Expected Results

After running both scripts:
- ✅ Transaction inserts should complete in < 2 seconds (instead of timing out after 15 seconds)
- ✅ Subscription lookups should complete in < 1 second (instead of timing out after 10 seconds)
- ✅ Subscription updates/inserts should complete in < 2 seconds (instead of timing out after 30-45 seconds)
- ✅ Purchases from Free tier (000...) to Small (111...) or Large (222...) should work

## Troubleshooting

If timeouts persist after running both scripts:

1. **Check RLS policies are enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
     AND tablename IN ('transactions', 'user_subscriptions');
   ```
   Should show `rowsecurity = true` for both tables.

2. **Check policies exist:**
   ```sql
   SELECT COUNT(*) FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename = 'transactions';
   ```
   Should return at least 4 policies.

3. **Check indexes exist:**
   ```sql
   SELECT COUNT(*) FROM pg_indexes 
   WHERE schemaname = 'public' 
     AND tablename = 'user_subscriptions';
   ```
   Should return at least 5 indexes.

4. **Check database connection:**
   - Try running a simple query: `SELECT NOW();`
   - If this also times out, it's a network/connectivity issue, not RLS

5. **Check database performance:**
   - Look at Supabase dashboard for slow queries
   - Check database CPU/Memory usage
   - Consider upgrading database plan if consistently slow

## Notes

- These scripts are **idempotent** - safe to run multiple times
- They use `DROP POLICY IF EXISTS` and `CREATE INDEX IF NOT EXISTS` to avoid errors
- Running them multiple times won't cause issues

