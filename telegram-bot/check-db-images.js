const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'Databases', 'eubike.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, main_image, images FROM bikes ORDER BY id DESC LIMIT 10", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(JSON.stringify(rows, null, 2));
});
