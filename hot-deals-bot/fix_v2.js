
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const baseDir = 'c:/Users/hacke/CascadeProjects/Finals1/eubike/hot-deals-bot';
const dbPath = path.join(baseDir, 'database/stolen_bikes.db');

console.log('Targeting:', dbPath);

const db = new Database(dbPath);

try {
    // 1. Clear tables
    db.prepare('DELETE FROM stolen_bikes').run();
    db.prepare('DELETE FROM bot_stats').run();
    console.log('✅ Tables cleared.');

    // 2. Fix schema
    const check = db.prepare("SELECT count(*) as cnt FROM pragma_table_info('users') WHERE name='last_hot_check'").get();
    if (check.cnt === 0) {
        db.exec('ALTER TABLE users ADD COLUMN last_hot_check TEXT;');
        console.log('✅ Column last_hot_check added.');
    } else {
        console.log('ℹ️ Column already exists.');
    }

    // 3. Verification
    const count = db.prepare('SELECT count(*) as c FROM stolen_bikes').get().c;
    const cols = db.prepare('pragma table_info(users)').all().map(c => c.name);
    console.log(`Verification: Bikes=${count}, Columns=[${cols.join(', ')}]`);

} catch (e) {
    console.error('❌ Error:', e.message);
} finally {
    db.close();
}
