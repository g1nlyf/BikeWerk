const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

const bikeId = 189;
const bike = db.prepare('SELECT * FROM bikes WHERE id = ?').get(bikeId);

if (bike) {
  console.log(JSON.stringify(bike, null, 2));
} else {
  console.log(`Bike with ID ${bikeId} not found.`);
}

db.close();
