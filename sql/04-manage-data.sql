-- ========================================
-- Manage Data: Common Operations
-- ========================================

-- ⚠️ WARNING: Be careful with DELETE operations!
-- Always backup your database first

-- ========================================
-- 1. Delete all transactions for a specific user
-- ========================================
-- Replace YOUR_USER_ID with the actual user ID
-- DELETE FROM transactions WHERE user_id = YOUR_USER_ID;


-- ========================================
-- 2. Delete a specific user (all related data)
-- ========================================
-- Replace YOUR_USER_ID with the actual user ID
-- This will cascade delete all transactions and customers
-- DELETE FROM users WHERE id = YOUR_USER_ID;


-- ========================================
-- 3. Clear opening balance for a user
-- ========================================
-- Replace YOUR_USER_ID with the actual user ID
-- UPDATE users SET opening_balance = NULL WHERE id = YOUR_USER_ID;


-- ========================================
-- 4. Clear pending OB update
-- ========================================
-- Replace YOUR_USER_ID with the actual user ID
-- UPDATE users SET pending_ob_amount = NULL WHERE id = YOUR_USER_ID;


-- ========================================
-- 5. Find users without opening balance set
-- ========================================
SELECT
    id,
    phone_number,
    language,
    created_at
FROM users
WHERE opening_balance IS NULL
ORDER BY created_at DESC;


-- ========================================
-- 6. Find users with pending OB update
-- ========================================
SELECT
    id,
    phone_number,
    opening_balance,
    pending_ob_amount,
    created_at
FROM users
WHERE pending_ob_amount IS NOT NULL
ORDER BY created_at DESC;


-- ========================================
-- 7. Find transactions without a user (orphaned)
-- ========================================
SELECT
    t.id,
    t.type,
    t.amount,
    t.created_at
FROM transactions t
LEFT JOIN users u ON t.user_id = u.id
WHERE u.id IS NULL;


-- ========================================
-- 8. Find customers without a user (orphaned)
-- ========================================
SELECT
    c.id,
    c.name,
    c.pending_amount,
    c.created_at
FROM customers c
LEFT JOIN users u ON c.user_id = u.id
WHERE u.id IS NULL;


-- ========================================
-- 9. Recalculate customer pending amounts
-- ========================================
-- This recalculates pending_amount based on actual transactions
UPDATE customers c
SET pending_amount = COALESCE((
    SELECT
        COALESCE(SUM(CASE WHEN t.type = 'sale' AND t.is_credit = true THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0)
    FROM transactions t
    WHERE t.customer_id = c.id
), 0)
WHERE c.pending_amount < 0;


-- ========================================
-- 10. Database Statistics
-- ========================================
SELECT
    'users' as table_name,
    COUNT(*) as row_count
FROM users
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'personaliq_users', COUNT(*) FROM personaliq_users
UNION ALL
SELECT 'personaliq_transactions', COUNT(*) FROM personaliq_transactions
ORDER BY table_name;
