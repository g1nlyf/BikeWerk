const GeminiProcessor = require('../src/services/geminiProcessor');

async function testGemini() {
    console.log('🤖 Testing Gemini JSON Generation...');
    
    const mockData = {
        source_platform: 'buycycle',
        url: 'https://buycycle.com/test',
        title: 'Specialized Stumpjumper EVO Comp 2022',
        price: 3500,
        currency: 'EUR',
        description: 'Great condition, barely used. S3 size. SRAM GX Eagle.',
        components: {
            frame: 'Carbon',
            fork: 'Fox Float 36 Performance',
            shock: 'Fox Float X Performance',
            brakes: 'SRAM Code R'
        }
    };

    try {
        console.log('📤 Sending request...');
        // We bypass analyzeBikeToUnifiedFormat to call internal methods if needed, 
        // but analyzeBikeToUnifiedFormat is the main entry point that builds the prompt.
        // Let's use the public method to test the full flow including prompt loading.
        
        const result = await GeminiProcessor.analyzeBikeToUnifiedFormat(mockData, 1);
        
        console.log('\n✅ Result parsed successfully:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

testGemini();