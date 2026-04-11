const { createTrialSubscription, checkSubscription } = require('./src/services/subscriptionService');
const { createPaymentLink } = require('./src/services/razorpayService');
const db = require('./src/config/db');

async function testSubscriptionFlow() {
    try {
        console.log('Testing Subscription Flow...');
        
        // 1. Create a dummy user
        const testPhone = '910000000000';
        await db.query('DELETE FROM users WHERE phone_number = $1', [testPhone]);
        const userRes = await db.query('INSERT INTO users (phone_number) VALUES ($1) RETURNING id', [testPhone]);
        const userId = userRes.rows[0].id;

        // 2. Create Trial
        console.log('Creating 7-day trial...');
        await createTrialSubscription(userId);
        
        // 3. Check Subscription
        const sub = await checkSubscription(userId);
        console.log('Trial created successfully:', {
            plan: sub.plan_type,
            status: sub.status,
            end_date: sub.end_date
        });

        // 4. Generate Payment Link
        console.log('Generating Razorpay Link...');
        const link = await createPaymentLink(userId, testPhone, 'standard');
        console.log('Standard Payment Link:', link);

        console.log('✅ Subscription Flow Verified.');
    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        // process.exit();
    }
}

testSubscriptionFlow();
