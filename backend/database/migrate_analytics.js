const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'eubike.db');
const db = new Database(dbPath);

console.log(`Applying Analytics Migration on: ${dbPath}`);

const migrationSQL = fs.readFileSync(path.resolve(__dirname, 'migrations/002_analytics_tables.sql'), 'utf8');

// Split by semicolon but respect triggers (BEGIN ... END)
// Simple split might break triggers. Better to execute parts.
// However, better-sqlite3 .exec() executes multiple statements.

try {
    db.exec(migrationSQL);
    console.log('✅ Analytics tables and triggers applied successfully.');
} catch (e) {
    console.error('❌ Migration failed:', e.message);
}

// Verify
try {
    const info = db.prepare("PRAGMA table_info(bike_analytics)").all();
    if (info.length > 0) {
        console.log(`✅ bike_analytics table exists with ${info.length} columns.`);
    } else {
        console.error('❌ bike_analytics table NOT found.');
    }
} catch (e) {
    console.error('Verification failed:', e.message);
}
