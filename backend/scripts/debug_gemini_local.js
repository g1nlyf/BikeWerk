const axios = require('axios');

const API_KEY = 'AIzaSyBwFKlgRwTPpx8Ufss9_aOYm9zikt9SGj0';
const MODEL = 'gemini-2.0-flash-exp';
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
