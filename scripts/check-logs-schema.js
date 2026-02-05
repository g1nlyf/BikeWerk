const { DatabaseManager } = require('../backend/src/js/mysql-config');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const db = new DatabaseManager();

(async () => {
    try {
        const logs = await db.query("PRAGMA table_info(system_logs)");
        console.log('system_logs columns:', logs.map(c => c.name));
        
        // Also check if we have a hunter_stats table or similar
        const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%hunter%'");
        console.log('Hunter tables:', tables);

    } catch (e) {
        console.error(e);
    }
})();
