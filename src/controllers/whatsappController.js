const { parseMessage } = require('../services/parserService');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { requireSubscription } = require('../middlewares/subscriptionMiddleware');
const { routeMessage } = require('../services/appRouterService');

const verifyWebhook = (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === verify_token) {
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
};

const handleIncomingMessage = async (req, res) => {
    try {
        const body = req.body;
        console.log("\n[WEBHOOK RECEIVED] Payload:", JSON.stringify(body, null, 2));

        // Check if event is from WhatsApp API
        if (body.object) {
            if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
                
                requireSubscription(req, res, async () => {
                    const msg = body.entry[0].changes[0].value.messages[0];
                    const phoneNumber = msg.from;

                    if (msg.type === 'text') {
                        const text = msg.text.body;
                        const commandObj = parseMessage(text);
                        
                        const subscriptionInfo = {
                            status: req.subscriptionStatus,
                            planType: req.planType,
                            paymentLink: req.paymentLink
                        };

                        const responseText = await routeMessage({
                            user: req.user,
                            phoneNumber,
                            text,
                            businessCommandObj: commandObj,
                            subscriptionInfo
                        });
                        await sendWhatsAppMessage(phoneNumber, responseText);
                    }
                    
                    return res.sendStatus(200);
                });
            } else {
                res.sendStatus(200);
            }
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
};

module.exports = {
    verifyWebhook,
    handleIncomingMessage
};
