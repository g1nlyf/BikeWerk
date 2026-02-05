const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Adding shipping_option column to bikes table...');
    db.run("ALTER TABLE bikes ADD COLUMN shipping_option TEXT DEFAULT 'unknown'", (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log('Column already exists.');
            } else {
                console.error('Error adding column:', err);
            }
        } else {
            console.log('Column added successfully.');
        }
    });
});

db.close();
