const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, name, brand, is_active, hotness_score, salvage_value, fmv FROM bikes ORDER BY id DESC LIMIT 3;", [], (err, rows) => {
    if (err) {
        throw err;
    }
    console.table(rows);
    db.close();
});