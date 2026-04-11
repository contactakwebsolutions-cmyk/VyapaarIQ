const db = require('../config/db');

async function createTrialSubscription(userId) {
    try {
        await db.query(`
            INSERT INTO subscriptions (user_id, status, plan_type, start_date, end_date) 
            VALUES ($1, 'active', 'trial', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days')
        `, [userId]);
        console.log(`Trial created for user ${userId}`);
    } catch (error) {
        console.error('Error creating trial subscription:', error);
    }
}

async function activateSubscription(userId, planType) {
    try {
        // 1. Check if user already has an active subscription to extend from
        const res = await db.query(
            'SELECT end_date FROM subscriptions WHERE user_id = $1 AND status = \'active\' ORDER BY end_date DESC LIMIT 1',
            [userId]
        );
        
        let baseDate = new Date();
        if (res.rows.length > 0) {
            const currentEnd = new Date(res.rows[0].end_date);
            if (currentEnd > baseDate) {
                baseDate = currentEnd; // Extend from current end_date
            }
        }

        // 2. Calculate new end date (30 days from baseDate)
        const newEndDate = new Date(baseDate);
        newEndDate.setDate(newEndDate.getDate() + 30);

        // 3. Deactivate current active subscriptions
        await db.query(`UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'`, [userId]);

        // 4. Create new active subscription
        await db.query(`
            INSERT INTO subscriptions (user_id, status, plan_type, start_date, end_date)
            VALUES ($1, 'active', $2, CURRENT_TIMESTAMP, $3)
        `, [userId, planType, newEndDate]);
        
        console.log(`Subscription activated/extended for user ${userId}: ${planType}. New end date: ${newEndDate}`);
        return newEndDate;
    } catch (error) {
        console.error('Error activating subscription:', error);
        throw error;
    }
}

async function checkSubscription(userId) {
    const res = await db.query(
        'SELECT * FROM subscriptions WHERE user_id = $1 AND status = ' + "'active' ORDER BY end_date DESC LIMIT 1",
        [userId]
    );
    const sub = res.rows[0];
    
    if (sub && new Date(sub.end_date) < new Date()) {
        await db.query(`UPDATE subscriptions SET status = 'expired' WHERE id = $1`, [sub.id]);
        return { ...sub, status: 'expired' };
    }
    
    return sub;
}

module.exports = {
    createTrialSubscription,
    activateSubscription,
    checkSubscription
};
