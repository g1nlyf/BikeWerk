const path = require('path');
// Load env vars
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const axios = require('axios');
const UnifiedHunter = require('../../telegram-bot/unified-hunter.js');
// Need ts-node register because UnifiedHunter imports TS files
require('ts-node').register({
    project: path.resolve(__dirname, '../../telegram-bot/tsconfig.json'),
    transpileOnly: true
});

async function runVerification() {
    console.log('🔍 Starting Catalog Sync Verification...');

    // 1. Initialize Hunter
    const hunter = new UnifiedHunter({ logger: console.log });
    await hunter.ensureInitialized();
    console.log('✅ UnifiedHunter Initialized');

    // 2. Add Test Bike
    const testBike = {
        name: 'SYNC_TEST_BIKE_123',
        brand: 'TEST_BRAND',
        model: 'TEST_MODEL',
        price: 999,
        category: 'mtb',
        description: 'This is a test bike to verify synchronization.',
        is_active: 1,
        year: 2024,
        original_url: 'https://test.com/sync-test-123'
    };

    console.log('💾 Adding Test Bike to DB via Hunter...');
    try {
        const result = await hunter.bikesDB.addBike(testBike);
        console.log(`✅ Bike Added. DB ID: ${result.lastID}`);
    } catch (e) {
        console.error('❌ Failed to add bike:', e);
        return;
    }

    // Wait a bit for DB commit/consistency if needed (sqlite is fast usually)
    await new Promise(r => setTimeout(r, 1000));

    // 3. Verify via API
    console.log('🌐 Checking API (http://localhost:8082/api/bikes)...');
    try {
        const response = await axios.get('http://localhost:8082/api/bikes?search=SYNC_TEST_BIKE_123');
        const bikes = response.data.bikes || [];
        
        const found = bikes.find(b => b.name === 'SYNC_TEST_BIKE_123');
        
        if (found) {
            console.log('✅ SUCCESS: Bike found in API response!');
            console.log(`   ID: ${found.id}, Name: ${found.name}, Active: ${found.is_active}`);
        } else {
            console.error('❌ FAILURE: Bike NOT found in API response.');
            console.log('   API Response Summary:', {
                success: response.data.success,
                total: response.data.total,
                bikesCount: bikes.length
            });
        }
    } catch (e) {
        console.error('❌ API Request Failed:', e.message);
        if (e.response) {
            console.error('   Status:', e.response.status);
            console.error('   Data:', e.response.data);
        }
    }
}

runVerification().catch(console.error);
