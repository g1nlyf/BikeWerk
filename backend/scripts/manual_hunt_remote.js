const path = require('path');
// Register ts-node for TypeScript support (needed for some modules)
require('ts-node').register({
    project: path.resolve(__dirname, '../../telegram-bot/tsconfig.json'),
    transpileOnly: true
});

// Adjust path to point to telegram-bot from backend/scripts/
const AutonomousOrchestrator = require('../../telegram-bot/AutonomousOrchestrator');

async function run() {
    console.log('Starting Manual Hunt (5 bikes)...');
    try {
        const orchestrator = new AutonomousOrchestrator();
        await orchestrator.replenishCatalog(5);
        console.log('Hunt finished successfully.');
    } catch (e) {
        console.error('Hunt failed:', e);
    }
}

run().catch(console.error);
