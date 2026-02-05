const AutonomousOrchestrator = require('./AutonomousOrchestrator');
const BikesDatabase = require('./bikes-database-node');
const SupplyGapAnalyzer = require('./SupplyGapAnalyzer');

async function testBountySystem() {
    console.log('🧪 Starting Sniper Bounty Test...');
    
    const db = new BikesDatabase();
    await db.ensureInitialized();
    const gapAnalyzer = new SupplyGapAnalyzer();

    // 1. Create a Bounty
    console.log('📝 Creating Bounty for "Canyon Aeroad L < 3000€"...');
    await db.runQuery(`
        INSERT INTO bounties (user_id, category, brand, model, size, max_price, min_grade)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['test_user_1', 'Road', 'Canyon', 'Aeroad', 'L', 3000, 'B']);
    console.log('✅ Bounty Created.');

    // 2. Check Priorities (Should see boost)
    console.log('📊 Checking Priorities...');
    const priorities = await gapAnalyzer.analyzeGaps();
    const roadPriority = priorities.find(p => p.category === 'Road');
    
    if (roadPriority && roadPriority.score > 10) {
        console.log(`✅ Priority Boost Confirmed! Road Score: ${roadPriority.score} (Normal ~1-2)`);
    } else {
        console.error(`❌ Priority Boost Failed. Road Score: ${roadPriority ? roadPriority.score : 'N/A'}`);
    }

    // 3. Match a Bike
    console.log('🚴 Simulating Bike Discovery...');
    const mockBike = {
        brand: 'Canyon',
        model: 'Aeroad CF SLX',
        category: 'Road',
        size: 'L',
        price: 2800,
        initial_quality_class: 'A'
    };

    const matches = await gapAnalyzer.matchBounty(mockBike);
    if (matches.length > 0) {
        console.log(`✅ MATCH CONFIRMED! Matched Bounty ID: ${matches[0].id}`);
    } else {
        console.error('❌ Match Failed.');
    }

    console.log('✨ Sniper Bounty Test Complete.');
}

testBountySystem();
