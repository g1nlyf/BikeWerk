const path = require('path');
// Load ENV first
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

// Enable Polling for this process
process.env.BOT_POLLING = 'true';

console.log('🤖 Starting Manager Bot V2.0 (Telegraf Runner)...');

try {
    // Import the shared service from backend
    // This will instantiate the class and start polling (because BOT_POLLING is true)
    const managerBot = require('../backend/src/services/ManagerBotService');
    
    console.log('✅ Manager Bot Service loaded successfully.');
    
    // Keep process alive
    process.on('SIGINT', () => {
        console.log('🛑 Shutting down...');
        process.exit(0);
    });
    
} catch (error) {
    console.error('❌ Failed to start Manager Bot:', error);
    console.error(error.stack);
    process.exit(1);
}
