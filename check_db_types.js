const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function main() {
  const dbPath = path.resolve(__dirname, 'backend/Databases/eubike.db');
  console.log('Opening DB at:', dbPath);
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  // Check columns in bikes table
  const columns = await db.all("PRAGMA table_info(bikes)");
  const colNames = columns.map(c => c.name);
  console.log('Columns:', colNames.join(', '));

  // Check unique values for type/category/discipline
  if (colNames.includes('type')) {
    const types = await db.all("SELECT DISTINCT type FROM bikes");
    console.log('Distinct Types:', types.map(t => t.type));
  }
  if (colNames.includes('category')) {
    const cats = await db.all("SELECT DISTINCT category FROM bikes");
    console.log('Distinct Categories:', cats.map(c => c.category));
  }
  if (colNames.includes('discipline')) {
    const discs = await db.all("SELECT DISTINCT discipline FROM bikes");
    console.log('Distinct Disciplines:', discs.map(d => d.discipline));
  }

  // Check a few potential e-bikes
  const ebikes = await db.all(`
    SELECT id, name, type, category, discipline, brand 
    FROM bikes 
    WHERE name LIKE '%eMTB%' OR name LIKE '%hybrid%' OR name LIKE '%turbo%' OR type LIKE '%lectr%' OR category LIKE '%lectr%'
    LIMIT 5
  `);
  console.log('Sample E-Bikes:', ebikes);

  await db.close();
}

main().catch(console.error);
