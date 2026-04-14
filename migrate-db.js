const db = require('./src/config/db');

async function migrate() {
    try {
        await db.query(`
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'trial';
        `);
        console.log('✅ Subscriptions table updated with plan_type');

        await db.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS opening_balance NUMERIC NULL;
        `);
        console.log('✅ Users table updated with opening_balance');

        await db.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_ob_amount NUMERIC NULL;
        `);
        console.log('✅ Users table updated with pending_ob_amount');
    } catch (err) {
        console.error('Migration error:', err.message);
    }
}

migrate();
