
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
    try {
        const response = await axios.get(URL);
        console.log("Available Models:");
        const models = response.data.models;
        models.forEach(m => {
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                console.log(`- ${m.name}`);
            }
        });
    } catch (error) {
        console.error("Error listing models:", error.response ? error.response.data : error.message);
    }
}

listModels();
