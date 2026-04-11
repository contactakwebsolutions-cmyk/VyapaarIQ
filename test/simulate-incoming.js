const axios = require('axios');

async function simulateIncomingMessage(phoneNumber, text) {
    try {
        console.log(`\n--- Simulating Incoming Message ---`);
        console.log(`From: ${phoneNumber}`);
        console.log(`Text: "${text}"`);
        
        const payload = {
            object: "whatsapp_business_account",
            entry: [
                {
                    id: "939633838648956",
                    changes: [
                        {
                            value: {
                                messaging_product: "whatsapp",
                                metadata: {
                                    display_phone_number: "15551765819",
                                    phone_number_id: "1055858687607653"
                                },
                                contacts: [
                                    {
                                        profile: { name: "Test User" },
                                        wa_id: phoneNumber
                                    }
                                ],
                                messages: [
                                    {
                                        from: phoneNumber,
                                        id: "wamid." + Math.random().toString(36).substring(7),
                                        timestamp: Math.floor(Date.now() / 1000).toString(),
                                        text: { body: text },
                                        type: "text"
                                    }
                                ]
                            },
                            field: "messages"
                        }
                    ]
                }
            ]
        };

        console.log('Sending mock message to http://localhost:3000/api/webhook/whatsapp...');
        
        const response = await axios.post('http://localhost:3000/api/webhook/whatsapp', payload);
        console.log('✅ Local Server Response Status:', response.status);
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

const phone = process.argv[2] || '919000861903';
const text = process.argv.slice(3).join(' ') || 'hi';
simulateIncomingMessage(phone, text);
