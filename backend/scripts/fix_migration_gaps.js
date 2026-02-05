const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('🔧 Starting Migration Fix...');

// 1. Find bikes with legacy main_image
const legacyBikes = db.prepare(`
  SELECT id, main_image FROM bikes 
  WHERE is_active = 1 
  AND (main_image LIKE '/images/%' OR main_image NOT LIKE 'http%')
`).all();

console.log(`Found ${legacyBikes.length} bikes with legacy/invalid main_image.`);

let fixed = 0;
let skipped = 0;

const updateStmt = db.prepare('UPDATE bikes SET main_image = ? WHERE id = ?');
const findImageStmt = db.prepare(`
  SELECT local_path FROM bike_images 
  WHERE bike_id = ? 
  AND local_path LIKE 'https://ik.imagekit.io/%' 
  ORDER BY is_main DESC, id ASC 
  LIMIT 1
`);

for (const bike of legacyBikes) {
  const imageRecord = findImageStmt.get(bike.id);
  
  if (imageRecord && imageRecord.local_path) {
    console.log(`✅ Fixing Bike ${bike.id}: ${bike.main_image} -> ${imageRecord.local_path}`);
    updateStmt.run(imageRecord.local_path, bike.id);
    fixed++;
  } else {
    console.log(`⚠️ Could not fix Bike ${bike.id}: No ImageKit URL found in bike_images.`);
    skipped++;
  }
}

console.log(`\nFix Complete: ${fixed} fixed, ${skipped} skipped.`);

// 2. Summary of NULLs in bike_images
const nullImages = db.prepare(`
  SELECT COUNT(*) as count FROM bike_images WHERE local_path IS NULL
`).get();
console.log(`\nRemaining NULL local_paths in bike_images: ${nullImages.count}`);

// 3. Verify total active bikes on ImageKit
const status = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN main_image LIKE 'https://ik.imagekit.io/%' THEN 1 ELSE 0 END) as imagekit
  FROM bikes WHERE is_active = 1
`).get();

console.log(`\nFinal Status: ${status.imagekit}/${status.total} active bikes on ImageKit.`);
