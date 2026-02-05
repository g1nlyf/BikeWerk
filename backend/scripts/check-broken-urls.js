const Database = require('better-sqlite3');
const path = require('path');
const fetch = require('node-fetch');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

async function checkBrokenUrls() {
    console.log('Checking for broken image URLs in database...\n');
    
    // Check bikes.main_image
    const bikes = db.prepare('SELECT id, main_image FROM bikes WHERE is_active = 1').all();
    console.log('=== Checking bikes.main_image ===');
    for (const bike of bikes) {
        if (bike.main_image) {
            try {
                const r = await fetch(bike.main_image, { method: 'HEAD' });
                console.log(`[Bike ${bike.id}] ${r.status} - ${bike.main_image.split('/').pop()}`);
                if (r.status !== 200) {
                    console.log(`   ^ BROKEN!`);
                }
            } catch (e) {
                console.log(`[Bike ${bike.id}] ERROR - ${e.message}`);
            }
        }
    }
    
    // Check bike_images.local_path for bikes 3 and 5
    console.log('\n=== Checking bike_images for bikes 3 and 5 ===');
    const images = db.prepare(`
        SELECT bi.id, bi.bike_id, bi.local_path, bi.is_main 
        FROM bike_images bi 
        WHERE bi.bike_id IN (3, 5) 
        ORDER BY bi.bike_id, bi.is_main DESC, bi.id
    `).all();
    
    for (const img of images) {
        if (img.local_path) {
            try {
                const r = await fetch(img.local_path, { method: 'HEAD' });
                const status = r.status === 200 ? '✓' : '✗';
                console.log(`[Bike ${img.bike_id}] [${img.is_main ? 'MAIN' : '    '}] ${status} ${r.status} - ${img.local_path.split('/').pop()}`);
            } catch (e) {
                console.log(`[Bike ${img.bike_id}] [${img.is_main ? 'MAIN' : '    '}] ERROR - ${e.message}`);
            }
        }
    }
    
    db.close();
}

checkBrokenUrls();
