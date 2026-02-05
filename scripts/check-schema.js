const { DatabaseManager } = require('../backend/src/js/mysql-config');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const db = new DatabaseManager();

(async () => {
    try {
        const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables:', tables.map(t => t.name));

        const marketCols = await db.query("PRAGMA table_info(market_history)");
        console.log('market_history columns:', marketCols.map(c => c.name));

        const bikesCols = await db.query("PRAGMA table_info(bikes)");
        console.log('bikes columns:', bikesCols.map(c => c.name));
        
    } catch (e) {
        console.error(e);
    }
})();
