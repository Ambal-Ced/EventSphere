-- Fix subscription plan prices to match payment page definitions
-- This script updates the plan prices in the database to match the correct amounts

-- Update Small Event Org plan price from ₱100 to ₱159
UPDATE subscription_plans 
SET price_cents = 159000, 
    updated_at = NOW()
WHERE name = 'Small Event Org' 
  AND price_cents != 159000;

-- Update Large Event Org plan price to ₱300 (if not already correct)
UPDATE subscription_plans 
SET price_cents = 300000, 
    updated_at = NOW()
WHERE name = 'Large Event Org' 
  AND price_cents != 300000;

-- Verify the updates
SELECT 
    name,
    price_cents,
    price_cents / 1000 as price_pesos,
    currency,
    billing_period,
    is_active
FROM subscription_plans 
WHERE name IN ('Small Event Org', 'Large Event Org', 'Free')
ORDER BY price_cents;

-- Show any plans that might have incorrect prices
SELECT 
    name,
    price_cents,
    price_cents / 1000 as price_pesos,
    CASE 
        WHEN name = 'Small Event Org' AND price_cents != 159000 THEN '❌ INCORRECT - Should be 159000'
        WHEN name = 'Large Event Org' AND price_cents != 300000 THEN '❌ INCORRECT - Should be 300000'
        WHEN name = 'Free' AND price_cents != 0 THEN '❌ INCORRECT - Should be 0'
        ELSE '✅ CORRECT'
    END as status
FROM subscription_plans 
WHERE name IN ('Small Event Org', 'Large Event Org', 'Free');
