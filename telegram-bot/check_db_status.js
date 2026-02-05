const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(DB_PATH);

function run() {
    console.log('📊 Checking Remote Database Status...');
    
    db.serialize(() => {
        // 1. Count Total
        db.get("SELECT COUNT(*) as count FROM bikes", (err, row) => {
            if (err) console.error(err);
            else console.log(`Total Bikes in DB: ${row.count}`);
        });

        // 2. Count Active
        db.get("SELECT COUNT(*) as count FROM bikes WHERE is_active = 1", (err, row) => {
            if (err) console.error(err);
            else console.log(`Active Bikes (Visible): ${row.count}`);
        });

        // 3. Count Inactive
        db.get("SELECT COUNT(*) as count FROM bikes WHERE is_active = 0", (err, row) => {
            if (err) console.error(err);
            else console.log(`Inactive Bikes (Hidden): ${row.count}`);
        });

        // 4. Last 5 entries details
        db.all("SELECT id, name, price, is_active, created_at, condition_grade FROM bikes ORDER BY id DESC LIMIT 5", (err, rows) => {
            if (err) console.error(err);
            else {
                console.log('\nLast 5 Bikes:');
                if (rows.length === 0) console.log('   (No bikes found)');
                rows.forEach(r => {
                    console.log(`   [${r.id}] ${r.name} | ${r.price}€ | Active: ${r.is_active} | Grade: ${r.condition_grade} | Created: ${r.created_at}`);
                });
            }
        });
        
        // 5. Check Market History (Lake)
        db.get("SELECT COUNT(*) as count FROM market_history", (err, row) => {
             if (err) console.error(err);
             else console.log(`\nMarket History (Lake) Size: ${row.count}`);
        });
    });
    
    // Close after a short delay
    setTimeout(() => db.close(), 2000);
}

run();
