/**
 * Quick fix for remaining un-normalized categories
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('Fixing remaining categories...');

// Fix remaining Cyrillic categories
const fixes = [
  { old: 'Электровелосипеды', new: 'emtb' },
  { old: 'Электро-горный велосипед', new: 'emtb' },
  { old: 'Горные велосипеды', new: 'mtb' }
];

for (const fix of fixes) {
  const result = db.prepare('UPDATE bikes SET category = ? WHERE category = ?').run(fix.new, fix.old);
  console.log(`  "${fix.old}" → "${fix.new}": ${result.changes} rows`);
}

// Verify
const remaining = db.prepare(`
  SELECT DISTINCT category, COUNT(*) as cnt 
  FROM bikes 
  GROUP BY category
`).all();

console.log('\nFinal categories:');
remaining.forEach(r => console.log(`  "${r.category}": ${r.cnt}`));

db.close();
console.log('\nDone!');
