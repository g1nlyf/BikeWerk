const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function main() {
  const dbPath = path.resolve(__dirname, 'Databases/eubike.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const bikes = await db.all("SELECT id FROM bikes LIMIT 5");
  console.log('Valid IDs:', bikes.map(b => b.id));
  await db.close();
}
main();
