const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
console.log(`📂 Opening DB at: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log('🏗️ Checking schema...');
    
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='bikes'", (err, row) => {
        if (err) console.error(err);
        if (!row) {
            console.error('❌ Table "bikes" DOES NOT EXIST. This is critical.');
            db.close();
        } else {
            console.log('✅ Table "bikes" exists.');
            db.all("PRAGMA table_info(bikes)", (err, cols) => {
                if (err) console.error(err);
                else {
                    console.log(`   Columns: ${cols.length}`);
                    cols.forEach(c => console.log(`   - ${c.name} (${c.type})`));
                }
                db.close();
            });
        }
    });
});
