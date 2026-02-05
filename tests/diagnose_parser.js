const fs = require('fs');
const path = require('path');
const KleinanzeigenParser = require('../telegram-bot/kleinanzeigen-parser');
const GeminiProcessor = require('../telegram-bot/gemini-processor');

async function diagnose() {
    try {
        const htmlPath = path.join(__dirname, 'fixtures', 'complex_ad.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        const url = 'https://www.kleinanzeigen.de/s-anzeige/canyon-spectral-test/123456789';

        console.log('🧪 Starting Diagnosis...');
        
        const parser = new KleinanzeigenParser();
        // Mock fetchHtmlContent to return our fixture
        parser.fetchHtmlContent = async () => html;

        console.log('📥 Parsing HTML...');
        const bikeData = parser.extractBikeData(html, url);

        console.log('\n📋 PARSER EXTRACTED DATA:');
        console.log(JSON.stringify(bikeData, null, 2));

        console.log('\n🤖 Running Gemini Processor...');
        const gp = new GeminiProcessor(process.env.GEMINI_API_KEY || 'PLACEHOLDER', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
        
        // We want to see the prompt or the result. 
        // If we don't have a valid key, we can't get a result, but we can inspect the prompt creation if we access private method or override callGeminiAPI.
        
        // Let's override callGeminiAPI to just return a mock response if key is missing, 
        // OR print the prompt.
        const originalCall = gp.callGeminiAPI;
        gp.callGeminiAPI = async (prompt) => {
            console.log('\n📤 GENERATED PROMPT (Snippet):');
            console.log(prompt.substring(0, 500) + '...\n[...]\n' + prompt.substring(prompt.length - 500));
            
            if (process.env.GEMINI_API_KEY) {
                 return originalCall.call(gp, prompt);
            } else {
                 console.log('⚠️ No API Key, returning mock JSON.');
                 return JSON.stringify({
                     brand: "Canyon",
                     model: "Spectral",
                     year: 2023, // Intentional error to simulate AI confusion
                     frameSize: "L",
                     price: 2350
                 });
            }
        };

        const result = await gp.processBikeData(bikeData);
        console.log('\n🏁 GEMINI OUTPUT JSON:');
        console.log(JSON.stringify(result, null, 2));

    } catch (e) {
        console.error(e);
    }
}

diagnose();
