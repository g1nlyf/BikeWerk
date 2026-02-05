const AutoRefillPipeline = require('../src/services/auto-refill-pipeline');
const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function test() {
    console.log('🧪 Testing Auto-Refill Pipeline...');
    
    // 1. Mock Removed Bike (Tier 1)
    const removedBike = {
        brand: 'Specialized',
        model: 'Stumpjumper',
        tier: 1
    };
    
    console.log(`\nSimulating removal of Tier 1 bike: ${removedBike.brand} ${removedBike.model}`);
    await AutoRefillPipeline.onBikeRemoved(removedBike);
    
    // 2. Verify Queue
    console.log('\nChecking Refill Queue...');
    const queue = await db.query(`SELECT * FROM refill_queue WHERE brand=? AND model=?`, [removedBike.brand, removedBike.model]);
    
    if (queue.length > 0) {
        console.log('✅ Bike added to refill queue.');
        console.log('Queue Entry:', queue[0]);
    } else {
        console.log('❌ Bike NOT found in refill queue.');
    }
    
    // 3. Mock Removed Bike (Tier 3)
    const tier3Bike = {
        brand: 'Cube',
        model: 'Stereo',
        tier: 3
    };
    console.log(`\nSimulating removal of Tier 3 bike: ${tier3Bike.brand} ${tier3Bike.model}`);
    await AutoRefillPipeline.onBikeRemoved(tier3Bike);
    
    // Verify Queue
    const queue3 = await db.query(`SELECT * FROM refill_queue WHERE brand=? AND model=?`, [tier3Bike.brand, tier3Bike.model]);
    if (queue3.length > 0) {
        console.log('✅ Tier 3 bike added to queue (no urgent refill triggered).');
    }
    
    // Cleanup
    await db.query(`DELETE FROM refill_queue WHERE brand IN (?, ?)`, ['Specialized', 'Cube']);
    
    process.exit(0);
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});
