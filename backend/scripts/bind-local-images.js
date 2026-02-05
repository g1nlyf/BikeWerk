const fs = require('fs');
const path = require('path');
const axios = require('axios');
const initSqlJs = require('sql.js');
const { DatabaseManager } = require('../src/js/mysql-config');

const DB_PATH = path.resolve(__dirname, '../../database/eubike.db');
const IMAGES_ROOT = path.resolve(__dirname, '../public/images/bikes');

// 10 Distinct Unsplash Images for bikes
const BIKE_IMAGES = [
    'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400', // Blue bike
    'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=400', // Mountain bike
    'https://images.unsplash.com/photo-1505705694340-019e1e335916?w=400', // Replacement for 2
    'https://images.unsplash.com/photo-1528629297340-d1d466945dc5?w=400', // Replacement for 3
    'https://images.unsplash.com/photo-1529422643029-d4585747aaf2?w=400', // Replacement for 4
    'https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=400', // Replacement for 5
    'https://images.unsplash.com/photo-1505705694340-019e1e335916?w=400', // Urban
    'https://images.unsplash.com/photo-1528629297340-d1d466945dc5?w=400', // Racing
    'https://images.unsplash.com/photo-1529422643029-d4585747aaf2?w=400', // Cyclist
    'https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=400'  // Sunset
];

async function downloadImage(url, destPath) {
    const writer = fs.createWriteStream(destPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function bindImages() {
    console.log('🖼️  Binding Local Images to Bikes...');
    
    // 1. Get Active Bikes
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    const bikes = await dbManager.query("SELECT id, name FROM bikes WHERE is_active=1 ORDER BY id ASC");
    console.log(`   Found ${bikes.length} active bikes.`);

    for (let i = 0; i < bikes.length; i++) {
        const bike = bikes[i];
        const imageUrl = BIKE_IMAGES[i % BIKE_IMAGES.length];
        
        // Prepare local path
        // backend/public/images/bikes/id{ID}/0.jpg
        const bikeDir = path.join(IMAGES_ROOT, `id${bike.id}`);
        if (!fs.existsSync(bikeDir)) {
            fs.mkdirSync(bikeDir, { recursive: true });
        }
        
        const fileName = '0.jpg';
        const localFilePath = path.join(bikeDir, fileName);
        
        // Download
        try {
            console.log(`   ⬇️  Downloading image for Bike ${bike.id} (${bike.name})...`);
            await downloadImage(imageUrl, localFilePath);
            
            // Update DB
            // Path relative to 'images' or 'public'?
            // Frontend resolves resolveImageUrl(path).
            // If path starts with /, it appends to base.
            // Server serves /images from public/images.
            // So if we store 'images/bikes/idX/0.jpg', frontend sees '/images/bikes/idX/0.jpg' -> maps to backend/public/images/bikes/idX/0.jpg
            // Wait, server serves `app.use('/images', express.static(.../images))`
            // So url `/images/bikes/id1/0.jpg` maps to `.../public/images/bikes/id1/0.jpg`
            // So we should store `bikes/id${bike.id}/0.jpg` if using /images prefix?
            // Let's check `resolveImageUrl`.
            // If DB has `bikes/id1/0.jpg`, resolveImageUrl -> `/bikes/id1/0.jpg`.
            // Server static is at `/images`.
            // So correct path in DB should probably be `bikes/id${bike.id}/0.jpg` AND we need to make sure frontend prepends `/images` OR we store `/images/bikes/...`
            
            // Let's look at existing data from `check-images.js`:
            // It had `https://...`.
            // Let's look at `server.js`:
            // `app.use('/images', express.static(path.join(publicRoot, 'images')))`
            // So if file is at `.../public/images/bikes/id1/0.jpg`
            // Request `GET /images/bikes/id1/0.jpg` works.
            
            // If DB stores `bikes/id1/0.jpg`
            // Frontend `resolveImageUrl` -> `/bikes/id1/0.jpg` (if relative).
            // Browser requests `http://api/bikes/id1/0.jpg` -> 404.
            
            // If DB stores `/images/bikes/id1/0.jpg`
            // Frontend `resolveImageUrl` -> `/images/bikes/id1/0.jpg`.
            // Browser requests `http://api/images/bikes/id1/0.jpg` -> Success.
            
            // So we should store `/images/bikes/id${bike.id}/0.jpg`.
            
            const dbPath = `/images/bikes/id${bike.id}/${fileName}`;
            await dbManager.query("UPDATE bikes SET main_image = ? WHERE id = ?", [dbPath, bike.id]);
            console.log(`   ✅ Bound ${dbPath} to Bike ${bike.id}`);
            
        } catch (e) {
            console.error(`   ❌ Failed to download/bind for Bike ${bike.id}: ${e.message}`);
        }
    }
    
    await dbManager.close();
    console.log('✨ All images bound locally.');
}

bindImages();
