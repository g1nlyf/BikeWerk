const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database/eubike.db');
console.log('Opening DB at:', dbPath);

try {
    const db = new Database(dbPath, { verbose: console.log });
    
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables found:', tables.map(t => t.name));

    ['bikes', 'market_history'].forEach(table => {
        try {
            const info = db.prepare(`PRAGMA table_info(${table})`).all();
            console.log(`\n=== Table: ${table} ===`);
            info.forEach(col => console.log(`${col.name} (${col.type})`));
        } catch (e) {
            console.log(`Error reading table ${table}: ${e.message}`);
        }
    });
} catch (e) {
    console.error('Database error:', e);
}
