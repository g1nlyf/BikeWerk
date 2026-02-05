const fs = require('fs');
const path = require('path');
const https = require('https');
const { db } = require('../src/js/mysql-config');

// Paths
// User requested: C:\Users\hacke\CascadeProjects\Finals1\eubike\backend\public\images\bikes
// Script is in: backend/scripts
// So we need ../public
const IMAGES_ROOT = path.resolve(__dirname, '../public/images/bikes');
const JSON_DUMP_PATH = path.resolve(__dirname, '../tests/debug/full_json_dump_10.json');

// Ensure root exists
if (!fs.existsSync(IMAGES_ROOT)) {
    fs.mkdirSync(IMAGES_ROOT, { recursive: true });
}

// Download helper
async function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        if (!url || url.includes('.svg') || url.includes('icon')) {
            // Skip SVGs or empty URLs
            return resolve(false);
        }

        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlink(destPath, () => {}); // Delete partial
                return reject(new Error(`Status ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(true));
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function debugImageSystem() {
    console.log('🔧 STARTING IMAGE SYSTEM DEBUG & FIX 🔧');

    // 1. Get DB State
    console.log('📊 Fetching current DB state...');
    const bikes = await db.query('SELECT id, name, main_image FROM bikes');
    const validIds = new Set(bikes.map(b => b.id));
    console.log(`   Found ${bikes.length} bikes in DB. IDs: ${Array.from(validIds).join(', ')}`);

    // 2. Load JSON Dump (Source of Truth for URLs)
    let dumpData = {};
    if (fs.existsSync(JSON_DUMP_PATH)) {
        dumpData = JSON.parse(fs.readFileSync(JSON_DUMP_PATH, 'utf8'));
        console.log('   Loaded JSON dump for URL recovery.');
    } else {
        console.warn('   ⚠️ JSON dump not found. Cannot recover remote URLs if missing.');
    }

    // 3. Process Each Bike
    for (const bike of bikes) {
        console.log(`\n🚲 Processing Bike #${bike.id}: ${bike.name}`);
        
        // Match with Dump (Key "1" corresponds to ID 1 usually)
        const dumpBike = dumpData[bike.id.toString()];
        const remoteUrl = dumpBike?.media?.main_image || dumpBike?.media?.gallery?.[0];
        
        const bikeDir = path.join(IMAGES_ROOT, `id${bike.id}`);
        if (!fs.existsSync(bikeDir)) {
            fs.mkdirSync(bikeDir, { recursive: true });
            console.log(`   📁 Created directory: ${bikeDir}`);
        }

        // Determine target filename
        const targetFilename = '0.webp'; // Standardizing on 0.webp or jpg
        const localPath = path.join(bikeDir, targetFilename);
        const dbPath = `/images/bikes/id${bike.id}/${targetFilename}`;

        // Check if we need to download
        let needsDownload = true;
        if (fs.existsSync(localPath)) {
            const stats = fs.statSync(localPath);
            if (stats.size > 0) {
                console.log('   ✅ Image already exists locally.');
                needsDownload = false;
            }
        }

        if (needsDownload && remoteUrl) {
            console.log(`   ⬇️ Downloading from: ${remoteUrl}`);
            try {
                const success = await downloadImage(remoteUrl, localPath);
                if (success) {
                    console.log('   ✅ Download successful.');
                } else {
                    console.log('   ⚠️ Skipped download (Invalid URL or SVG).');
                    // Fallback Strategy: Copy a placeholder or another bike's image
                    await handleFallbackImage(bike, bikeDir, targetFilename);
                }
            } catch (e) {
                console.error(`   ❌ Download failed: ${e.message}`);
                await handleFallbackImage(bike, bikeDir, targetFilename);
            }
        } else if (!remoteUrl) {
            console.log('   ⚠️ No remote URL found in dump for this bike.');
            await handleFallbackImage(bike, bikeDir, targetFilename);
        }

        // Update DB if path is different
        if (bike.main_image !== dbPath) {
            console.log(`   🔄 Updating DB record: ${dbPath}`);
            await db.query('UPDATE bikes SET main_image = ? WHERE id = ?', [dbPath, bike.id]);
        }
    }

    // 4. Cleanup Orphans
    console.log('\n🧹 Cleaning up orphan folders...');
    const items = fs.readdirSync(IMAGES_ROOT);
    for (const item of items) {
        const itemPath = path.join(IMAGES_ROOT, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
            // Check if it matches id{N}
            const match = item.match(/^id(\d+)$/);
            if (match) {
                const id = parseInt(match[1]);
                if (!validIds.has(id)) {
                    console.log(`   🗑️ Removing orphan folder: ${item}`);
                    fs.rmSync(itemPath, { recursive: true, force: true });
                }
            } else {
                console.log(`   ❓ Unknown folder (skipping): ${item}`);
            }
        } else {
            // It's a file (like bike_1_....jpg)
            console.log(`   🗑️ Removing loose file: ${item}`);
            fs.unlinkSync(itemPath);
        }
    }

    console.log('\n✅ Image System Debug & Fix Complete.');
}

async function handleFallbackImage(bike, bikeDir, targetFilename) {
    // Try to find a valid image from another bike of the same category
    // This requires us to know which bikes HAVE images. 
    // Since we process sequentially, we might not have them all yet.
    // BUT we know Bike 1 (MTB) and Bike 10 (Road) are likely good based on previous run.
    
    // We can hardcode fallback logic:
    // If MTB -> Try to copy from id1 or id4 or id5 or id6
    // If Road -> Try to copy from id10
    
    // Let's assume id1 is MTB and id10 is Road for this specific dataset.
    // In a generic script, we would search for ANY existing image.
    
    let sourceId = null;
    if (bike.name && (bike.name.includes('Reign') || bike.name.includes('Tyee') || bike.name.includes('Status') || bike.name.includes('Meta') || bike.name.includes('Jeffsy') || bike.name.includes('Spectral') || bike.name.includes('Soul'))) {
        // It's likely MTB
        // Check if id1 exists
        if (fs.existsSync(path.join(IMAGES_ROOT, 'id1', '0.webp'))) sourceId = 1;
        else if (fs.existsSync(path.join(IMAGES_ROOT, 'id4', '0.webp'))) sourceId = 4;
        else if (fs.existsSync(path.join(IMAGES_ROOT, 'id5', '0.webp'))) sourceId = 5;
    } else {
        // Assume Road
        if (fs.existsSync(path.join(IMAGES_ROOT, 'id10', '0.webp'))) sourceId = 10;
    }

    if (sourceId) {
        const sourcePath = path.join(IMAGES_ROOT, `id${sourceId}`, '0.webp');
        const destPath = path.join(bikeDir, targetFilename);
        try {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`   � Applied Fallback Image from Bike #${sourceId}`);
        } catch (e) {
            console.error(`   ❌ Fallback copy failed: ${e.message}`);
        }
    } else {
        console.warn('   ⚠️ No fallback image source found.');
    }
}

debugImageSystem().catch(console.error);
