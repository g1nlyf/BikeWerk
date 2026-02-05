const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database/eubike.db');
const MIGRATION_PATH = path.join(__dirname, 'migrations/post_sales.sql');

console.log(`Opening database at ${DB_PATH}`);
const db = new sqlite3.Database(DB_PATH);

const migration = fs.readFileSync(MIGRATION_PATH, 'utf8');

// Split by semicolon to handle multiple statements (sqlite3 exec runs all but better safe for inserts)
// Actually exec() handles multiple statements fine in sqlite3 node driver usually.
console.log('Applying migration...');
db.exec(migration, (err) => {
    if (err) {
        // Ignore unique constraint errors if re-running
        if (err.message.includes('UNIQUE constraint failed')) {
            console.log('Some accessories already exist (Unique constraint). Continuing...');
        } else {
            console.error('Error applying migration:', err.message);
        }
    } else {
        console.log('Migration applied successfully.');
    }
    db.close();
});
