const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/database/eubike.db');
console.log('Opening DB:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
});

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Error listing tables:', err);
        } else {
            console.log('Tables:', tables.map(t => t.name).join(', '));

            // Check specific tables columns
            const checkCols = ['transactions', 'shipments', 'order_status_events', 'orders'];
            checkCols.forEach(table => {
                if (tables.find(t => t.name === table)) {
                    db.all(`PRAGMA table_info(${table})`, (err, cols) => {
                        if (err) console.error(`Error getting schema for ${table}:`, err);
                        else {
                            console.log(`\nSchema for ${table}:`);
                            console.log(cols.map(c => `${c.name} (${c.type})`).join(', '));
                        }
                    });
                } else {
                    console.log(`\nTable ${table} does NOT exist.`);
                }
            });
        }
    });
});
