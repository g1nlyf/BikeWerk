const AutonomousOrchestrator = require('./AutonomousOrchestrator');
const BikesDatabase = require('./bikes-database-node');

async function testMarketSense() {
    console.log('🧪 Starting Market Sense Test...');
    
    const db = new BikesDatabase();
    await db.ensureInitialized();
    
    // 1. Clear previous interactions for test purity
    // await db.runQuery('DELETE FROM user_interactions'); 
    // Commented out to preserve history, assuming we just add new ones.

    // 2. Simulate 20 Empty Searches for "Road Bike XL"
    console.log('📉 Simulating 20 empty searches for "Road Bike XL"...');
    const payload = JSON.stringify({
        category: 'Road',
        search: 'Road Bike XL',
        timestamp: new Date().toISOString()
    });

    for (let i = 0; i < 20; i++) {
        await db.runQuery('INSERT INTO user_interactions (event_type, payload) VALUES (?, ?)', 
            ['SEARCH_ABANDON', payload]);
    }
    console.log('✅ Simulated 20 searches.');

    // 3. Run Orchestrator Cycle
    console.log('🔄 Running Orchestrator Cycle...');
    const orchestrator = new AutonomousOrchestrator({
        // Mock Bot
        sendMessage: (chatId, text) => console.log(`[BOT MSG] ${text}`)
    });
    
    // Mock logToBot to see output
    orchestrator.logToBot = (msg) => console.log(`[ORCHESTRATOR LOG] ${msg}`);

    await orchestrator.runCycle();

    console.log('✨ Market Sense Test Complete. Check output for "⚠️ Обнаружен дефицит".');
}

testMarketSense();
