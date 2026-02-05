const AdminBotService = require('./AdminBotService');
require('dotenv').config();

const adminBot = new AdminBotService();

// Keep process alive
process.on('SIGINT', () => {
    console.log('Stopping Admin Bot...');
    process.exit(0);
});
