const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("ALTER TABLE bikes ADD COLUMN fmv REAL DEFAULT 0;", (err) => {
        if (err) {
            console.log("Error adding fmv:", err.message);
        } else {
            console.log("Added fmv column.");
        }
    });
    
    // Check if priority exists, if not add it
    db.run("ALTER TABLE bikes ADD COLUMN priority TEXT DEFAULT 'normal';", (err) => {
        if (err) {
             console.log("Error adding priority (might exist):", err.message);
        } else {
             console.log("Added priority column.");
        }
    });
});

db.close();