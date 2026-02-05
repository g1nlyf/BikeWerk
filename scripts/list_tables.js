const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) console.error(err);
        else {
            console.log('Tables:', tables.map(t => t.name));
            // Check columns of bikes again to be sure
            db.all("PRAGMA table_info(bikes)", (err, cols) => {
                if (err) console.error(err);
                else console.log('Bikes Columns:', cols.map(c => c.name));
            });
        }
    });
});
