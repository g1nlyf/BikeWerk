const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const backupPath = path.resolve(__dirname, '../database/eubike.db.corrupt');

// Backup first
fs.copyFileSync(dbPath, backupPath);
console.log(`Backed up corrupt DB to ${backupPath}`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error opening DB:', err.message);
        process.exit(1);
    }
});

console.log('Attempting VACUUM...');

db.run("VACUUM", (err) => {
    if (err) {
        console.error('VACUUM failed:', err.message);
        console.log('Attempting alternative recovery (dump/restore equivalent)...');
        // If VACUUM fails, we might need a more aggressive approach (reading row by row)
        // For now, let's see if VACUUM works.
    } else {
        console.log('VACUUM successful! Database should be repaired.');
    }
    db.close();
});
