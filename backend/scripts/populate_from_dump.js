const fs = require('fs');
const path = require('path');
const { DatabaseManager } = require('../src/js/mysql-config');
const axios = require('axios');
const https = require('https');

// Create an axios instance with a custom agent that ignores SSL errors (if any)
const agent = new https.Agent({  
  rejectUnauthorized: false
});

async function downloadImage(url, filepath) {
    if (!url) return;
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            httpsAgent: agent,
            timeout: 10000 // 10s timeout
        });
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (e) {
        console.error(`⚠️ Failed to download image ${url}:`, e.message);
    }
}

async function populateFromDump() {
    console.log('🚀 Starting Data Population...');
    const db = new DatabaseManager();
    await db.initialize();

    console.log('📦 Loading JSON Dump...');
    // Adjusted path for remote server structure or ensuring fallback
    const dumpPath = path.join(__dirname, '../tests/debug/full_json_dump_10.json');
    
    if (!fs.existsSync(dumpPath)) {
        console.error(`❌ Dump file not found at: ${dumpPath}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(dumpPath, 'utf8');
    const bikes = JSON.parse(rawData);

    console.log(`📊 Found ${bikes.length} bikes in dump.`);

    const imagesDir = path.join(__dirname, '../public/images/bikes');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    for (const bike of bikes) {
        try {
            console.log(`   ⚙️ Processing: ${bike.basic_info.name}`);

            // Insert into bikes
            const result = await db.query(`
                INSERT INTO bikes 
                (name, description, price, year, brand, model, category, 
                 size, wheel_size, frame_material, condition_score, quality_score, 
                 main_image, source_url, created_at, is_active, ranking_score, priority, condition_grade,
                 original_price, discount, fmv, condition_status, needs_audit, audit_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'high', ?, ?, ?, ?, 'used', 0, 'approved')
            `, [
                bike.basic_info.name,
                bike.basic_info.description || '',
                bike.pricing.price,
                bike.basic_info.year,
                bike.basic_info.brand,
                bike.basic_info.model,
                bike.basic_info.category,
                bike.specs.frame_size || 'M',
                bike.specs.wheel_size || '29"',
                bike.specs.frame_material || 'Aluminum',
                bike.condition.score || 80,
                bike.quality_score || 80,
                '', // Placeholder for main_image
                bike.meta.source_url,
                new Date().toISOString(),
                bike.ranking.ranking_score || 100,
                bike.condition.grade || 'Great',
                bike.pricing.original_price || bike.pricing.price,
                bike.pricing.discount || 0,
                bike.pricing.fmv || bike.pricing.price
            ]);

            const bikeId = result.lastInsertRowid; // SQLite uses lastInsertRowid
            const bikeDir = path.join(imagesDir, `id${bikeId}`);
            if (!fs.existsSync(bikeDir)) fs.mkdirSync(bikeDir, { recursive: true });

            // Download Main Image
            let localMainImage = '';
            if (bike.media.main_image) {
                const filename = '0.webp';
                const localPath = path.join(bikeDir, filename);
                await downloadImage(bike.media.main_image, localPath);
                
                // Verify file exists and has size > 0
                if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
                    localMainImage = `/images/bikes/id${bikeId}/${filename}`;
                    await db.query('UPDATE bikes SET main_image = ? WHERE id = ?', [localMainImage, bikeId]);
                    await db.query('INSERT INTO bike_images (bike_id, image_url, is_main, image_order) VALUES (?, ?, 1, 0)', [bikeId, localMainImage]);
                }
            }

            // Download Gallery
            if (bike.media.gallery && bike.media.gallery.length > 0) {
                let order = 1;
                for (const imgUrl of bike.media.gallery.slice(0, 5)) {
                    if (imgUrl === bike.media.main_image) continue;
                    
                    const filename = `${order}.webp`;
                    const localPath = path.join(bikeDir, filename);
                    await downloadImage(imgUrl, localPath);
                    
                    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
                        const dbPath = `/images/bikes/id${bikeId}/${filename}`;
                        await db.query('INSERT INTO bike_images (bike_id, image_url, is_main, image_order) VALUES (?, ?, 0, ?)', [bikeId, dbPath, order]);
                        order++;
                    }
                }
            }
            
        } catch (err) {
            console.error(`❌ Error inserting bike ${bike.basic_info.name}:`, err.message);
        }
    }
    console.log('✅ Population Complete!');
}

populateFromDump();
