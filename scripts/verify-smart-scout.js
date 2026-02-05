const axios = require('axios');
const path = require('path');
const { SmartScoutService } = require('../backend/src/services/SmartScoutService.js');
const { DatabaseManager } = require('../backend/src/js/mysql-config.js');

const API_URL = 'http://localhost:8082/api/scout';

async function main() {
    console.log('🕵️ Starting Smart Scout & AI Concierge Verification...');

    // 1. Test Semantic Search
    const query = "Carbon road bike for tall people under 2000";
    console.log(`\n🔍 Testing Search: "${query}"`);

    try {
        const res = await axios.post(`${API_URL}/search`, { 
            query,
            sessionId: 'test-session-123' 
        });
        
        const data = res.data;
        console.log('✅ Search Response:', JSON.stringify(data.filters, null, 2));
        
        if (data.filters.material?.toLowerCase() !== 'carbon') console.error('❌ Failed to detect material: carbon');
        if (!data.filters.sizes?.includes('XL')) console.error('❌ Failed to detect size: XL');
        if (data.filters.max_price !== 2000 && data.filters.max_price !== '2000') console.error('❌ Failed to detect max_price: 2000');
        
        if (data.sniper_created) {
            console.log('✅ Wishlist Sniper auto-created (No results found).');
        } else {
            console.log(`✅ Found ${data.count} results.`);
        }

    } catch (e) {
        console.error('❌ Search Failed:', e.message);
        if (e.response) console.error(e.response.data);
    }

    // 2. Test Wishlist Sniper Matching Logic (Direct Service Call)
    console.log('\n🎯 Testing Sniper Matching Logic...');
    
    // Create a mock sniper manually if not created above (or just to be sure)
    const db = new DatabaseManager();
    const service = new SmartScoutService(db);
    
    // Ensure we have a sniper
    const sniperId = await service.createWishlistSniper(
        1, 'test-session-123', "Cheap gravel bike", 
        { type: 'gravel', max_price: 1500 }
    );
    
    // Mock incoming bikes
    const newBikes = [
        {
            id: 9991,
            brand: 'Canyon',
            model: 'Grizl CF SL',
            category: 'Gravel',
            price: 1400, // Should match
            description: 'Great gravel bike'
        },
        {
            id: 9992,
            brand: 'Specialized',
            model: 'Tarmac',
            category: 'Road',
            price: 5000, // Should NOT match (wrong type & price)
            description: 'Fast road bike'
        }
    ];
    
    const matches = await service.checkSnipers(newBikes);
    console.log(`Found ${matches.length} matches.`);
    
    const match = matches.find(m => m.bike_id === 9991);
    if (match) {
        console.log(`✅ Sniper matched correctly: ${match.bike_name} (Score: ${match.score})`);
    } else {
        console.error('❌ Sniper FAILED to match valid bike.');
    }
    
    const badMatch = matches.find(m => m.bike_id === 9992);
    if (badMatch) {
        console.error('❌ Sniper INCORRECTLY matched invalid bike.');
    } else {
        console.log('✅ Sniper correctly ignored invalid bike.');
    }

    // 3. Test Matchmaker Swipe
    console.log('\n❤️ Testing Matchmaker Swipe...');
    
    // Get a valid bike ID first
    let validBikeId = 1;
    try {
        const bikeRes = await axios.get('http://localhost:8082/api/brands/Specialized'); // Assuming Specialized exists, or just query search
        if (bikeRes.data.bikes && bikeRes.data.bikes.length > 0) {
            validBikeId = bikeRes.data.bikes[0].id;
        }
    } catch (e) {
        console.warn('⚠️ Could not fetch real bike ID, using 1');
    }

    try {
        await axios.post('http://localhost:8082/api/matchmaker/swipe', {
            userId: 1,
            bikeId: validBikeId,
            action: 'like'
        });
        console.log(`✅ Swipe saved successfully for Bike #${validBikeId}.`);
    } catch (e) {
        console.error('❌ Swipe Failed:', e.message);
        if (e.response) console.error(e.response.data);
    }

    // Cleanup
    const rawDb = require('sqlite3').verbose();
    const dbConn = new rawDb.Database(path.join(__dirname, '../backend/database/eubike.db'));
    dbConn.run("DELETE FROM wishlist_snipers WHERE session_id = 'test-session-123'", () => dbConn.close());

    console.log('\n✨ Verification Complete!');
    process.exit(0);
}

main().catch(console.error);
