-- ========================================
-- ⚠️  COMPLETE RESET: Drop All Tables
-- ========================================
-- WARNING: This DELETES all tables and recreates them
-- USE ONLY IF YOU WANT A COMPLETE FRESH START
-- ========================================

-- Step 1: Drop all tables (this will delete everything)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS personaliq_transactions CASCADE;
DROP TABLE IF EXISTS personaliq_customers CASCADE;
DROP TABLE IF EXISTS personaliq_subscriptions CASCADE;
DROP TABLE IF EXISTS personaliq_users CASCADE;
DROP TABLE IF EXISTS onboarding_leads CASCADE;
DROP TABLE IF EXISTS app_mode_leads CASCADE;
DROP TABLE IF EXISTS app_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Step 2: Recreate the complete schema
-- (Copy the content from db/schema.sql and paste it here)
-- For now, run the original db/schema.sql to recreate tables

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    language VARCHAR(20),
    language_locked BOOLEAN DEFAULT false,
    onboarding_stage VARCHAR(50),
    onboarding_pending_language VARCHAR(20),
    opening_balance NUMERIC NULL,
    pending_ob_amount NUMERIC NULL
);

CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    plan_type VARCHAR(20) DEFAULT 'trial',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_telugu VARCHAR(100),
    name_english VARCHAR(100),
    pending_amount DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    category VARCHAR(100),
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    is_credit BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PersonalIQ tables
CREATE TABLE personaliq_users (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    language VARCHAR(20) DEFAULT 'english',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE personaliq_subscriptions (
    id SERIAL PRIMARY KEY,
    personaliq_user_id INTEGER REFERENCES personaliq_users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    plan_type VARCHAR(20) DEFAULT 'trial',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE personaliq_customers (
    id SERIAL PRIMARY KEY,
    personaliq_user_id INTEGER REFERENCES personaliq_users(id) ON DELETE CASCADE,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE personaliq_transactions (
    id SERIAL PRIMARY KEY,
    personaliq_user_id INTEGER REFERENCES personaliq_users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    category VARCHAR(100),
    note VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- App mode selection tables
CREATE TABLE onboarding_leads (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    onboarding_stage VARCHAR(50),
    onboarding_pending_language VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_mode_leads (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    stage VARCHAR(50),
    pending_mode VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_profiles (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    app_mode VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_transactions_user_created ON transactions(user_id, created_at);
CREATE INDEX idx_customers_user ON customers(user_id);
CREATE INDEX idx_personaliq_users_phone ON personaliq_users(phone_number);
CREATE INDEX idx_personaliq_subscriptions_user ON personaliq_subscriptions(personaliq_user_id);
CREATE INDEX idx_personaliq_transactions_user_created ON personaliq_transactions(personaliq_user_id, created_at);
CREATE INDEX idx_personaliq_customers_user ON personaliq_customers(personaliq_user_id);

-- ========================================
-- ✅ Complete reset finished!
-- ✅ All tables recreated from scratch
-- ========================================

-- Verify tables exist
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
