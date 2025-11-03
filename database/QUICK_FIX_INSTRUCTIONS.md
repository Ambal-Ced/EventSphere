# 🚨 URGENT: Fix Timeout Errors - Step by Step

## The Problem
You're seeing timeout errors because **RLS (Row Level Security) policies are blocking database operations**. 

**Error messages show:**
- "Subscription lookup timeout after 8 seconds. This usually means RLS policies are blocking the query."
- "⚠️ CRITICAL: This timeout indicates RLS policies are blocking the query."

## Quick Fix (5 Minutes)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Run the Fix Script
1. Open the file `database/fix_rls_policies.sql` in your code editor
2. **Copy the ENTIRE contents** of the file (Ctrl+A, then Ctrl+C)
3. **Paste it into the Supabase SQL Editor** (Ctrl+V)
4. Click **RUN** button (or press F5)

### Step 3: Verify It Worked
After running, you should see:
- ✅ All queries completed successfully
- ✅ No errors in the results

### Step 4: Run the Optimization Script (Optional but Recommended)
1. Open the file `database/optimize_transactions_performance.sql`
2. **Copy the ENTIRE contents** (Ctrl+A, then Ctrl+C)
3. **Paste into Supabase SQL Editor** (Ctrl+V)
4. Click **RUN** (or press F5)

### Step 5: Test
Try purchasing a subscription again. It should work now!

## What These Scripts Do

### `fix_rls_policies.sql`
Fixes RLS policies to allow:
- ✅ Users can INSERT their own transactions
- ✅ Users can INSERT their own subscriptions  
- ✅ Users can UPDATE their own subscriptions
- ✅ Users can SELECT their own data

### `optimize_transactions_performance.sql`
- Optimizes database triggers (faster invoice number generation)
- Adds indexes for faster queries
- Improves overall database performance

## Still Having Issues?

### Verify RLS Policies Were Created
Run this in Supabase SQL Editor:
```sql
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions')
ORDER BY tablename;
```

You should see at least **4 policies for transactions** and **5 policies for user_subscriptions**.

### Test Database Connection
Run this simple query to test connectivity:
```sql
SELECT NOW();
```

If this also times out, it's a network/connectivity issue, not RLS.

## Why This Happens

RLS (Row Level Security) is a security feature in PostgreSQL/Supabase. When enabled, it **blocks all database operations** unless there are explicit policies allowing them.

Your tables have RLS enabled, but the policies are either:
- Missing (no INSERT/UPDATE policies)
- Too restrictive (not allowing users to insert/update their own data)

The fix scripts create the proper policies to allow authenticated users to manage their own data.

## Need Help?

If you've run both scripts and still see timeouts:
1. Check Supabase dashboard for any error messages
2. Verify you're logged in as the correct user
3. Check Supabase logs for any database errors
4. Contact support with error code: **RLS_TIMEOUT**

