-- ========================================
-- Migration: Add Opening Balance Columns
-- ========================================
-- This script adds two new columns to the users table
-- for Opening Balance functionality
-- ========================================

-- Add opening_balance column
-- NULL = not set
-- 0 = valid value (zero opening balance)
ALTER TABLE users ADD COLUMN IF NOT EXISTS opening_balance NUMERIC NULL;

-- Add pending_ob_amount column
-- Used for storing pending OB update while awaiting YES/NO confirmation
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_ob_amount NUMERIC NULL;

-- ========================================
-- Verify the new columns were added
-- ========================================
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('opening_balance', 'pending_ob_amount')
ORDER BY ordinal_position;

-- Expected output:
-- column_name          | data_type | is_nullable
-- =====================================================
-- opening_balance      | numeric   | YES
-- pending_ob_amount    | numeric   | YES
