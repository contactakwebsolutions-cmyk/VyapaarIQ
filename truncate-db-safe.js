const db = require('./src/config/db');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askConfirmation() {
    return new Promise((resolve) => {
        rl.question(
            '\n⚠️  WARNING: This will DELETE ALL DATA from all tables!\n' +
            'Are you sure? Type "DELETE ALL DATA" to confirm: ',
            (answer) => {
                rl.close();
                resolve(answer === 'DELETE ALL DATA');
            }
        );
    });
}

async function truncateAllTables() {
    try {
        const confirmed = await askConfirmation();

        if (!confirmed) {
            console.log('\n❌ Truncation cancelled.');
            process.exit(0);
        }

        console.log('\n🔄 Proceeding with truncation...\n');

        // Disable foreign key constraints temporarily
        await db.query('SET session_replication_role = replica;');
        console.log('✅ Disabled foreign key constraints');

        // Truncate all tables
        const tables = [
            'transactions',
            'customers',
            'subscriptions',
            'personaliq_transactions',
            'personaliq_customers',
            'personaliq_subscriptions',
            'personaliq_users',
            'onboarding_leads',
            'app_mode_leads',
            'app_profiles',
            'users'
        ];

        for (const table of tables) {
            try {
                await db.query(`TRUNCATE TABLE ${table} CASCADE;`);
                console.log(`✅ Truncated: ${table}`);
            } catch (err) {
                console.log(`⏭️  Skipped: ${table} (table may not exist)`);
            }
        }

        // Reset sequences
        const sequences = [
            'users_id_seq',
            'customers_id_seq',
            'transactions_id_seq',
            'subscriptions_id_seq',
            'personaliq_users_id_seq',
            'personaliq_customers_id_seq',
            'personaliq_transactions_id_seq',
            'personaliq_subscriptions_id_seq',
            'onboarding_leads_id_seq',
            'app_mode_leads_id_seq',
            'app_profiles_id_seq'
        ];

        console.log('\n🔄 Resetting sequences...');
        for (const seq of sequences) {
            try {
                await db.query(`ALTER SEQUENCE ${seq} RESTART WITH 1;`);
                console.log(`✅ Reset sequence: ${seq}`);
            } catch (err) {
                console.log(`⏭️  Skipped: ${seq} (sequence may not exist)`);
            }
        }

        // Re-enable foreign key constraints
        await db.query('SET session_replication_role = default;');
        console.log('\n✅ Re-enabled foreign key constraints');

        console.log('\n✅ Database truncation complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Truncation error:', err.message);
        process.exit(1);
    }
}

truncateAllTables();
