const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, images FROM bikes LIMIT 5', (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Rows:', rows);
        if (rows.length > 0) {
            console.log('Type of images:', typeof rows[0].images);
            console.log('Value of images:', rows[0].images);
        }
    }
});
