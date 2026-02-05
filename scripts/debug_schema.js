const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
console.log(`Checking DB at: ${DB_PATH}`);

try {
    const db = new Database(DB_PATH);
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bikes'").get();
    console.log('--- BIKES TABLE SCHEMA ---');
    console.log(schema.sql);
    console.log('--------------------------');
    
    const columns = db.prepare("PRAGMA table_info(bikes)").all();
    console.log('Columns:', columns.map(c => c.name).join(', '));
} catch (e) {
    console.error(e);
}
