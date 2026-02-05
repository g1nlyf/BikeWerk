const axios = require('axios');

const API_KEY = 'AIzaSyBwFKlgRwTPpx8Ufss9_aOYm9zikt9SGj0';

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
