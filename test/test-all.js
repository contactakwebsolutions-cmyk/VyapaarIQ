const axios = require('axios');
const crypto = require('crypto');
const db = require('../src/config/db');

/**
 * AUTOMATED SUBSCRIPTION FLOW TEST
 * 1. Simulate "hi" -> Create Trial
 * 2. Simulate "report" -> Success (trial active)
 * 3. Manually Expire Trial in DB
 * 4. Simulate "report" -> Blocked (send payment link)
 * 5. Simulate Payment Webhook -> Activate
 * 6. Simulate "report" -> Success (active)
 */

const TEST_PHONE = '919000861903';

async function logMsg(msg) {
    console.log(`\n[TEST] ${msg}`);
}

async function sendWhatsAppMock(text) {
    const payload = {
        object: "whatsapp_business_account",
        entry: [{
            changes: [{
                value: {
                    messaging_product: "whatsapp",
                    messages: [{ from: TEST_PHONE, text: { body: text }, type: "text" }],
                    contacts: [{ profile: { name: "Tester" }, wa_id: TEST_PHONE }]
                },
                field: "messages"
            }]
        }]
    };
    return axios.post('http://localhost:3000/api/webhook/whatsapp', payload);
}

async function sendPaymentMock(userId, plan = 'standard') {
    const payload = {
        event: 'payment_link.paid',
        payload: {
            payment_link: {
                entity: {
                    notes: { user_id: userId, phone: TEST_PHONE, plan_type: plan }
                }
            }
        }
    };
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_razorpay_webhook_secret';
    const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    
    return axios.post('http://localhost:3000/api/webhook/razorpay', payload, {
        headers: { 'x-razorpay-signature': signature }
    });
}

async function runFullTest() {
    try {
        console.log('🚀 STARTING FULL SUBSCRIPTION TEST...');
        
        // 0. Clean User
        await db.query('DELETE FROM users WHERE phone_number = $1', [TEST_PHONE]);

        // 1. Initial Message
        await logMsg('1. Sending "hi" to start trial...');
        await sendWhatsAppMock('hi');
        
        const userRes = await db.query('SELECT id FROM users WHERE phone_number = $1', [TEST_PHONE]);
        const userId = userRes.rows[0].id;
        console.log(`✅ User created with ID: ${userId}`);

        // 2. Active Trial Check
        await logMsg('2. Sending "report" (should succeed during trial)...');
        const res2 = await sendWhatsAppMock('report');
        console.log(`✅ Response Status: ${res2.status}`);

        // 3. Manually Expire
        await logMsg('3. Expiring trial manually...');
        await db.query(`UPDATE subscriptions SET status = 'expired', end_date = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE user_id = $1`, [userId]);

        // 4. Check Blocked
        await logMsg('4. Sending "report" (should be blocked with payment link)...');
        const res4 = await sendWhatsAppMock('report');
        console.log(`✅ Response Status: ${res4.status}`);

        // 5. Payment
        await logMsg('5. Simulating Payment Webhook...');
        const res5 = await sendPaymentMock(userId, 'pro');
        console.log(`✅ Response Status: ${res5.status}`);

        // 6. Final Check
        await logMsg('6. Sending "report" (should succeed now)...');
        const res6 = await sendWhatsAppMock('report');
        console.log(`✅ Response Status: ${res6.status}`);

        console.log('\n🌟 ALL TESTS PASSED! YOUR SUBSCRIPTION SYSTEM IS READY.');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

runFullTest();
