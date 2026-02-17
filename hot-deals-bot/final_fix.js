
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = 'c:/Users/hacke/CascadeProjects/Finals1/eubike/hot-deals-bot/database/stolen_bikes.db';
const migrationPath = 'c:/Users/hacke/CascadeProjects/Finals1/eubike/hot-deals-bot/migrations/004_add_user_tracking.sql';

console.log('--- DB FIX START ---');
console.log('DB Path:', dbPath);

const db = new Database(dbPath);

try {
    // 1. Clear Bikes
    const bikeCountBefore = db.prepare('SELECT count(*) as c FROM stolen_bikes').get().c;
    db.prepare('DELETE FROM stolen_bikes').run();
    db.prepare('DELETE FROM bot_stats').run();
    const bikeCountAfter = db.prepare('SELECT count(*) as c FROM stolen_bikes').get().c;
    console.log(`✅ Stolen bikes cleared: ${bikeCountBefore} -> ${bikeCountAfter}`);

    // 2. Migration 004 (last_hot_check)
    const check = db.prepare("SELECT count(*) as cnt FROM pragma_table_info('users') WHERE name='last_hot_check'").get();
    if (check.cnt === 0) {
        console.log('Adding last_hot_check column...');
        if (fs.existsSync(migrationPath)) {
            const sql = fs.readFileSync(migrationPath, 'utf8');
            db.exec(sql);
            console.log('✅ Migration 004 applied.');
        } else {
            console.log('Manual migration (alter table)...');
            db.exec('ALTER TABLE users ADD COLUMN last_hot_check TEXT;');
            console.log('✅ Column added manually.');
        }
    } else {
        console.log('ℹ️ Column last_hot_check already exists.');
    }

    // 3. Final verification
    const cols = db.prepare('pragma table_info(users)').all().map(c => c.name);
    console.log('Current Users columns:', cols.join(', '));

} catch (e) {
    console.error('❌ Error:', e.message);
} finally {
    db.close();
    console.log('--- DB FIX END ---');
}
