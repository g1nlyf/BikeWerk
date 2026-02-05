const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path from telegram-bot folder to backend database
const dbPath = path.resolve(__dirname, '../backend/Databases/eubike.db');
console.log("Checking DB at:", dbPath);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(bikes)", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        const columns = rows.map(r => r.name);
        console.log("Columns in bikes table:", columns);
        
        // Check for seller columns specifically
        const sellerCols = ['seller_name', 'seller_type', 'seller_member_since', 'seller_badges_json'];
        const missing = sellerCols.filter(c => !columns.includes(c));
        
        if (missing.length === 0) {
            console.log("All seller columns present.");
        } else {
            console.log("Missing seller columns:", missing);
        }
    });
    
    // Also check the data for bike 121 if it exists
    db.all("SELECT id, seller_name, seller_type, seller_member_since, seller_badges_json FROM bikes WHERE id = 121", (err, rows) => {
        if (err) console.error(err);
        else console.log("Bike 121 data:", rows);
    });
});

db.close();
