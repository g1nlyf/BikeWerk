const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const PROXY_URL = 'http://user258350:otuspk@191.101.73.161:8984';
const API_KEY = 'AIzaSyBwFKlgRwTPpx8Ufss9_aOYm9zikt9SGj0'; // STATIC_KEY from geminiProcessor.js
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function testProxy() {
    console.log('Testing Gemini API via Proxy...');
    console.log('Proxy:', PROXY_URL);
    console.log('Model:', API_URL);

    const agent = new HttpsProxyAgent(PROXY_URL);

    try {
        const response = await axios.post(
            `${API_URL}?key=${API_KEY}`,
            {
                contents: [{ parts: [{ text: "Hello, are you working?" }] }]
            },
            {
                httpsAgent: agent,
                proxy: false,
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
        console.log('✅ Proxy Test Passed!');
    } catch (error) {
        console.error('❌ Proxy Test Failed:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
        }
    }
}

testProxy();
