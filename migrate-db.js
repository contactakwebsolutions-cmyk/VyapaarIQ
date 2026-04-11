const db = require('./src/config/db');

async function migrate() {
    try {
        await db.query(`
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'trial';
        `);
        console.log('✅ Subscriptions table updated with plan_type');
    } catch (err) {
        console.error('Migration error:', err.message);
    }
}

migrate();
