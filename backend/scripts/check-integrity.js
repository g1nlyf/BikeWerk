const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');

console.log(`Checking integrity of ${dbPath}...`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error opening DB:', err.message);
        return;
    }
    console.log('DB opened.');
});

db.all("PRAGMA integrity_check", (err, rows) => {
    if (err) {
        console.error('Integrity check failed to run:', err.message);
    } else {
        console.log('Integrity check results:');
        rows.forEach(row => console.log(row));
    }
    db.close();
});
