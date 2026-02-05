const AutonomousOrchestrator = require('./AutonomousOrchestrator');

async function testHunter() {
    console.log('🧪 Testing Hunter (AutonomousOrchestrator)...');
    
    const mockBot = {
        sendMessage: (chatId, text) => console.log(`[BOT Mock] To ${chatId}: ${text}`)
    };

    const orchestrator = new AutonomousOrchestrator(mockBot);
    
    // Define a logger callback
    const logCallback = (msg) => console.log(`[Hunter Log] ${msg}`);

    try {
        console.log('🚀 Triggering replenishCatalog(2)...');
        await orchestrator.replenishCatalog(2, logCallback);
        console.log('✅ Hunter finished.');
    } catch (e) {
        console.error('❌ Hunter failed:', e);
    }
}

testHunter();