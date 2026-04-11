const razorpayService = require('./razorpayService');

/**
 * Payment Service Factory
 * Switches between UPI and Razorpay based on .env configuration
 */
async function getPaymentLink(userId, phone, planType) {
    const method = process.env.PAYMENT_METHOD || 'RAZORPAY';
    
    if (method.toUpperCase() === 'UPI') {
        const upiId = process.env.UPI_ID || '919000861903@ybl';
        const amount = planType === 'pro' ? 499 : 299;
        const name = 'VyapaarIQ';
        
        // Deep link format: upi://pay?pa=ID&pn=NAME&am=AMOUNT&cu=INR
        const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;
        
        // WhatsApp doesn't always hyperlink upi://, so we also provide the ID
        return `${upiLink}\n\n(Or pay to UPI ID: *${upiId}*)`;
    }

    // Default to Razorpay
    return await razorpayService.createPaymentLink(userId, phone, planType);
}

module.exports = {
    getPaymentLink
};
