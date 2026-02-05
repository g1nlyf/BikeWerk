const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new Database(DB_PATH);

try {
    // Force delete
    db.prepare('PRAGMA foreign_keys = OFF').run();
    const info = db.prepare("DELETE FROM bikes WHERE brand = 'TEST'").run();
    console.log(`Cleaned up ${info.changes} TEST bikes`);
    db.prepare('PRAGMA foreign_keys = ON').run();
} catch (e) {
    console.error(e.message);
}
