const db = require('../config/db');
const { sendWhatsAppMessage } = require('../services/whatsappService');

/**
 * Script to send reminders to users whose trial ends tomorrow.
 * Can be run daily via a cron job.
 */
async function sendExpiryReminders() {
    try {
        console.log('Running subscription expiry reminders...');
        
        // Find trials ending between 24 and 48 hours from now
        const res = await db.query(`
            SELECT s.user_id, u.phone_number, s.end_date 
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE s.plan_type = 'trial' 
            AND s.status = 'active'
            AND s.end_date > CURRENT_TIMESTAMP + INTERVAL '23 hours'
            AND s.end_date < CURRENT_TIMESTAMP + INTERVAL '25 hours'
        `);

        for (const sub of res.rows) {
            const msg = `⏳ *Your trial ends tomorrow*\n\n👉 Continue at just ₹10/day (₹299/month)\n\nReply with any command to get your payment link!`;
            await sendWhatsAppMessage(sub.phone_number, msg);
            console.log(`Reminder sent to ${sub.phone_number}`);
        }

        console.log(`Sent ${res.rows.length} reminders.`);
    } catch (error) {
        console.error('Error sending expiry reminders:', error);
    } finally {
        // Only close if running as standalone script
        // process.exit();
    }
}

if (require.main === module) {
    sendExpiryReminders();
}

module.exports = { sendExpiryReminders };
