
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');

// Hardcode keys from .env to be sure
const GEMINI_API_KEY = 'AIzaSyBwFKlgRwTPpx8Ufss9_aOYm9zikt9SGj0';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const PROXY_URL = 'http://user258350:otuspk@191.101.73.161:8984';

// Images Directory
const IMAGES_DIR = path.resolve(__dirname, '../frontend/public/journal references');

async function analyzeImages() {
    console.log(`📂 Scanning directory: ${IMAGES_DIR}`);
    
    if (!fs.existsSync(IMAGES_DIR)) {
        console.error('❌ Directory not found!');
        return;
    }

    const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    console.log(`📸 Found ${files.length} images.`);

    for (const file of files) {
        const filePath = path.join(IMAGES_DIR, file);
        console.log(`\n🔍 Analyzing: ${file}...`);
        
        try {
            const description = await analyzeImageWithGemini(filePath);
            console.log(`✅ Description for ${file}:`);
            console.log(description);
            console.log('-'.repeat(40));
        } catch (e) {
            console.error(`❌ Failed to analyze ${file}:`, e.message);
        }
    }
}

async function analyzeImageWithGemini(filePath) {
    // 1. Prepare Image
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // 2. Prepare Payload
    const requestBody = {
        contents: [{
            parts: [
                { text: "Describe this bicycle-related image in detail. Identify if it shows a specific component (drivetrain, brakes, frame), a type of bike (MTB, Road, Gravel), or a riding scenario. Keep it concise (2-3 sentences). Return in RUSSIAN." },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Image
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200
        }
    };

    // 3. Send Request (via Proxy)
    const agent = new HttpsProxyAgent(PROXY_URL);
    const url = `${GEMINI_URL}?key=${GEMINI_API_KEY}`;
    
    try {
        const response = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            httpsAgent: agent,
            proxy: false 
        });

        return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
         if (error.response) {
            throw new Error(`Gemini API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
         }
         throw error;
    }
}

analyzeImages();
