const path = require('path');
// Load environment variables from backend/.env
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const managerBot = require('../backend/src/services/ManagerBotService');

console.log('🚀 Starting Manager Bot Standalone Service...');

// Start Polling
managerBot.startPolling();

// Keep alive
process.on('SIGINT', () => {
    console.log('Stopping Manager Bot...');
    process.exit(0);
});
