const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'your_razorpay_key_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_key_secret'
});

/**
 * Creates a Razorpay Payment Link for subscriptions
 * @param {number} userId User ID for metadata
 * @param {string} phone Phone number for metadata
 * @param {string} planType 'standard' or 'pro'
 * @returns {Promise<string>} Short URL for the payment link
 */
async function createPaymentLink(userId, phone, planType) {
    try {
        const amount = planType === 'pro' ? 49900 : 29900; // in paise (₹499 or ₹299)
        const description = `VyapaarIQ ${planType.toUpperCase()} Subscription (30 Days)`;

        const response = await razorpay.paymentLink.create({
            amount: amount,
            currency: "INR",
            accept_partial: false,
            description: description,
            customer: {
                name: "VyapaarIQ User",
                contact: phone
            },
            notify: {
                sms: false,
                email: false
            },
            reminder_enable: true,
            notes: {
                user_id: userId,
                plan_type: planType,
                phone: phone
            },
            callback_url: "https://yourwebsite.com/payment-success",
            callback_method: "get"
        });

        return response.short_url;
    } catch (error) {
        console.error('Error creating Razorpay payment link:', error);
        return 'https://razorpay.me/@vyapaariq'; // Fallback
    }
}

module.exports = {
    createPaymentLink
};
