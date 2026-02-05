
const { DatabaseManager } = require('../src/js/mysql-config');
const { AutoHunter } = require('../src/services/autoHunter');
const path = require('path');
const dotenv = require('dotenv');

// Load ENV
dotenv.config({ path: path.resolve(__dirname, '../../telegram-bot/.env') });

// FORCE Correct DB Path for Server Environment
// This ensures BikesDatabase uses the correct absolute path regardless of CWD or relative ENV vars
process.env.DB_PATH = path.resolve(__dirname, '../database/eubike.db');
process.env.BOT_DB_PATH = process.env.DB_PATH;
console.log(`[Script] Forced DB_PATH: ${process.env.DB_PATH}`);

(async () => {
    console.log('🚀 Manually triggering AutoHunter on Server...');
    
    // Mock DatabaseManager if needed, or use the real one
    // AutoHunter expects a dbManager with .query()
    const db = new DatabaseManager();
    
    const hunter = new AutoHunter(db);
    
    try {
        await hunter.runHuntCycle();
        console.log('✅ Manual Hunt Triggered Successfully.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Manual Hunt Failed:', e);
        process.exit(1);
    }
})();
