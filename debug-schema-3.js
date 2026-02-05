const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(shop_order_items)", (err, rows) => {
        if (err) console.error(err);
        else console.log('Shop Order Items:', rows);
    });
});

db.close();
