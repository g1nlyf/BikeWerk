const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database/eubike.db');
console.log('Opening DB at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to the database.');
});

const tablesToDump = ['bikes', 'market_history'];

db.serialize(() => {
    // List all tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error(err.message);
            return;
        }
        console.log('Tables found:', tables.map(t => t.name));

        tablesToDump.forEach(table => {
            db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
                if (err) {
                    console.log(`Error reading table ${table}: ${err.message}`);
                    return;
                }
                console.log(`\n=== Table: ${table} ===`);
                if (rows) {
                    rows.forEach(col => {
                        console.log(`${col.name} (${col.type})`);
                    });
                } else {
                    console.log(`Table ${table} not found or empty info.`);
                }
            });
        });
    });
});

// Close later (sqlite3 doesn't block event loop but good practice)
setTimeout(() => {
    db.close();
}, 2000);
