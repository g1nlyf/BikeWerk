const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(bikes);", [], (err, rows) => {
    if (err) {
        throw err;
    }
    console.table(rows);
    db.close();
});