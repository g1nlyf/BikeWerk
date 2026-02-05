const { db } = require('../src/js/mysql-config');
const collector = require('../scrapers/buycycle-collector');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Collector is already instantiated in the module export
// const collector = new BuycycleCollector(); 

// Logging helper
function logTech(message) {
    console.log(`[TECH-LOG] ${message}`);
}

async function ensureColumn(tableName, columnName, columnType) {
    const columns = await db.query(`PRAGMA table_info(${tableName})`);
    const exists = columns.some(col => col.name === columnName);
    if (!exists) {
        await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
        console.log(`   ✅ Добавлена колонка ${columnName} в ${tableName}`);
    }
}

async function nuclearHunt() {
    console.log('☢️ INITIATING NUCLEAR HUNT PROTOCOL ☢️');
    
    // 1. Wipe DB
    console.log('🗑️ Wiping Database Catalog...');
    try {
        await db.query('PRAGMA foreign_keys = OFF');
        await db.query('DELETE FROM bike_images');
        await db.query('DELETE FROM bike_analytics');
        await db.query('DELETE FROM bike_behavior_metrics');
        await db.query('DELETE FROM metric_events');
        await db.query('DELETE FROM recent_deliveries');
        await db.query('DELETE FROM shop_orders');
        await db.query('DELETE FROM bikes');
        await db.query('DELETE FROM failed_bikes'); // Clear failures too for a clean slate
        
        // Reset auto-increment
        try {
            await db.query('DELETE FROM sqlite_sequence WHERE name="bikes"');
            await db.query('DELETE FROM sqlite_sequence WHERE name="bike_images"');
            await db.query('DELETE FROM sqlite_sequence WHERE name="failed_bikes"');
        } catch (e) {
            console.log('   ℹ️ SQLite sequence reset skipped (not critical)');
        }
        await db.query('PRAGMA foreign_keys = ON');
        console.log('   ✅ Database tables truncated.');
        await ensureColumn('bikes', 'data', 'TEXT');
    } catch (e) {
        console.error('   ❌ DB Wipe Error:', e.message);
    }

    // 2. Wipe Local Images
    console.log('🗑️ Wiping Local Images...');
    const imagesDir = path.resolve(__dirname, '../public/images/bikes');
    if (fs.existsSync(imagesDir)) {
        fs.rmSync(imagesDir, { recursive: true, force: true });
        fs.mkdirSync(imagesDir, { recursive: true });
        const remaining = fs.readdirSync(imagesDir);
        if (remaining.length > 0) {
            throw new Error('Каталог изображений не пуст после очистки');
        }
        console.log('   ✅ Каталог изображений очищен.');
    } else {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // 3. Scrape High Demand Bikes
    console.log('🕵️ Starting Fresh Scrape (Target: 10 Bikes)...');
    
    // Scrape MTB + Road with запасом to ensure we get 10 valid ones
    logTech('Using Puppeteer Stealth + Gemini 2.5 Flash for Scraping');
    
    let allBikes = [];
    
    try {
        const mtb = await collector.collectHighDemand('mountainbike/high-demand/1', 12);
        allBikes.push(...mtb);
        console.log(`   Found ${mtb.length} MTBs`);
    } catch (e) {
        logTech(`MTB Scrape Error (Retry may occur): ${e.message}`);
    }

    try {
        const road = await collector.collectHighDemand('road-gravel/high-demand/1', 12);
        allBikes.push(...road);
        console.log(`   Found ${road.length} Road/Gravel bikes`);
    } catch (e) {
        logTech(`Road Scrape Error (Retry may occur): ${e.message}`);
    }

    // 4. Process & Save Top 10
    const targetCount = 10;
    console.log(`💾 Processing Top ${targetCount} Bikes...`);
    
    const dumpData = {};
    let processed = 0;

    for (let i = 0; i < allBikes.length && processed < targetCount; i++) {
        const bike = allBikes[i];
        if (i === 0) console.log('DEBUG FIRST BIKE KEYS:', Object.keys(bike));
        console.log(`   Processing #${i+1}: ${bike.basic_info?.brand} ${bike.basic_info?.model}`);

        // Insert into DB first to get ID
        let bikeId = null;
        let preDbSnapshot = null;
        try {
            // Ensure full JSON data is saved
            preDbSnapshot = JSON.parse(JSON.stringify(bike));
            const fullData = JSON.stringify(preDbSnapshot);
            
            const result = await db.query(`
                INSERT INTO bikes (
                    name, brand, model, year, price, category, condition_status, 
                    description, main_image, source_url, quality_score, is_active, 
                    fmv, hotness_score, data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                bike.basic_info.name || `${bike.basic_info.brand} ${bike.basic_info.model}`,
                bike.basic_info.brand,
                bike.basic_info.model,
                bike.basic_info.year,
                bike.pricing.price || 0,
                bike.basic_info.category || 'unknown',
                bike.condition.status || 'good',
                bike.basic_info.description || '',
                '', // Placeholder for main_image, will update later
                bike.meta.source_url,
                bike.quality_score || 0,
                1,
                bike.pricing.price || 0, // FMV approx
                bike.ranking.hotness_score || 0,
                fullData // Save full JSON
            ]);
            
            bikeId = result.insertId;
            console.log(`      ✅ Inserted Bike ID: ${bikeId}`);

        } catch (dbErr) {
            console.error(`      ❌ DB Insert Failed: ${dbErr.message}`);
            logTech(`DB Insert failed for ${bike.brand} ${bike.model}`);
            continue; // Skip image processing if DB insert failed
        }

        // Prepare Image Directory: public/images/bikes/id{ID}
        // Correct path relative to this script: ../../public/images/bikes/id{ID}
        const bikeImagesDir = path.resolve(imagesDir, `id${bikeId}`);
        if (!fs.existsSync(bikeImagesDir)) {
            fs.mkdirSync(bikeImagesDir, { recursive: true });
        }

        // Process Gallery Images
        const gallery = bike.media?.gallery || [];
        if (bike.media?.main_image && !gallery.includes(bike.media.main_image)) {
            gallery.unshift(bike.media.main_image);
        }
        const validGallery = [...new Set(gallery.filter(img => img && img.startsWith('http') && !img.includes('.svg') && !img.includes('icon')))];

        const localGalleryPaths = [];
        let mainLocalPath = '';

        console.log(`      🖼️ Processing ${validGallery.length} images...`);

        for (let idx = 0; idx < validGallery.length; idx++) {
            const imageUrl = validGallery[idx];

            const filename = `${idx}.webp`; // 0.webp, 1.webp, ...
            const filepath = path.join(bikeImagesDir, filename);
            const dbPath = `/images/bikes/id${bikeId}/${filename}`;

            try {
                await downloadImage(imageUrl, filepath);
                localGalleryPaths.push(dbPath);
                
                // Save to bike_images table
                await db.query(`
                    INSERT INTO bike_images (bike_id, image_url, image_order, is_main)
                    VALUES (?, ?, ?, ?)
                `, [bikeId, dbPath, idx, idx === 0 ? 1 : 0]);

                if (idx === 0) {
                    mainLocalPath = dbPath;
                }

            } catch (e) {
                console.error(`         ❌ Download Failed (${idx}): ${e.message}`);
            }
        }

        if (localGalleryPaths.length < 2) {
            console.log(`      ❌ Недостаточно фото (${localGalleryPaths.length}). Байк удалён.`);
            await db.query('DELETE FROM bike_images WHERE bike_id = ?', [bikeId]);
            await db.query('DELETE FROM bikes WHERE id = ?', [bikeId]);
            if (fs.existsSync(bikeImagesDir)) {
                fs.rmSync(bikeImagesDir, { recursive: true, force: true });
            }
            continue;
        }

        // Update Main Image in bikes table
        if (mainLocalPath) {
            await db.query('UPDATE bikes SET main_image = ? WHERE id = ?', [mainLocalPath, bikeId]);
            bike.media.local_image = mainLocalPath;
        }

        // Update Dump Data
        bike.media.local_gallery = localGalleryPaths;
        if (preDbSnapshot) {
            dumpData[`${bikeId}`] = preDbSnapshot;
        }
        processed += 1;
    }

    // 5. Write Dump File
    const dumpPath = path.resolve(__dirname, '../tests/debug/full_json_dump_10.json');
    if (processed < targetCount) {
        throw new Error(`Недостаточно валидных байков: ${processed}/${targetCount}`);
    }
    fs.writeFileSync(dumpPath, JSON.stringify(dumpData, null, 2));
    console.log(`📄 Dump written to: ${dumpPath}`);
    
    logTech('Nuclear Hunt Protocol Complete');
    
    // Close DB connection (if standalone)
    // process.exit(0); 
}

// Helper: Download Image
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Status Code: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

// Run
if (require.main === module) {
    nuclearHunt().catch(console.error);
}
