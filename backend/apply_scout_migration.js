const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database/eubike.db');
const MIGRATION_PATH = path.join(__dirname, 'migrations/smart_scout.sql');

console.log(`Opening database at ${DB_PATH}`);
const db = new sqlite3.Database(DB_PATH);

const migration = fs.readFileSync(MIGRATION_PATH, 'utf8');

console.log('Applying migration...');
db.exec(migration, (err) => {
    if (err) {
        console.error('Error applying migration:', err.message);
        process.exit(1);
    }
    console.log('Migration applied successfully.');
    db.close();
});
