/**
 * Check unified_data and specs_json for size information
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('=== Checking unified_data for size info ===');
const bikes = db.prepare(`
  SELECT id, name, unified_data, specs_json, size 
  FROM bikes 
  WHERE unified_data IS NOT NULL 
  LIMIT 5
`).all();

bikes.forEach(b => {
  console.log(`\n--- Bike ${b.id}: ${b.name?.substring(0,40)} ---`);
  console.log(`Direct size column: '${b.size}'`);
  
  if (b.unified_data) {
    try {
      const unified = JSON.parse(b.unified_data);
      console.log(`unified_data.specs.frame_size: '${unified?.specs?.frame_size}'`);
    } catch (e) {
      console.log('Failed to parse unified_data');
    }
  }
  
  if (b.specs_json) {
    try {
      const specs = JSON.parse(b.specs_json);
      console.log(`specs_json.frame_size: '${specs?.frame_size}'`);
    } catch (e) {
      console.log('Failed to parse specs_json');
    }
  }
});

console.log('\n\n=== All bikes with frame_size in unified_data ===');
const allBikes = db.prepare(`SELECT id, name, unified_data, size FROM bikes WHERE unified_data IS NOT NULL`).all();
let count = 0;
allBikes.forEach(b => {
  try {
    const unified = JSON.parse(b.unified_data);
    const frameSize = unified?.specs?.frame_size;
    if (frameSize && frameSize !== 'null' && frameSize !== '') {
      console.log(`ID ${b.id}: frame_size='${frameSize}', size column='${b.size}'`);
      count++;
    }
  } catch (e) {}
});
console.log(`Total bikes with frame_size in unified_data: ${count}`);

db.close();
