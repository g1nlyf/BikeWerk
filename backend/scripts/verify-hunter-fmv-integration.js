const { DatabaseManager } = require('../src/js/mysql-config');
const unifiedNormalizer = require('../src/services/UnifiedNormalizer');

async function testIntegration() {
    console.log('🧪 Starting Hunter-FMV Integration Test...');
    
    const dbManager = new DatabaseManager();
    await dbManager.initialize();

    // 1. Setup Mock Data in market_history
    console.log('   🛠️ Setting up mock market_history data...');
    const mockData = [
        { price: 2100, brand: 'YT', model: 'Capra', year: 2023, source: 'buycycle' },
        { price: 2200, brand: 'YT', model: 'Capra', year: 2023, source: 'buycycle' },
        { price: 2300, brand: 'YT', model: 'Capra', year: 2023, source: 'buycycle' },
        { price: 2150, brand: 'YT', model: 'Capra', year: 2023, source: 'buycycle' },
        { price: 2250, brand: 'YT', model: 'Capra', year: 2023, source: 'buycycle' }
    ];

    // Clean up previous test data
    await dbManager.query("DELETE FROM market_history WHERE brand='YT' AND model='Capra' AND year=2023");

    for (const item of mockData) {
        await dbManager.query(`
            INSERT INTO market_history (brand, model, price_eur, year, source_platform, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [item.brand, item.model, item.price, item.year, item.source]);
    }
    console.log('   ✅ Mock data inserted (5 records, median ~2200).');

    // 2. Run Normalizer with FMV Enrichment
    console.log('   🏃 Running UnifiedNormalizer...');
    
    const rawData = {
        title: 'YT Capra 2023 Good Condition',
        price: 2000, 
        url: 'https://test.com/bike1',
        description: 'Selling my YT Capra 2023.',
        source_platform: 'manual_test'
    };

    const richRawData = {
        ...rawData,
        brand: 'YT',
        model: 'Capra',
        year: 2023
    };
    
    // Re-run with rich data
    const result2 = await unifiedNormalizer.normalize(richRawData, 'manual', { useGemini: false });

    // 3. Verify Results
    console.log('   🔍 Verifying Result...');
    
    if (result2.basic_info?.brand === 'YT' && result2.basic_info?.model === 'Capra') {
        console.log(`   ✅ Identity: ${result2.basic_info.brand} ${result2.basic_info.model} ${result2.basic_info.year}`);
        
        if (result2.pricing?.fmv) {
            console.log(`   ✅ FMV Found: ${result2.pricing.fmv} (Confidence: ${result2.pricing.fmv_confidence})`);
            console.log(`   ✅ Market Comparison: ${result2.pricing.market_comparison}`);
            console.log(`   ✅ Price: ${result2.pricing.price}`);
        } else {
            console.error('   ❌ FMV Missing in result!');
            console.log('   Debug result:', JSON.stringify(result2, null, 2));
        }
    } else {
        console.warn('   ⚠️ Could not extract identity from manual input. Test might be inconclusive without Gemini.');
        console.log('   Debug result:', JSON.stringify(result2, null, 2));
    }

    console.log('🏁 Test Complete.');
    process.exit(0);
}

testIntegration().catch(e => {
    console.error(e);
    process.exit(1);
});
