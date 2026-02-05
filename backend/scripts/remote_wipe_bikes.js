const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');
console.log(`Target DB: ${DB_PATH}`);

try {
    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ DB file not found at:', DB_PATH);
        process.exit(1);
    }

    const db = new Database(DB_PATH);
    
    // Disable foreign keys to allow deletion
    db.pragma('foreign_keys = OFF');
    console.log('🔓 Foreign keys disabled.');

    console.log('🧹 Wiping bike_images table...');
    try {
        const infoImg = db.prepare('DELETE FROM bike_images').run();
        console.log(`   Deleted ${infoImg.changes} rows from bike_images.`);
        db.prepare("DELETE FROM sqlite_sequence WHERE name='bike_images'").run();
    } catch (e) {
        console.log('   bike_images table might not exist or error:', e.message);
    }
    
    console.log('🧹 Wiping bikes table...');
    const info = db.prepare('DELETE FROM bikes').run();
    console.log(`   Deleted ${info.changes} rows from bikes.`);
    
    db.prepare("DELETE FROM sqlite_sequence WHERE name='bikes'").run();
    
    // Optional: Wiping other related tables if necessary
    // db.prepare('DELETE FROM market_history').run(); 

    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');

    // Verify
    const count = db.prepare('SELECT count(*) as c FROM bikes').get();
    console.log(`✅ DB Wipe Complete. Current bike count: ${count.c}`);

} catch (e) {
    console.error('❌ DB Wipe Failed:', e);
    process.exit(1);
}
