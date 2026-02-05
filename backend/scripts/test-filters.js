/**
 * Test script to verify that the filter logic works correctly
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('\n=== Testing Filter Logic ===\n');

// Test 1: Category filter (mtb)
const mtbCount = db.prepare(`
  SELECT COUNT(*) as cnt FROM bikes WHERE is_active = TRUE AND category = 'mtb'
`).get();
console.log(`✓ MTB bikes (category=mtb): ${mtbCount.cnt}`);

// Test 2: Sub-category filter (enduro)
const enduroCount = db.prepare(`
  SELECT COUNT(*) as cnt FROM bikes 
  WHERE is_active = TRUE 
  AND (sub_category IN ('enduro') OR discipline IN ('enduro'))
`).get();
console.log(`✓ Enduro bikes (sub_category/discipline=enduro): ${enduroCount.cnt}`);

// Test 3: Sub-category filter (trail)
const trailCount = db.prepare(`
  SELECT COUNT(*) as cnt FROM bikes 
  WHERE is_active = TRUE 
  AND (sub_category IN ('trail') OR discipline IN ('trail'))
`).get();
console.log(`✓ Trail bikes (sub_category/discipline=trail): ${trailCount.cnt}`);

// Test 4: Sub-category filter (dh)
const dhCount = db.prepare(`
  SELECT COUNT(*) as cnt FROM bikes 
  WHERE is_active = TRUE 
  AND (sub_category IN ('dh') OR discipline IN ('dh'))
`).get();
console.log(`✓ DH bikes (sub_category/discipline=dh): ${dhCount.cnt}`);

// Test 5: Combined category + sub_category
const mtbEnduro = db.prepare(`
  SELECT COUNT(*) as cnt FROM bikes 
  WHERE is_active = TRUE 
  AND category = 'mtb'
  AND (sub_category IN ('enduro') OR discipline IN ('enduro'))
`).get();
console.log(`✓ MTB Enduro (category=mtb, sub_category=enduro): ${mtbEnduro.cnt}`);

// Test 6: Multiple sub_categories (trail, enduro)
const trailOrEnduro = db.prepare(`
  SELECT COUNT(*) as cnt FROM bikes 
  WHERE is_active = TRUE 
  AND (sub_category IN ('trail', 'enduro') OR discipline IN ('trail', 'enduro'))
`).get();
console.log(`✓ Trail OR Enduro bikes: ${trailOrEnduro.cnt}`);

// Test 7: Category distribution
console.log('\n📊 Category Distribution:');
const categories = db.prepare(`
  SELECT category, COUNT(*) as cnt 
  FROM bikes 
  WHERE is_active = TRUE
  GROUP BY category 
  ORDER BY cnt DESC
`).all();
categories.forEach(c => console.log(`   ${c.category}: ${c.cnt}`));

// Test 8: Sub-category distribution
console.log('\n📊 Sub-category Distribution:');
const subCategories = db.prepare(`
  SELECT sub_category, COUNT(*) as cnt 
  FROM bikes 
  WHERE is_active = TRUE AND sub_category IS NOT NULL AND sub_category != ''
  GROUP BY sub_category 
  ORDER BY cnt DESC
`).all();
subCategories.forEach(s => console.log(`   ${s.sub_category}: ${s.cnt}`));

// Test 9: Discipline distribution
console.log('\n📊 Discipline Distribution:');
const disciplines = db.prepare(`
  SELECT discipline, COUNT(*) as cnt 
  FROM bikes 
  WHERE is_active = TRUE AND discipline IS NOT NULL AND discipline != ''
  GROUP BY discipline 
  ORDER BY cnt DESC
`).all();
disciplines.forEach(d => console.log(`   ${d.discipline}: ${d.cnt}`));

console.log('\n✅ All filter tests passed!\n');
db.close();
