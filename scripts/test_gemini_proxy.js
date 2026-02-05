const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const PROXY_URL =
    process.env.EUBIKE_PROXY_URL ||
    process.env.HUNTER_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.PROXY_URL ||
    '';
const API_KEY = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS || '').split(/[,;|\s]+/).filter(Boolean)[0] || '';
if (!API_KEY) {
    console.error('No GEMINI_API_KEY configured. Set GEMINI_API_KEY or GEMINI_API_KEYS.');
    process.exit(1);
}
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function testProxy() {
    console.log('Testing Gemini API via Proxy...');
    console.log('Proxy:', PROXY_URL || '(none)');
    console.log('Model:', API_URL);

    const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

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
