const axios = require('axios');

async function testWebhook(messageBody, waId) {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ wa_id: waId }],
              messages: [{ type: 'text', text: { body: messageBody } }],
            },
          },
        ],
      },
    ],
  };

  try {
    await axios.post('http://localhost:3000/api/webhook/whatsapp', payload);
    console.log(`\n[OK] Simulated WhatsApp message sent: "${messageBody}" (wa_id=${waId})\n`);
    console.log(
      'Check the terminal running `npm start` to see VyapaarIQ’s reply (it prints as [SIMULATION] ... if WhatsApp creds are not set).',
    );
  } catch (error) {
    console.error('[ERROR] Failed to send message to local server. Make sure the server is running on http://localhost:3000.');
    if (error.response) {
      console.error(`[ERROR] HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`[ERROR] ${error.message}`);
    }
  }
}

const messageArg = process.argv.slice(2).join(' ').trim();
const waId = process.env.WA_ID || '919876543210';

if (!messageArg) {
  console.log('\nUsage: node test-message.js "YOUR_MESSAGE"');
  console.log('Example: node test-message.js "S 2000 saree"\n');
  console.log('Optional: set WA_ID env var to change the sender phone number (WhatsApp wa_id).');
} else {
  testWebhook(messageArg, waId);
}

