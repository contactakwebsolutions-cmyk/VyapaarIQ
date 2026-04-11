const db = require('../config/db');

async function createTrialSubscription(personalUserId) {
    await db.query(`
        INSERT INTO personaliq_subscriptions (personaliq_user_id, status, plan_type, start_date, end_date)
        VALUES ($1, 'active', 'trial', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days')
    `, [personalUserId]);
}

async function checkSubscription(personalUserId) {
    const res = await db.query(
        "SELECT * FROM personaliq_subscriptions WHERE personaliq_user_id = $1 AND status = 'active' ORDER BY end_date DESC LIMIT 1",
        [personalUserId]
    );
    const sub = res.rows[0];

    if (sub && new Date(sub.end_date) < new Date()) {
        await db.query("UPDATE personaliq_subscriptions SET status = 'expired' WHERE id = $1", [sub.id]);
        return { ...sub, status: 'expired' };
    }

    return sub;
}

async function activateSubscription(personalUserId, planType) {
    const res = await db.query(
        "SELECT end_date FROM personaliq_subscriptions WHERE personaliq_user_id = $1 AND status = 'active' ORDER BY end_date DESC LIMIT 1",
        [personalUserId]
    );

    let baseDate = new Date();
    if (res.rows.length > 0) {
        const currentEnd = new Date(res.rows[0].end_date);
        if (currentEnd > baseDate) baseDate = currentEnd;
    }

    const newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + 30);

    await db.query("UPDATE personaliq_subscriptions SET status = 'expired' WHERE personaliq_user_id = $1 AND status = 'active'", [personalUserId]);
    await db.query(`
        INSERT INTO personaliq_subscriptions (personaliq_user_id, status, plan_type, start_date, end_date)
        VALUES ($1, 'active', $2, CURRENT_TIMESTAMP, $3)
    `, [personalUserId, planType, newEndDate]);

    return newEndDate;
}

module.exports = {
    createTrialSubscription,
    checkSubscription,
    activateSubscription
};

