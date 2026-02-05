const AvailabilityChecker = require('../services/availability-checker');
const SmartFreshnessScheduler = require('../services/smart-freshness-scheduler');
const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function test() {
    console.log('🧪 Testing Freshness Validation Pipeline...');
    
    // 1. Setup Test Data
    console.log('\n📝 Inserting test bike...');
    const testId = Date.now();
    await db.query(`
        INSERT INTO bikes (name, brand, model, price, tier, is_active, created_at, last_checked, source_url, source)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), datetime('now', '-2 days'), ?, ?)
    `, [
        'Test Bike Fake', // Added name field
        'TestBrand', 
        'TestModel', 
        1000, 
        1, // Tier 1 should be checked daily
        1,
        'https://www.kleinanzeigen.de/s-anzeige/test-bike-fake/123456', // Fake URL will 404
        'kleinanzeigen'
    ]);
    
    // 2. Test Scheduler
    console.log('\n🧠 Testing Smart Scheduler...');
    const queue = await SmartFreshnessScheduler.getCheckQueue(10);
    console.log(`Queue size: ${queue.length}`);
    
    const testBikeInQueue = queue.find(b => b.brand === 'TestBrand');
    if (testBikeInQueue) {
        console.log('✅ Test bike correctly prioritized for checking.');
        console.log('Priority Details:', testBikeInQueue.check_priority);
    } else {
        console.log('❌ Test bike NOT in queue (unexpected).');
    }
    
    // 3. Test Availability Check (Expect Deletion due to 404)
    console.log('\n🔍 Testing Availability Check (Expect 404/Deleted)...');
    // We use the inserted bike
    const bikes = await db.query(`SELECT * FROM bikes WHERE brand='TestBrand'`);
    if (bikes.length > 0) {
        const bike = bikes[0];
        const status = await AvailabilityChecker.checkBikeAvailability(bike);
        console.log(`Check Result: ${status}`);
        
        if (status === 'deleted') {
            console.log('✅ Correctly identified as deleted (404).');
            await AvailabilityChecker.deactivateBike(bike.id, status);
            
            // Verify DB update
            const updated = await db.query(`SELECT is_active, deactivation_reason FROM bikes WHERE id=${bike.id}`);
            if (updated[0].is_active === 0 && updated[0].deactivation_reason === 'deleted') {
                console.log('✅ DB updated: is_active=0');
            } else {
                console.log('❌ DB update failed.');
            }
        } else {
            console.log('⚠️ Unexpected status:', status);
        }
    }
    
    // Cleanup
    await db.query(`DELETE FROM bikes WHERE brand='TestBrand'`);
    
    process.exit(0);
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});
