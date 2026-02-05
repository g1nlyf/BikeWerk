/**
 * fill-size-column.js
 * 
 * Fills the `size` column in the bikes table from unified_data.specs.frame_size
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('\n🔄 Filling size column from unified_data...\n');

// Normalize size values to standard format (S, M, L, XL, XXL or cm values)
function normalizeSize(rawSize) {
  if (!rawSize || rawSize === 'null' || rawSize === '') return null;
  
  const str = String(rawSize).trim().toUpperCase();
  
  // Extract letter sizes
  if (/^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(str)) {
    return str.toUpperCase();
  }
  
  // Handle sizes like "M (40.5 cm)" -> "M"
  const letterMatch = str.match(/^(XXS|XS|S|M|L|XL|XXL|XXXL)/i);
  if (letterMatch) {
    return letterMatch[1].toUpperCase();
  }
  
  // Handle cm sizes like "54 cm", "56cm", "54"
  const cmMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:cm|centimeter)?/i);
  if (cmMatch) {
    const cm = parseFloat(cmMatch[1]);
    // If it's a reasonable frame size in cm (40-65), return it
    if (cm >= 40 && cm <= 65) {
      return `${Math.round(cm)} cm`;
    }
    // If it looks like an inch measurement (17-24"), convert
    if (cm >= 14 && cm <= 26) {
      return `${Math.round(cm)}"`;
    }
    // Otherwise return as-is
    return `${Math.round(cm)} cm`;
  }
  
  // Handle inch sizes
  const inchMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:inch|in|"|'')?/i);
  if (inchMatch) {
    return `${Math.round(parseFloat(inchMatch[1]))}"`;
  }
  
  return rawSize;
}

const bikes = db.prepare(`
  SELECT id, unified_data, specs_json, size 
  FROM bikes 
  WHERE unified_data IS NOT NULL OR specs_json IS NOT NULL
`).all();

let updated = 0;
let skipped = 0;

for (const bike of bikes) {
  // Skip if already has a valid size
  if (bike.size && bike.size !== 'null' && bike.size !== '') {
    skipped++;
    continue;
  }
  
  let frameSize = null;
  
  // Try to get frame_size from unified_data
  if (bike.unified_data) {
    try {
      const unified = JSON.parse(bike.unified_data);
      frameSize = unified?.specs?.frame_size;
    } catch (e) {}
  }
  
  // Fallback to specs_json
  if (!frameSize && bike.specs_json) {
    try {
      const specs = JSON.parse(bike.specs_json);
      frameSize = specs?.frame_size;
    } catch (e) {}
  }
  
  if (frameSize && frameSize !== 'null') {
    const normalized = normalizeSize(frameSize);
    if (normalized) {
      db.prepare(`UPDATE bikes SET size = ? WHERE id = ?`).run(normalized, bike.id);
      updated++;
    }
  }
}

console.log(`✅ Updated ${updated} bikes with size data`);
console.log(`⏩ Skipped ${skipped} bikes (already have size)`);

// Show distribution
console.log('\n📊 Size Distribution:');
const distribution = db.prepare(`
  SELECT size, COUNT(*) as cnt 
  FROM bikes 
  WHERE size IS NOT NULL AND size != '' AND size != 'null'
  GROUP BY size 
  ORDER BY cnt DESC
`).all();
distribution.forEach(d => console.log(`  '${d.size}': ${d.cnt}`));

console.log('\n✅ Done!\n');
db.close();
