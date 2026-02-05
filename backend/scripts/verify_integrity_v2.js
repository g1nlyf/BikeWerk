const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath, { readonly: true });

console.log('Running Database Integrity Check v2...');

// Check bike_images table
const images = db.prepare(`
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN local_path LIKE 'https://ik.imagekit.io/%' THEN 1 ELSE 0 END) as imagekit,
        SUM(CASE WHEN local_path LIKE '/images/%' THEN 1 ELSE 0 END) as local,
        SUM(CASE WHEN local_path IS NULL THEN 1 ELSE 0 END) as nulls
    FROM bike_images
`).get();

console.log('\n📊 BIKE_IMAGES TABLE:');
console.log('Total records:', images.total);
console.log('ImageKit URLs:', images.imagekit);
console.log('Local paths:', images.local);
console.log('NULL paths:', images.nulls);

if (images.imagekit === images.total) {
    console.log('✅ ALL ON IMAGEKIT');
} else {
    console.log('❌ MIGRATION INCOMPLETE');
}

// Check bikes table (main_image)
const bikes = db.prepare(`
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN main_image LIKE 'https://ik.imagekit.io/%' THEN 1 ELSE 0 END) as imagekit,
        SUM(CASE WHEN main_image LIKE '/images/%' THEN 1 ELSE 0 END) as local
    FROM bikes 
    WHERE is_active = 1
`).get();

console.log('\n📊 BIKES TABLE:');
console.log('Total active:', bikes.total);
console.log('ImageKit main_image:', bikes.imagekit);
console.log('Local main_image:', bikes.local);

if (bikes.imagekit === bikes.total) {
    console.log('✅ ALL BIKES ON IMAGEKIT');
} else {
    console.log('❌ SOME BIKES HAVE LOCAL PATHS');
    
    // Find culprit bikes
    const culprits = db.prepare(`
        SELECT id, main_image 
        FROM bikes 
        WHERE is_active = 1 AND main_image LIKE '/images/%'
    `).all();
    
    console.log('\nCulprit Bikes:', culprits);
}
