const BikesDatabase = require('./bikes-database-node');
const LifecycleManager = require('./LifecycleManager');

async function testLifecycle() {
    console.log('🧪 Starting Sprint 2: "Autonomous Pulse" (Verify Lifecycle)...');
    
    const db = new BikesDatabase();
    await db.ensureInitialized();
    
    const mockBot = {
        telegram: {
            sendMessage: (chatId, text) => console.log(`[BOT Mock] To ${chatId}: ${text}`)
        }
    };

    const manager = new LifecycleManager(db, mockBot);

    // 1. Availability Check Simulation
    console.log('\n--- 1. Availability Pulse Check ---');
    // We will check 5 items from DB.
    // Assuming DB has items from Sprint 1 or previous tests.
    
    // Force a check on all items to see logs
    await manager.syncBikes('all');

    // 2. Price Drop Simulation (Manual DB Trigger)
    console.log('\n--- 2. Price Drop Simulation ---');
    // Get a random active bike
    const bike = await db.getQuery('SELECT * FROM bikes WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1');
    
    if (bike) {
        console.log(`   Simulating price drop for: ${bike.brand} ${bike.model} (${bike.id})`);
        console.log(`   Original Price: ${bike.price}€`);
        
        // Simulate finding a lower price
        const newPrice = Math.round(bike.price * 0.9); // 10% drop
        console.log(`   New Detected Price: ${newPrice}€`);
        
        await manager.handlePriceCheck(bike, newPrice);
        
        // Verify DB update
        const updatedBike = await db.getBikeById(bike.id);
        if (updatedBike.price === newPrice) {
            console.log('   ✅ Price updated in DB');
        } else {
            console.error('   ❌ Price update failed');
        }
        
        // Verify Score Update (Should differ)
        if (updatedBike.ranking_score !== bike.ranking_score) {
             console.log(`   ✅ Score recalculated: ${bike.ranking_score} -> ${updatedBike.ranking_score}`);
        } else {
             console.warn('   ⚠️ Score might not have changed significantly or recalc failed');
        }

    } else {
        console.warn('   ⚠️ No active bikes to test price drop.');
    }

    console.log('\n🏁 Sprint 2 Verification Complete.');
}

testLifecycle().catch(console.error);
