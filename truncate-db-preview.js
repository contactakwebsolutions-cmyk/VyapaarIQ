// This script shows what SQL commands will be executed to truncate all tables
// It does NOT execute them - just displays them for review

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

console.log('📋 SQL Commands to Truncate All Tables:\n');
console.log('='.repeat(60) + '\n');

console.log('-- Disable foreign key constraints');
console.log('SET session_replication_role = replica;\n');

console.log('-- Truncate tables');
tables.forEach(table => {
    console.log(`TRUNCATE TABLE ${table} CASCADE;`);
});

console.log('\n-- Reset sequences');
sequences.forEach(seq => {
    console.log(`ALTER SEQUENCE ${seq} RESTART WITH 1;`);
});

console.log('\n-- Re-enable foreign key constraints');
console.log('SET session_replication_role = default;\n');

console.log('='.repeat(60));
console.log('\nTo execute these commands:');
console.log('  1. Safe version with confirmation: node truncate-db-safe.js');
console.log('  2. Direct execution: node truncate-db.js');
console.log('\nOr paste the SQL above directly into your database client.');
