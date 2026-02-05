const path = require('path');
// Load env vars
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const UnifiedHunter = require('../../telegram-bot/unified-hunter.js');
const ValuationService = require('../../backend/src/services/ValuationService.js');
const DatabaseManager = require('../src/js/mysql-config.js').DatabaseManager;

// Register ts-node for UnifiedHunter dependencies
require('ts-node').register({
    project: path.resolve(__dirname, '../../telegram-bot/tsconfig.json'),
    transpileOnly: true
});

async function runSilentCollector() {
    console.log('🌊 Starting Silent Collector Lake Fill...');

    // 1. Initialize
    const hunter = new UnifiedHunter({ logger: console.log });
    await hunter.ensureInitialized();
    
    // 2. Fill Lake (Multi-Brand)
    const brands = ['Canyon', 'Specialized', 'Cube', 'Trek', 'Scott'];
    const countPerBrand = 20;

    for (const brand of brands) {
        console.log(`\n🌊 Sourcing ${brand}...`);
        await hunter.fetchMarketData(countPerBrand, brand);
        // Short pause between brands to be polite
        await new Promise(r => setTimeout(r, 5000));
    }

    // 2b. Test Visual Judge (Layer 3) on one item
    console.log('\n👁️ Testing Visual Judge (Layer 3)...');
    const db = new DatabaseManager();
    const rows = await db.query('SELECT source_url FROM market_history ORDER BY scraped_at DESC LIMIT 1');
    const lastItem = rows[0];
    
    if (lastItem && lastItem.source_url) {
        console.log(`   Analyzing: ${lastItem.source_url}`);
        await hunter.processListing(lastItem.source_url);
    } else {
        console.log('   ⚠️ No items in market_history to analyze.');
    }

    // 3. Test Valuation
    console.log('\n📊 Testing Valuation Engine...');
    // const db = new BikesDatabase(); // Already declared
    const valuationService = new ValuationService(db);

    // Test Case: Canyon Spectral 2022 Carbon
    const testParams = {
        brand: 'Canyon',
        model: 'Spectral',
        year: 2022,
        material: 'Carbon'
    };

    const valuation = await valuationService.calculateFMV(testParams);
    
    if (valuation) {
        console.log(`✅ Valuation Successful for ${testParams.brand} ${testParams.model} ${testParams.year} ${testParams.material}:`);
        console.log(`   FMV (Median): ${valuation.fmv}€`);
        console.log(`   Confidence: ${valuation.confidence}`);
        console.log(`   Sample Size: ${valuation.sampleSize}`);
        console.log(`   Range: ${valuation.min}€ - ${valuation.max}€`);
    } else {
        console.log(`⚠️ Not enough data yet for valuation of ${testParams.model}. (Need >= 3 samples)`);
    }
    
    // Test Case 2: Generic Canyon (broader search)
    const testParams2 = {
        brand: 'Canyon',
        year: 2021
    };
    const valuation2 = await valuationService.calculateFMV(testParams2);
    if (valuation2) {
         console.log(`✅ Broad Valuation for Canyon 2021: Median ${valuation2.fmv}€ (N=${valuation2.sampleSize})`);
    }
}

runSilentCollector().catch(console.error);
