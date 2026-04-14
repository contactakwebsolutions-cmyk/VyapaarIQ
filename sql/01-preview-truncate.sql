-- ========================================
-- PREVIEW: SQL Commands to Truncate All Tables
-- ========================================
-- This script SHOWS what will be deleted
-- Copy and paste the commands below into pgAdmin to execute
-- ========================================

-- Step 1: Disable foreign key constraints
SET session_replication_role = replica;

-- Step 2: Truncate all tables (deletes all data)
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE subscriptions CASCADE;
TRUNCATE TABLE personaliq_transactions CASCADE;
TRUNCATE TABLE personaliq_customers CASCADE;
TRUNCATE TABLE personaliq_subscriptions CASCADE;
TRUNCATE TABLE personaliq_users CASCADE;
TRUNCATE TABLE onboarding_leads CASCADE;
TRUNCATE TABLE app_mode_leads CASCADE;
TRUNCATE TABLE app_profiles CASCADE;
TRUNCATE TABLE users CASCADE;

-- Step 3: Reset auto-increment sequences to 1
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE customers_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE subscriptions_id_seq RESTART WITH 1;
ALTER SEQUENCE personaliq_users_id_seq RESTART WITH 1;
ALTER SEQUENCE personaliq_customers_id_seq RESTART WITH 1;
ALTER SEQUENCE personaliq_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE personaliq_subscriptions_id_seq RESTART WITH 1;
ALTER SEQUENCE onboarding_leads_id_seq RESTART WITH 1;
ALTER SEQUENCE app_mode_leads_id_seq RESTART WITH 1;
ALTER SEQUENCE app_profiles_id_seq RESTART WITH 1;

-- Step 4: Re-enable foreign key constraints
SET session_replication_role = default;

-- ========================================
-- ✅ All data deleted and sequences reset!
-- ========================================
