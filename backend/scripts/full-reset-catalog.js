/**
 * Full Catalog Reset Script
 * 
 * 1. Delete all images from ImageKit /bikes folder
 * 2. Clear all bike-related tables in DB
 * 3. Run HotDealHunter for 5 bikes
 * 4. Verify and export results
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

// ImageKit SDK
const ImageKit = require('imagekit');
const imageKitPublicKey = process.env.IMAGEKIT_PUBLIC_KEY;
const imageKitPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY;
const imageKitUrlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

if (!imageKitPublicKey || !imageKitPrivateKey || !imageKitUrlEndpoint) {
    throw new Error('Missing ImageKit credentials. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT.');
}

const imagekit = new ImageKit({
    publicKey: imageKitPublicKey,
    privateKey: imageKitPrivateKey,
    urlEndpoint: imageKitUrlEndpoint
});

console.log('═'.repeat(60));
console.log('☢️  FULL CATALOG RESET');
console.log('═'.repeat(60));

async function deleteImageKitFolder() {
    console.log('\n🗑️  Step 1: Deleting ImageKit files in /bikes folder...');
    
    let totalDeleted = 0;
    let hasMore = true;
    
    while (hasMore) {
        try {
            // List files in /bikes folder
            const files = await imagekit.listFiles({
                path: '/bikes',
                limit: 100
            });
            
            if (!files || files.length === 0) {
                hasMore = false;
                break;
            }
            
            console.log(`   Found ${files.length} files to delete...`);
            
            // Delete each file
            for (const file of files) {
                try {
                    await imagekit.deleteFile(file.fileId);
                    totalDeleted++;
                    if (totalDeleted % 20 === 0) {
                        process.stdout.write(`   Deleted ${totalDeleted} files...\r`);
                    }
                } catch (e) {
                    console.log(`   ⚠️ Could not delete ${file.name}: ${e.message}`);
                }
            }
            
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 500));
            
            // Check if there are more
            hasMore = files.length === 100;
            
        } catch (e) {
            console.log(`   ⚠️ List files error: ${e.message}`);
            hasMore = false;
        }
    }
    
    console.log(`   ✅ Deleted ${totalDeleted} files from ImageKit`);
    return totalDeleted;
}

async function clearDatabase() {
    console.log('\n🗑️  Step 2: Clearing database tables...');
    
    // Backup bikes to market_history first
    const bikesToBackup = db.prepare(`
        SELECT brand, model, year, price as price_eur, name as title, original_url as source_url, 
               source_url as alt_url, category, source_platform
        FROM bikes 
        WHERE brand IS NOT NULL AND brand != 'Unknown' AND price > 0
    `).all();
    
    const insertHistory = db.prepare(`
        INSERT OR IGNORE INTO market_history 
        (brand, model, year, price_eur, title, source_url, category, source_platform, scraped_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    let backed = 0;
    db.transaction(() => {
        for (const bike of bikesToBackup) {
            try {
                insertHistory.run(
                    bike.brand, 
                    bike.model, 
                    bike.year, 
                    bike.price_eur, 
                    bike.title, 
                    bike.source_url || bike.alt_url, 
                    bike.category, 
                    bike.source_platform || 'backup'
                );
                backed++;
            } catch (e) {}
        }
    })();
    console.log(`   📦 Backed up ${backed} bikes to market_history`);
    
    // Clear tables
    db.exec(`
        PRAGMA foreign_keys = OFF;
        DELETE FROM bike_images;
        DELETE FROM bike_specs;
        DELETE FROM bike_analytics;
        DELETE FROM bike_behavior_metrics;
        DELETE FROM metric_events WHERE bike_id IS NOT NULL;
        DELETE FROM bikes;
        PRAGMA foreign_keys = ON;
    `);
    
    // Reset auto-increment
    try {
        db.exec(`
            DELETE FROM sqlite_sequence WHERE name = 'bikes';
            DELETE FROM sqlite_sequence WHERE name = 'bike_images';
        `);
    } catch (e) {}
    
    console.log('   ✅ Database tables cleared');
    
    // Verify
    const count = db.prepare('SELECT COUNT(*) as cnt FROM bikes').get().cnt;
    console.log(`   📊 Bikes after clear: ${count}`);
}

async function clearLocalImages() {
    console.log('\n🗑️  Step 3: Clearing local images...');
    
    const imagesDir = path.resolve(__dirname, '../public/images/bikes');
    
    if (fs.existsSync(imagesDir)) {
        let count = 0;
        const items = fs.readdirSync(imagesDir);
        
        for (const item of items) {
            if (item === '.gitkeep') continue;
            
            const itemPath = path.join(imagesDir, item);
            try {
                if (fs.lstatSync(itemPath).isDirectory()) {
                    fs.rmSync(itemPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(itemPath);
                }
                count++;
            } catch (e) {}
        }
        
        console.log(`   ✅ Deleted ${count} local items`);
    } else {
        console.log('   ⚪ Local images directory not found');
    }
}

async function runHotDealHunter() {
    console.log('\n🔥 Step 4: Running HotDealHunter for 5 bikes...');
    console.log('   This may take 3-5 minutes...\n');
    
    try {
        const HotDealHunter = require('../src/services/HotDealHunter');
        const result = await HotDealHunter.hunt(5);
        console.log('\n   📊 Hunter result:', result);
        return result;
    } catch (e) {
        console.error('   ❌ Hunter error:', e.message);
        console.error(e.stack);
        return { added: 0, error: e.message };
    }
}

async function verifyAndExport() {
    console.log('\n📊 Step 5: Verification and Export...');
    
    // Reopen DB to get fresh data
    const db2 = new Database(dbPath);
    
    const bikeCount = db2.prepare('SELECT COUNT(*) as cnt FROM bikes').get().cnt;
    const imageCount = db2.prepare('SELECT COUNT(*) as cnt FROM bike_images').get().cnt;
    const hotCount = db2.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE is_hot_offer = 1 OR is_hot = 1').get().cnt;
    
    console.log(`   Bikes: ${bikeCount}`);
    console.log(`   Images: ${imageCount}`);
    console.log(`   Hot deals: ${hotCount}`);
    
    if (bikeCount > 0) {
        console.log('\n📦 New bikes in catalog:');
        
        const bikes = db2.prepare(`
            SELECT id, brand, model, year, price, fmv, category, sub_category, discipline,
                   is_hot_offer, ranking_score, quality_score, condition_grade
            FROM bikes 
            ORDER BY id
        `).all();
        
        bikes.forEach(b => {
            const hot = b.is_hot_offer ? '🔥' : '';
            console.log(`   [${b.id}] ${b.brand} ${b.model} (${b.year || '?'}) - €${b.price}`);
            console.log(`        FMV: ${b.fmv || 'NULL'} | Category: ${b.category}/${b.sub_category || '-'}`);
            console.log(`        Score: ${(b.ranking_score || 0).toFixed(3)} | Quality: ${b.quality_score || '?'} | Grade: ${b.condition_grade || '?'} ${hot}`);
        });
        
        // Export first bike as JSON
        console.log('\n📄 First bike full JSON export:');
        const firstBike = db2.prepare('SELECT * FROM bikes LIMIT 1').get();
        
        // Write to file for inspection
        const exportPath = path.resolve(__dirname, '../test-outputs/first-bike-export.json');
        fs.mkdirSync(path.dirname(exportPath), { recursive: true });
        fs.writeFileSync(exportPath, JSON.stringify(firstBike, null, 2));
        console.log(`   Saved to: ${exportPath}`);
        
        // Print key fields
        console.log('\n   Key fields from first bike:');
        const keyFields = ['id', 'name', 'brand', 'model', 'year', 'price', 'fmv', 'category', 
                          'sub_category', 'discipline', 'condition_grade', 'condition_score',
                          'ranking_score', 'is_hot_offer', 'source_url', 'main_image'];
        for (const field of keyFields) {
            const value = firstBike[field];
            const display = value === null ? 'NULL' : (typeof value === 'string' && value.length > 60 ? value.slice(0, 60) + '...' : value);
            console.log(`   ${field}: ${display}`);
        }
    }
    
    db2.close();
}

// Main
async function main() {
    try {
        // Step 1: Delete ImageKit files
        await deleteImageKitFolder();
        
        // Step 2: Clear database
        await clearDatabase();
        
        // Step 3: Clear local images
        await clearLocalImages();
        
        // Step 4: Run hunter
        await runHotDealHunter();
        
        // Step 5: Verify
        await verifyAndExport();
        
        console.log('\n' + '═'.repeat(60));
        console.log('✅ FULL RESET COMPLETE');
        console.log('═'.repeat(60));
        
    } catch (e) {
        console.error('\n❌ RESET FAILED:', e.message);
        console.error(e.stack);
    } finally {
        db.close();
    }
}

main();
