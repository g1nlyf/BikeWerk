const AutonomousOrchestrator = require('./telegram-bot/AutonomousOrchestrator');

async function run() {
    console.log('🏹 Starting Strategic Hunt Command...');
    
    // Parse args manually
    let count = 10;
    const countArg = process.argv.find(a => a.startsWith('--count='));
    if (countArg) {
        count = parseInt(countArg.split('=')[1], 10);
    }
    
    console.log(`🎯 Target Count: ${count}`);
    
    const orchestrator = new AutonomousOrchestrator();
    
    // Custom logger callback to show progress in console
    const logger = (msg) => {
        console.log(`[STRATEGIC] ${msg}`);
    };
    
    try {
        const added = await orchestrator.replenishCatalog(count, logger);
        console.log(`✅ Strategic Hunt Finished. Added ${added} bikes.`);
        process.exit(0);
    } catch (e) {
        console.error('❌ Hunt Failed:', e);
        process.exit(1);
    }
}

run();
