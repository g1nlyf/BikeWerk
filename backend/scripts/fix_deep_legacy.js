const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const imageKitService = require('../src/services/ImageKitService');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);
// const imageKitService = new ImageKitService(); // Already instantiated

const publicDir = path.resolve(__dirname, '../public');

console.log('🔧 Starting Deep Fix for Legacy Bikes...');

// Find bikes with local main_image
const legacyBikes = db.prepare(`
  SELECT id, main_image FROM bikes 
  WHERE is_active = 1 
  AND (main_image LIKE '/images/%' OR main_image NOT LIKE 'http%')
`).all();

console.log(`Found ${legacyBikes.length} bikes to fix.`);

async function processBike(bike) {
  console.log(`\nProcessing Bike ${bike.id}...`);
  const images = db.prepare('SELECT * FROM bike_images WHERE bike_id = ?').all(bike.id);
  
  if (images.length === 0) {
    console.log(`  No images found in bike_images table.`);
    return;
  }

  let mainImageUrl = null;

  for (const img of images) {
    if (img.local_path && img.local_path.startsWith('http')) {
      if (img.is_main) mainImageUrl = img.local_path;
      continue;
    }

    // Try to resolve file path
    // img.image_url is like '/images/bikes/id1/0.webp'
    let relativePath = img.image_url;
    if (relativePath.startsWith('/images')) {
        // ok
    } else {
        // fallback
        continue;
    }

    const fullPath = path.join(publicDir, relativePath.replace('/images', '')); // /images/bikes -> /bikes
    // Check alternatives if not found
    const fullPathAlt = path.join(publicDir, relativePath); 
    
    let targetPath = null;
    if (fs.existsSync(fullPath)) targetPath = fullPath;
    else if (fs.existsSync(fullPathAlt)) targetPath = fullPathAlt;
    
    if (!targetPath) {
        console.log(`  ❌ File not found: ${relativePath}`);
        continue;
    }

    console.log(`  📤 Uploading: ${relativePath}`);
    try {
        const buffer = fs.readFileSync(targetPath);
        const fileName = path.basename(targetPath);
        const folder = `/bikes/id${bike.id}`;
        
        const result = await imageKitService.uploadImage(buffer, fileName, folder);
        
        db.prepare('UPDATE bike_images SET local_path = ? WHERE id = ?').run(result.url, img.id);
        console.log(`     ✅ Uploaded: ${result.url}`);
        
        if (img.is_main) mainImageUrl = result.url;
    } catch (e) {
        console.error(`     ❌ Upload failed: ${e.message}`);
    }
  }

  if (mainImageUrl) {
      db.prepare('UPDATE bikes SET main_image = ? WHERE id = ?').run(mainImageUrl, bike.id);
      console.log(`  🎉 Updated active main_image to: ${mainImageUrl}`);
  }
}

(async () => {
    for (const bike of legacyBikes) {
        await processBike(bike);
    }
    console.log('\n✨ Deep Fix Complete.');
})();
