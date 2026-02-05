
const path = require('path');
const Database = require('better-sqlite3');
const FMVAnalyzer = require('../src/services/FMVAnalyzer');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');

async function testFMV() {
    console.log('🧪 TESTING FMV ANALYZER STANDALONE');
    console.log(`📂 DB Path: ${DB_PATH}`);

    try {
        const db = new Database(DB_PATH, { readonly: true });
        const analyzer = new FMVAnalyzer(db);

        // Test 1: Known model with data (hopefully)
        // We know we scraped "Specialized Stumpjumper" and "Canyon Neuron" in previous tests (if they saved to market_history)
        // In verify-sprint-final.js, we logged to market_history.
        
        console.log('\n--- TEST 1: Specialized Stumpjumper 2021 ---');
        const result1 = await analyzer.getFairMarketValue('Specialized', 'Stumpjumper', 2021);
        console.log('Result:', JSON.stringify(result1, null, 2));

        console.log('\n--- TEST 2: Canyon Neuron 2023 ---');
        const result2 = await analyzer.getFairMarketValue('Canyon', 'Neuron', 2023);
        console.log('Result:', JSON.stringify(result2, null, 2));

        console.log('\n--- TEST 3: Non-existent bike (Estimation) ---');
        const result3 = await analyzer.getFairMarketValue('NonExistent', 'GhostBike', 2022, { frameMaterial: 'carbon' });
        console.log('Result:', JSON.stringify(result3, null, 2));

        db.close();
    } catch (e) {
        console.error('❌ ERROR:', e);
    }
}

testFMV();
