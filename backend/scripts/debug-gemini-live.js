const gemini = require('../src/services/geminiProcessor');

async function debugGeminiLive() {
    console.log('🧪 LIVE DIAGNOSTIC: Gemini API Call...');
    console.log('Objective: Verify that gemini-2.5-flash is reachable and returns valid JSON structure.');

    const bikeData = {
        title: "DEBUG BIKE - Specialized Stumpjumper",
        description: "Debug test description.",
        attributes: { "Brand": "Specialized" },
        images: []
    };

    try {
        console.log('Sending request to Gemini...');
        const start = Date.now();
        const result = await gemini.performInitialInspection(bikeData);
        const duration = Date.now() - start;

        console.log(`✅ Response received in ${duration}ms`);
        
        if (result.error) {
            console.error('❌ API Returned Error Object:', result.error);
            process.exit(1);
        }

        if (result.checklist && result.german_inquiry_message) {
            console.log('✅ Structure Validated: Checklist and German Message present.');
            console.log('Sample Message:', result.german_inquiry_message.substring(0, 50) + '...');
        } else {
            console.error('❌ Invalid Structure:', JSON.stringify(result, null, 2));
            process.exit(1);
        }

    } catch (e) {
        console.error('❌ CRITICAL FAILURE:', e);
        if (e.response) {
            console.error('Response Status:', e.response.status);
            console.error('Response Data:', JSON.stringify(e.response.data, null, 2));
        }
        process.exit(1);
    }
}

debugGeminiLive();
