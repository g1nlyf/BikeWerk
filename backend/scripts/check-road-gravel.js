/**
 * Check road and gravel bikes' sub_category and discipline values
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('=== Road bikes ===');
const road = db.prepare(`
  SELECT id, sub_category, discipline, name 
  FROM bikes 
  WHERE category = 'road'
`).all();
road.forEach(r => console.log(`ID ${r.id}: sub='${r.sub_category}', disc='${r.discipline}', name='${(r.name || '').substring(0,50)}'`));

console.log('\n=== Gravel bikes ===');
const gravel = db.prepare(`
  SELECT id, sub_category, discipline, name 
  FROM bikes 
  WHERE category = 'gravel'
`).all();
gravel.forEach(r => console.log(`ID ${r.id}: sub='${r.sub_category}', disc='${r.discipline}', name='${(r.name || '').substring(0,50)}'`));

console.log('\n=== eMTB bikes ===');
const emtb = db.prepare(`
  SELECT id, sub_category, discipline, name 
  FROM bikes 
  WHERE category = 'emtb'
`).all();
emtb.forEach(r => console.log(`ID ${r.id}: sub='${r.sub_category}', disc='${r.discipline}', name='${(r.name || '').substring(0,50)}'`));

console.log('\n=== Size field values ===');
const sizes = db.prepare(`
  SELECT size, COUNT(*) as cnt 
  FROM bikes 
  WHERE size IS NOT NULL AND size != '' 
  GROUP BY size
  ORDER BY cnt DESC
`).all();
sizes.forEach(s => console.log(`'${s.size}': ${s.cnt}`));

console.log('\n=== All unique discipline values ===');
const disciplines = db.prepare(`
  SELECT DISTINCT discipline, category, COUNT(*) as cnt
  FROM bikes 
  WHERE discipline IS NOT NULL AND discipline != ''
  GROUP BY discipline, category
  ORDER BY category, cnt DESC
`).all();
disciplines.forEach(d => console.log(`[${d.category}] '${d.discipline}': ${d.cnt}`));

db.close();
