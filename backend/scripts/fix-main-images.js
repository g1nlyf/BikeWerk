const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('Fixing main images to use ImageKit URLs...');

// Get all bikes where main_image is NOT an ImageKit URL
const bikes = db.prepare(`
    SELECT id, main_image FROM bikes 
    WHERE main_image NOT LIKE '%ik.imagekit.io%' OR main_image IS NULL
`).all();

console.log(`Found ${bikes.length} bikes with non-ImageKit main images`);

for (const bike of bikes) {
    // Find ImageKit URL in bike_images
    const img = db.prepare(`
        SELECT local_path FROM bike_images 
        WHERE bike_id = ? AND local_path LIKE '%ik.imagekit.io%'
        ORDER BY is_main DESC, id ASC
        LIMIT 1
    `).get(bike.id);
    
    if (img) {
        db.prepare('UPDATE bikes SET main_image = ? WHERE id = ?').run(img.local_path, bike.id);
        console.log(`[${bike.id}] Updated: ${img.local_path}`);
    } else {
        console.log(`[${bike.id}] No ImageKit image found, keeping: ${bike.main_image}`);
    }
}

// Verify
const result = db.prepare('SELECT id, main_image FROM bikes').all();
console.log('\nFinal main images:');
result.forEach(b => console.log(`  [${b.id}] ${b.main_image}`));

db.close();
