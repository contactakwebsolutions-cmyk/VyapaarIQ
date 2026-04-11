const crypto = require('crypto');
const db = require('../config/db');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { activateSubscription } = require('../services/subscriptionService');

const handleWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];
        
        if (!secret || !signature) {
            return res.status(400).send('Missing configuration');
        }

        // Handle case where body is already a string or object
        const bodyContent = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const bodyHash = crypto.createHmac('sha256', secret)
                               .update(bodyContent)
                               .digest('hex');
                               
        if (bodyHash === signature) {
            const event = req.body.event;
            
            if (event === 'payment.captured' || event === 'payment_link.paid') {
                const payload = req.body.payload;
                const entity = payload.payment ? payload.payment.entity : payload.payment_link.entity;
                const notes = entity.notes || {};
                
                const userId = notes.user_id;
                const planType = notes.plan_type || 'standard';
                const phone = notes.phone;
                
                if (userId) {
                    const endDate = await activateSubscription(userId, planType);
                    
                    if (phone) {
                        const confirmMsg = `✅ *Payment received*\n\n🎉 Your subscription is activated\n\nValid till: ${endDate.toLocaleDateString()}`;
                        await sendWhatsAppMessage(phone, confirmMsg);
                    }
                }
            }
            res.status(200).send('OK');
        } else {
            console.warn('Invalid Razorpay signature');
            res.status(400).send('Invalid signature');
        }
    } catch (error) {
        console.error('Razorpay webhook error:', error);
        res.status(500).send('Error');
    }
}

module.exports = {
    handleWebhook
};
