/**
 * Check size data in the database
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('=== Bikes with size field ===');
const withSize = db.prepare(`
  SELECT id, name, size 
  FROM bikes 
  WHERE size IS NOT NULL AND size != ''
`).all();
withSize.forEach(b => console.log(`ID ${b.id}: size='${b.size}', name='${b.name?.substring(0,40)}'`));

console.log('\n=== Size values in bike_specs ===');
const sizeSpecs = db.prepare(`
  SELECT bike_id, spec_label, spec_value 
  FROM bike_specs 
  WHERE LOWER(spec_label) LIKE '%размер%' 
     OR LOWER(spec_label) LIKE '%size%'
     OR LOWER(spec_label) LIKE '%рамы%'
     OR LOWER(spec_label) LIKE '%рост%'
  ORDER BY bike_id
  LIMIT 30
`).all();
sizeSpecs.forEach(s => console.log(`Bike ${s.bike_id}: '${s.spec_label}' = '${s.spec_value}'`));

console.log('\n=== Unique spec_label values containing "размер" or "size" ===');
const uniqueLabels = db.prepare(`
  SELECT DISTINCT spec_label, COUNT(*) as cnt
  FROM bike_specs 
  WHERE LOWER(spec_label) LIKE '%размер%' 
     OR LOWER(spec_label) LIKE '%size%'
     OR LOWER(spec_label) LIKE '%рамы%'
     OR LOWER(spec_label) LIKE '%frame%'
  GROUP BY spec_label
  ORDER BY cnt DESC
`).all();
uniqueLabels.forEach(l => console.log(`'${l.spec_label}': ${l.cnt}`));

console.log('\n=== All unique spec values for frame size specs ===');
const frameSizeValues = db.prepare(`
  SELECT spec_value, COUNT(*) as cnt
  FROM bike_specs 
  WHERE LOWER(spec_label) LIKE '%размер рамы%'
     OR LOWER(spec_label) = 'размер'
     OR LOWER(spec_label) LIKE '%frame size%'
  GROUP BY spec_value
  ORDER BY cnt DESC
`).all();
frameSizeValues.forEach(v => console.log(`'${v.spec_value}': ${v.cnt}`));

db.close();
