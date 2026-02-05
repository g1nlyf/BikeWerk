const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function main() {
  const dbFile = path.resolve(__dirname, '../database/eubike.db');
  const db = await open({ filename: dbFile, driver: sqlite3.Database });
  const rows = await db.all(`
    SELECT id, name, brand, price, added_at
    FROM bikes
    WHERE brand = 'unknown' OR name LIKE 'Bike %' OR price = 0
    ORDER BY added_at DESC
    LIMIT 30
  `);
  console.log('Placeholder candidates (limit 30):');
  for (const r of rows) {
    console.log(`#${r.id} | ${r.name} | brand=${r.brand} | price=${r.price} | added_at=${r.added_at}`);
  }
  await db.close();
}

main().catch(err => { console.error(err); process.exit(1); });