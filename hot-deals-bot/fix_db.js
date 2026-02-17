
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database/stolen_bikes.db');
console.log('Target database:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('Database file not found!');
    process.exit(1);
}

const db = new Database(dbPath);

try {
    // 1. Clear tables
    db.prepare('DELETE FROM stolen_bikes').run();
    db.prepare('DELETE FROM bot_stats').run();
    console.log('✅ Tables cleared (stolen_bikes, bot_stats)');

    // 2. Check and Apply Migration 004
    const migrationPath4 = path.join(__dirname, 'migrations/004_add_user_tracking.sql');
    if (fs.existsSync(migrationPath4)) {
        const check = db.prepare("SELECT count(*) as cnt FROM pragma_table_info('users') WHERE name='last_hot_check'").get();
        if (check.cnt === 0) {
            const migration4 = fs.readFileSync(migrationPath4, 'utf-8');
            db.exec(migration4);
            console.log('✅ Applied migration 004 (last_hot_check)');
        } else {
            console.log('ℹ️ Column last_hot_check already exists');
        }
    } else {
        console.warn('⚠️ Migration 004 file not found');
    }

} catch (e) {
    console.error('❌ Error fixing database:', e.message);
} finally {
    db.close();
}
