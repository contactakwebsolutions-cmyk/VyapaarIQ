const axios = require('axios');
const crypto = require('crypto');
const db = require('../src/config/db');

async function simulatePayment(phoneNumber, planType = 'standard') {
    try {
        console.log(`\n--- Simulating Razorpay Payment for ${phoneNumber} ---`);
        
        const userRes = await db.query('SELECT id FROM users WHERE phone_number = $1', [phoneNumber]);
        if (userRes.rows.length === 0) {
            console.error('❌ User not found. Please message the bot first.');
            return;
        }
        const userId = userRes.rows[0].id;

        const payload = {
            event: 'payment_link.paid',
            payload: {
                payment_link: {
                    entity: {
                        notes: {
                            user_id: userId,
                            phone: phoneNumber,
                            plan_type: planType
                        }
                    }
                }
            }
        };

        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_razorpay_webhook_secret';
        const signature = crypto.createHmac('sha256', secret)
                               .update(JSON.stringify(payload))
                               .digest('hex');

        console.log('Sending mock webhook to http://localhost:3000/api/webhook/razorpay...');
        
        const response = await axios.post('http://localhost:3000/api/webhook/razorpay', payload, {
            headers: {
                'x-razorpay-signature': signature,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Local Server Response:', response.status, response.data);
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

const phone = process.argv[2];
const plan = process.argv[3] || 'standard';
if (!phone) {
    console.log('Usage: node simulate-payment.js <phone_number> [standard|pro]');
} else {
    simulatePayment(phone, plan);
}
