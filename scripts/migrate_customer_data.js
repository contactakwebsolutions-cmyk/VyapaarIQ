const { Client } = require('pg');
require('dotenv').config();
const { toEnglish, toTelugu, hasTelugu } = require('../src/services/transliterationService');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const customers = await client.query('SELECT id, name FROM customers');
        console.log(`Found ${customers.rows.length} customers to migrate.`);

        for (const customer of customers.rows) {
            let nameTel, nameEng;
            if (hasTelugu(customer.name)) {
                nameTel = customer.name;
                nameEng = toEnglish(customer.name);
            } else {
                nameEng = customer.name;
                nameTel = toTelugu(customer.name);
            }

            console.log(`Updating customer ${customer.id}: ${nameEng} | ${nameTel}`);
            await client.query(
                'UPDATE customers SET name_telugu = $1, name_english = $2 WHERE id = $3',
                [nameTel, nameEng, customer.id]
            );
        }

        console.log('Customer migration complete.');

    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

migrate();
