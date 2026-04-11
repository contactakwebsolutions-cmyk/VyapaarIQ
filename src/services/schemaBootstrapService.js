const db = require('../config/db');

async function ensureSchema() {
    // Keep this idempotent: safe to run on every boot.
    await db.query(`
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS language VARCHAR(20),
            ADD COLUMN IF NOT EXISTS language_locked BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS onboarding_stage VARCHAR(30),
            ADD COLUMN IF NOT EXISTS onboarding_pending_language VARCHAR(20);
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS onboarding_leads (
            phone_number VARCHAR(20) PRIMARY KEY,
            onboarding_stage VARCHAR(30),
            onboarding_pending_language VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // App mode routing (Business vs Personal)
    await db.query(`
        CREATE TABLE IF NOT EXISTS app_profiles (
            phone_number VARCHAR(20) PRIMARY KEY,
            app_mode VARCHAR(20) NOT NULL, -- 'business' | 'personal'
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS app_mode_leads (
            phone_number VARCHAR(20) PRIMARY KEY,
            stage VARCHAR(30), -- 'choose_app' | 'confirm_app'
            pending_mode VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // PersonalIQ (separate tables)
    await db.query(`
        CREATE TABLE IF NOT EXISTS personaliq_users (
            id SERIAL PRIMARY KEY,
            phone_number VARCHAR(20) UNIQUE NOT NULL,
            language VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS personaliq_transactions (
            id SERIAL PRIMARY KEY,
            personaliq_user_id INTEGER REFERENCES personaliq_users(id) ON DELETE CASCADE,
            type VARCHAR(20) NOT NULL, -- 'income' | 'expense'
            amount DECIMAL(12, 2) NOT NULL,
            category VARCHAR(100),
            note VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS personaliq_subscriptions (
            id SERIAL PRIMARY KEY,
            personaliq_user_id INTEGER REFERENCES personaliq_users(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'expired'
            plan_type VARCHAR(20) NOT NULL DEFAULT 'trial', -- 'trial' | 'standard' | 'pro'
            start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            end_date TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

module.exports = { ensureSchema };
