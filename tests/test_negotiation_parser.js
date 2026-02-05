const gemini = require('../backend/src/services/geminiProcessor');

async function testNegotiationParser() {
    const text = "Service war im März 2025, Kette ist neu";
    console.log(`Testing Gemini Negotiation Parser with text: "${text}"`);
    
    try {
        const result = await gemini.analyzeNegotiationContent(text, []);
        console.log('Result:', JSON.stringify(result, null, 2));
        
        if (result && result.bike_specs_confirmed) {
             const specs = result.bike_specs_confirmed;
             if (specs.last_service && specs.last_service.includes('Март 2025')) {
                 console.log('✅ PASS: Last service detected correctly.');
             } else {
                 console.log('❌ FAIL: Last service mismatch.');
             }
             
             if (specs.replaced_parts && specs.replaced_parts.some(p => p.toLowerCase().includes('цепь'))) {
                 console.log('✅ PASS: Chain replacement detected.');
             } else {
                 console.log('❌ FAIL: Chain replacement not detected.');
             }
        } else {
            console.log('❌ FAIL: No specs returned.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

testNegotiationParser();
