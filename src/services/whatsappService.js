const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function sendWhatsAppMessage(toPhoneNumber, message) {
    try {
        const token = process.env.WHATSAPP_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_ID;
        
        if (!token || !phoneId) {
            console.log(`[SIMULATION] Sending to ${toPhoneNumber}: ${message}`);
            return;
        }

        await axios.post(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhoneNumber,
            type: 'text',
            text: { preview_url: false, body: message }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response ? error.response.data : error.message);
    }
}

async function uploadMedia(filePath) {
    try {
        const token = process.env.WHATSAPP_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_ID;
        if (!token || !phoneId) return null;

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        form.append('type', 'application/pdf');
        form.append('messaging_product', 'whatsapp');

        const response = await axios.post(`https://graph.facebook.com/v17.0/${phoneId}/media`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        return response.data.id;
    } catch (error) {
        console.error('Media upload error:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function sendWhatsAppDocument(toPhoneNumber, mediaId, filename) {
    try {
        const token = process.env.WHATSAPP_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_ID;
        if (!token || !phoneId) {
            console.log(`[SIMULATION] Sending Document to ${toPhoneNumber}: mediaId ${mediaId}`);
            return;
        }

        await axios.post(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhoneNumber,
            type: 'document',
            document: {
                id: mediaId,
                filename: filename
            }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error sending WhatsApp document:', error.response ? error.response.data : error.message);
    }
}

module.exports = {
    sendWhatsAppMessage,
    uploadMedia,
    sendWhatsAppDocument
};
