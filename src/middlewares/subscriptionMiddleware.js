const db = require('../config/db');
const { createTrialSubscription, checkSubscription } = require('../services/subscriptionService');
const { getPaymentLink } = require('../services/paymentService');

/**
 * Middleware to ensure the user has an active subscription.
 * Also handles user auto-creation and trial assignment.
 */
async function requireSubscription(req, res, next) {
    try {
        const body = req.body;
        
        // Validate WhatsApp Webhook body structure
        if (!body.entry || !body.entry[0].changes || !body.entry[0].changes[0].value.messages) {
            return res.status(200).send('OK'); 
        }
        
        // Use the 'from' field from the first message for robustness
        const rawPhoneNumber = body.entry[0].changes[0].value.messages[0].from;
        
        // 1. Find or Create User
        let userResult = await db.query('SELECT * FROM users WHERE phone_number = $1', [rawPhoneNumber]);
        let user = userResult.rows[0];
        
        if (!user) {
            // Do not persist a full user record until language is confirmed during onboarding.
            // We still pass a minimal "user-like" object forward so onboarding can run.
            req.user = { id: null, phone_number: rawPhoneNumber };
            req.subscriptionStatus = 'active';
            req.planType = 'trial';
            return next();
        }
        
        // 3. Check Subscription Status
        const subscription = await checkSubscription(user.id);
        
        if (!subscription || subscription.status === 'expired') {
            const paymentLink = await getPaymentLink(user.id, rawPhoneNumber, 'standard');
            req.user = user;
            req.subscriptionStatus = 'expired';
            req.paymentLink = paymentLink;
            req.planType = 'none';
        } else {
            req.user = user;
            req.subscriptionStatus = 'active';
            req.planType = subscription.plan_type || 'trial';
        }
        
        next();
    } catch (error) {
        console.error('Error in subscriptionMiddleware:', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    requireSubscription
};
