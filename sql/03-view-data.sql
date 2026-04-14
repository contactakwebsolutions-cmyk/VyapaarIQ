-- ========================================
-- View Data: Useful Queries
-- ========================================

-- 1. View all users with their opening balance
SELECT
    id,
    phone_number,
    language,
    opening_balance,
    pending_ob_amount,
    created_at
FROM users
ORDER BY created_at DESC;

-- ========================================

-- 2. View all transactions
SELECT
    id,
    user_id,
    type,
    amount,
    category,
    customer_name,
    is_credit,
    created_at
FROM transactions
ORDER BY created_at DESC
LIMIT 50;

-- ========================================

-- 3. View all customers with pending amounts
SELECT
    id,
    user_id,
    name,
    pending_amount,
    created_at
FROM customers
WHERE pending_amount > 0
ORDER BY pending_amount DESC;

-- ========================================

-- 4. View transaction summary by user
SELECT
    u.id,
    u.phone_number,
    u.opening_balance,
    COUNT(CASE WHEN t.type = 'sale' THEN 1 END) as sale_count,
    COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_count,
    COUNT(CASE WHEN t.type = 'payment' THEN 1 END) as payment_count,
    COALESCE(SUM(CASE WHEN t.type = 'sale' THEN t.amount ELSE 0 END), 0) as total_sales,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) as total_received
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.phone_number, u.opening_balance
ORDER BY u.created_at DESC;

-- ========================================

-- 5. View today's transactions for a specific user
-- Replace 'YOUR_USER_ID' with actual user ID
SELECT
    id,
    type,
    amount,
    category,
    customer_name,
    created_at
FROM transactions
WHERE user_id = YOUR_USER_ID
AND DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- ========================================

-- 6. Calculate closing balance for each user
-- Opening Balance + Total Received - Total Expenses
SELECT
    u.id,
    u.phone_number,
    u.opening_balance,
    COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) as total_received,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(u.opening_balance, 0) +
    COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as closing_balance
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
WHERE u.opening_balance IS NOT NULL
GROUP BY u.id, u.phone_number, u.opening_balance
ORDER BY u.created_at DESC;

-- ========================================

-- 7. View subscriptions status
SELECT
    s.id,
    u.phone_number,
    s.status,
    s.plan_type,
    s.start_date,
    s.end_date,
    CASE
        WHEN s.end_date < CURRENT_TIMESTAMP THEN 'EXPIRED'
        ELSE 'ACTIVE'
    END as actual_status
FROM subscriptions s
JOIN users u ON s.user_id = u.id
ORDER BY s.end_date DESC;
