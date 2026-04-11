const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Add columns
        console.log('Adding name_telugu and name_english to customers table...');
        await client.query(`
            ALTER TABLE customers 
            ADD COLUMN IF NOT EXISTS name_telugu VARCHAR(100),
            ADD COLUMN IF NOT EXISTS name_english VARCHAR(100);
        `);
        console.log('Columns added successfully.');

        // 2. Add search indexes
        console.log('Adding search indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_customers_name_telugu ON customers(name_telugu);
            CREATE INDEX IF NOT EXISTS idx_customers_name_english ON customers(name_english);
        `);
        console.log('Indexes added successfully.');

    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

migrate();
