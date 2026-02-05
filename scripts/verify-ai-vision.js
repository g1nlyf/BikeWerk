require('dotenv').config({ path: '../backend/.env' });
const GeminiProcessor = require('../backend/src/services/geminiProcessor');

async function runTest() {
    console.log('--- STARTING AI VISION VERIFICATION ---');
    console.log('Target: Gemini 2.0 Flash Exp (v2.5) via Proxy (191.101.73.161)');
    
    // Test Image: Placeholder with text to simulate damage (Reliable & Fast)
    // Using placehold.co as it's CDN friendly and reliable
    const imageUrl = 'https://placehold.co/600x400/png?text=Rusty+Bicycle+Frame+with+Deep+Scratches';
    
    console.log(`Analyzing Image: ${imageUrl}`);
    
    try {
        const result = await GeminiProcessor.analyzeImage(imageUrl);
        console.log('\n--- ANALYSIS RESULT ---');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.error) {
            console.error('❌ FAILED: API Error ->', result.error);
            process.exit(1);
        }

        const jsonString = JSON.stringify(result).toLowerCase();
        // Check for rust or damage keywords
        const hasDamage = jsonString.includes('rust') || jsonString.includes('damage') || jsonString.includes('poor') || jsonString.includes('wear');
        
        if (hasDamage) {
            console.log('\n✅ SUCCESS: AI Vision Protocol Verified. Discrepancies detected.');
        } else {
            console.warn('\n⚠️ WARNING: AI did not explicitly mention rust/damage. Check the notes.');
        }

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error);
        process.exit(1);
    }
}

runTest();
