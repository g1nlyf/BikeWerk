
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');

async function inspectDB() {
    console.log('🔍 INSPECTING MARKET HISTORY');
    const db = new Database(DB_PATH, { readonly: true });
    
    try {
        const rows = db.prepare('SELECT brand, model, year, price_eur, created_at FROM market_history LIMIT 20').all();
        console.table(rows);
        
        const count = db.prepare('SELECT count(*) as count FROM market_history').get();
        console.log(`Total rows: ${count.count}`);
        
    } catch (e) {
        console.error(e);
    }
    db.close();
}

inspectDB();
