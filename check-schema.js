const db = require('./src/config/db');

async function checkSchema() {
    try {
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'subscriptions'
        `);
        console.log('Subscriptions Columns:', res.rows);
    } catch (err) {
        console.error('Error checking schema:', err.message);
    }
}

checkSchema();
