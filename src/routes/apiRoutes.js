const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const paymentController = require('../controllers/paymentController');

// WhatsApp Webhook verification
router.get('/webhook/whatsapp', whatsappController.verifyWebhook);

// WhatsApp incoming messages
router.post('/webhook/whatsapp', whatsappController.handleIncomingMessage);

// Razorpay Webhook for payment confirmation
router.post('/webhook/razorpay', paymentController.handleWebhook);

module.exports = router;
