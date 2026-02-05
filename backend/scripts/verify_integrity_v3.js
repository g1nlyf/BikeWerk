const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log(`Using DB: ${dbPath}`);

// Проверка bike_images
const images = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN local_path LIKE 'https://ik.imagekit.io/%' THEN 1 ELSE 0 END) as imagekit,
    SUM(CASE WHEN local_path LIKE '/images/%' THEN 1 ELSE 0 END) as local,
    SUM(CASE WHEN local_path IS NULL THEN 1 ELSE 0 END) as nulls
  FROM bike_images
`).get();

console.log('📊 BIKE_IMAGES TABLE:');
console.log('Total records:', images.total);
console.log('ImageKit URLs:', images.imagekit);
console.log('Local paths:', images.local);
console.log('NULL paths:', images.nulls);
console.log(images.local === 0 ? '✅ NO LOCAL PATHS FOUND' : '❌ WARNING: LOCAL PATHS EXIST');

// Проверка bikes
const bikes = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN main_image LIKE 'https://ik.imagekit.io/%' THEN 1 ELSE 0 END) as imagekit,
    SUM(CASE WHEN main_image LIKE '/images/%' THEN 1 ELSE 0 END) as local
  FROM bikes WHERE is_active = 1
`).get();

console.log('\n📊 BIKES TABLE:');
console.log('Total active:', bikes.total);
console.log('ImageKit main_image:', bikes.imagekit);
console.log('Local main_image:', bikes.local);
console.log(bikes.local === 0 ? '✅ NO LOCAL MAIN IMAGES' : '❌ WARNING: LOCAL MAIN IMAGES EXIST');
console.log(bikes.imagekit === bikes.total ? '✅ ALL BIKES ON IMAGEKIT' : `⚠️ MIXED STORAGE: ${bikes.imagekit} ImageKit, ${bikes.total - bikes.imagekit - bikes.local} External, ${bikes.local} Local`);

// Analyze discrepancies
console.log('\n🔍 ANALYZING DISCREPANCIES:');

// 1. Bikes with non-ImageKit main_image
try {
    const badBikes = db.prepare(`
        SELECT id, main_image, source, is_active 
        FROM bikes 
        WHERE is_active = 1 
        AND (main_image IS NULL OR main_image NOT LIKE 'https://ik.imagekit.io/%')
    `).all();

    console.log(`\nFound ${badBikes.length} bikes with non-ImageKit main_image:`);
    if (badBikes.length > 0) {
        console.log(badBikes.slice(0, 5)); // Show first 5
        
        // Group by type of main_image
        const analysis = badBikes.reduce((acc, b) => {
            const type = b.main_image === null ? 'NULL' : 
                         b.main_image.startsWith('https://ik.imagekit.io') ? 'ImageKit' :
                         b.main_image.startsWith('http') ? 'External HTTP' : 
                         b.main_image.startsWith('/') ? 'Local Path' : 'Other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        console.log('Breakdown:', analysis);
    }
} catch (e) {
    console.error('Error analyzing bikes:', e);
}

// 2. Bike images with NULL local_path
try {
    const nullImages = db.prepare(`
        SELECT id, bike_id, local_path, image_url 
        FROM bike_images 
        WHERE local_path IS NULL
    `).all();
    console.log(`\nFound ${nullImages.length} bike_images with NULL local_path`);
    if (nullImages.length > 0) {
        console.log(nullImages.slice(0, 5));
    }
} catch (e) {
    console.error('Error analyzing bike_images:', e);
}
