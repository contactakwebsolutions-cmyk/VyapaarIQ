const db = require('../src/config/db');

async function simulateExpiry(phoneNumber) {
    try {
        console.log(`Manually expiring subscription for ${phoneNumber}...`);
        
        const userRes = await db.query('SELECT id FROM users WHERE phone_number = $1', [phoneNumber]);
        if (userRes.rows.length === 0) {
            console.error('❌ User not found.');
            return;
        }
        const userId = userRes.rows[0].id;

        await db.query(`
            UPDATE subscriptions 
            SET status = 'expired', end_date = CURRENT_TIMESTAMP - INTERVAL '1 day'
            WHERE user_id = $1
        `, [userId]);

        console.log('✅ Subscription marked as EXPIRED.');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        // process.exit();
    }
}

const phone = process.argv[2];
if (!phone) {
    console.log('Usage: node simulate-expiry.js <phone_number>');
} else {
    simulateExpiry(phone);
}
