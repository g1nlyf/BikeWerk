const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

const bike1 = db.prepare('SELECT * FROM bikes WHERE id = 1').get();
const images1 = db.prepare('SELECT * FROM bike_images WHERE bike_id = 1').all();

console.log('Bike 1:', bike1);
console.log('Bike 1 Images:', images1);
