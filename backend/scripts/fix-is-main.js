const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('Fixing is_main for bikes with broken main images...');

// Get all bikes where main image in bike_images is pointing to broken cloudfront URL
const brokeBikes = db.prepare(`
    SELECT DISTINCT bi.bike_id 
    FROM bike_images bi
    WHERE bi.is_main = 1 
    AND bi.local_path LIKE '%cloudfront%'
    AND EXISTS (
        SELECT 1 FROM bike_images bi2 
        WHERE bi2.bike_id = bi.bike_id 
        AND bi2.local_path LIKE '%imagekit%'
    )
`).all();

console.log(`Found ${brokeBikes.length} bikes with broken main images`);

for (const bike of brokeBikes) {
    const bikeId = bike.bike_id;
    
    // Reset all is_main for this bike
    db.prepare('UPDATE bike_images SET is_main = 0 WHERE bike_id = ?').run(bikeId);
    
    // Find first ImageKit URL
    const imageKit = db.prepare(`
        SELECT id, local_path FROM bike_images 
        WHERE bike_id = ? AND local_path LIKE '%imagekit%'
        ORDER BY id LIMIT 1
    `).get(bikeId);
    
    if (imageKit) {
        // Set is_main = 1 for ImageKit image
        db.prepare('UPDATE bike_images SET is_main = 1 WHERE id = ?').run(imageKit.id);
        
        // Update main_image in bikes table
        db.prepare('UPDATE bikes SET main_image = ? WHERE id = ?').run(imageKit.local_path, bikeId);
        
        console.log(`[${bikeId}] Fixed: ${imageKit.local_path}`);
    }
}

// Verify
console.log('\nVerification:');
const allBikes = db.prepare('SELECT id, main_image FROM bikes WHERE is_active = 1').all();
for (const b of allBikes) {
    const mainImg = db.prepare('SELECT local_path, is_main FROM bike_images WHERE bike_id = ? AND is_main = 1').get(b.id);
    const isOK = mainImg?.local_path?.includes('imagekit') ? '✓' : '✗';
    console.log(`  [${b.id}] ${isOK} bike.main_image: ${b.main_image?.includes('imagekit') ? 'ImageKit' : 'Other'}`);
    console.log(`       ${isOK} bike_images.is_main: ${mainImg?.local_path?.includes('imagekit') ? 'ImageKit' : mainImg?.local_path?.slice(0,40) || 'NULL'}`);
}

db.close();
console.log('\nDone!');
