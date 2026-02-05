/**
 * Debug Script for Gemini API Errors (403/429/etc)
 * Usage: node backend/scripts/debug_ai_errors.js
 */

require('dotenv').config();
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const GeminiProcessor = require('../src/services/geminiProcessor');

// Configuration
const API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
// Optional Proxy for testing (set EUBIKE_PROXY_URL/HUNTER_PROXY_URL/HTTPS_PROXY)

console.log('═══════════════════════════════════════');
console.log('🤖 GEMINI API DEBUGGER');
console.log('═══════════════════════════════════════');
console.log(`🔑 Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'MISSING'}`);
console.log(`🌐 URL: ${API_URL}`);
// console.log(`🛡️ Proxy: ${PROXY_URL || 'DISABLED'}`);
console.log('═══════════════════════════════════════');

if (!API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY / GEMINI_API_KEY_1 in environment.');
    process.exit(1);
}

async function testDirectConnection() {
    console.log('\n1️⃣  TESTING DIRECT CONNECTION (axios)...');
    try {
        const response = await axios.post(
            `${API_URL}?key=${API_KEY}`,
            {
                contents: [{ parts: [{ text: "Hello, reply with 'OK'." }] }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
                // proxy: false
            }
        );
        console.log('✅ Success!');
        console.log('   Response:', response.data?.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (error) {
        logAxiosError(error);
    }
}

async function testViaProcessor() {
    console.log('\n2️⃣  TESTING VIA GEMINI PROCESSOR...');
    try {
        // Manually trigger the callGeminiAPI method
        const result = await GeminiProcessor.callGeminiAPI("Hello, reply with JSON: { \"status\": \"OK\" }");
        console.log('✅ Success!');
        console.log('   Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Processor failed:', error.message);
    }
}

function logAxiosError(error) {
    if (error.response) {
        console.error(`❌ API Error: ${error.response.status} ${error.response.statusText}`);
        console.error('   Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
        console.error('❌ No response received (Network/Timeout?)');
        console.error('   Error:', error.message);
    } else {
        console.error('❌ Setup Error:', error.message);
    }
}

async function run() {
    await testDirectConnection();
    await testViaProcessor();
}

run();

