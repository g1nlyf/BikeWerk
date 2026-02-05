const axios = require('axios');

const API_KEY = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS || '').split(/[,;|\s]+/).filter(Boolean)[0] || '';
if (!API_KEY) {
    console.error('No GEMINI_API_KEY configured. Set GEMINI_API_KEY or GEMINI_API_KEYS.');
    process.exit(1);
}

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    console.log(`Listing models...`);
    
    try {
        const response = await axios.get(url);
        console.log('Available Models:');
        response.data.models.forEach(m => {
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                console.log(`- ${m.name}`);
            }
        });
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        if (error.response) console.log(error.response.data);
    }
}

listModels();
