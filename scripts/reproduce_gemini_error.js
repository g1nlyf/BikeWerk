const axios = require('axios');

const API_KEY = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS || '').split(/[,;|\s]+/).filter(Boolean)[0] || '';
if (!API_KEY) {
    console.error('No GEMINI_API_KEY configured. Set GEMINI_API_KEY or GEMINI_API_KEYS.');
    process.exit(1);
}
const MODELS = [
    'gemini-2.5-flash'
];

async function testModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    console.log(`Testing model: ${model}`);
    
    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "Hello, are you there?" }] }]
        });
        console.log(`✅ ${model}: Success (Status ${response.status})`);
    } catch (error) {
        if (error.response) {
            console.log(`❌ ${model}: Failed (Status ${error.response.status}) - ${error.response.data.error.message}`);
        } else {
            console.log(`❌ ${model}: Failed (${error.message})`);
        }
    }
}

async function run() {
    for (const model of MODELS) {
        await testModel(model);
    }
}

run();
