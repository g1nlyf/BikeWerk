const axios = require('axios');

const API_KEY = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS || '').split(/[,;|\s]+/).filter(Boolean)[0] || '';
const MODEL = 'gemini-2.0-flash-exp';
if (!API_KEY) {
    console.error('No GEMINI_API_KEY configured. Set GEMINI_API_KEY or GEMINI_API_KEYS.');
    process.exit(1);
}
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

async function testGemini() {
    console.log(`Testing ${MODEL}...`);
    
    const requestBody = {
        contents: [{
            parts: [{ text: "Hello, are you working?" }]
        }]
    };

    try {
        const response = await axios.post(URL, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Success!');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testGemini();
