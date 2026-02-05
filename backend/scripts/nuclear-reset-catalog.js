
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const DB_PATH = path.join(__dirname, '../database/eubike.db');
const IMAGES_DIR = path.join(__dirname, '../public/images');

console.log('☢️  NUCLEAR RESET INITIATED ☢️');
console.log('================================');

async function nuclearReset() {
    // 1. Database Cleanup
    console.log(`\n[1/2] Cleaning Database at ${DB_PATH}...`);
    
    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Database file not found!');
        process.exit(1);
    }

    const db = new Database(DB_PATH);
    
    try {
        // Disable Foreign Keys temporarily to allow clean truncation
        db.exec('PRAGMA foreign_keys = OFF;');

        const tablesToClean = [
            'bike_images',
            'bike_analytics',
            'recent_deliveries',
            'shop_orders', // Clean orders in test env
            'refill_queue',
            'needs_manual_review',
            'bikes' // Main table last-ish
        ];

        let totalDeleted = 0;

        db.transaction(() => {
            for (const table of tablesToClean) {
                const info = db.prepare(`SELECT count(*) as count FROM ${table}`).get();
                if (info && info.count > 0) {
                    db.prepare(`DELETE FROM ${table}`).run();
                    // Reset Auto Increment
                    db.prepare(`DELETE FROM sqlite_sequence WHERE name='${table}'`).run();
                    console.log(`   ✅ Cleared table: ${table} (${info.count} records)`);
                    totalDeleted += info.count;
                } else {
                    console.log(`   ⚪ Table empty: ${table}`);
                }
            }
        })();

        // Re-enable Foreign Keys
        db.exec('PRAGMA foreign_keys = ON;');
        
        console.log(`\n   ✨ Database clean. Removed ${totalDeleted} records.`);

    } catch (err) {
        console.error('❌ Database Error:', err);
        process.exit(1);
    } finally {
        db.close();
    }

    // 2. Image Cleanup
    console.log(`\n[2/2] Cleaning Images at ${IMAGES_DIR}...`);
    
    if (fs.existsSync(IMAGES_DIR)) {
        const files = fs.readdirSync(IMAGES_DIR);
        let imageCount = 0;
        
        for (const file of files) {
            if (file === '.gitkeep') continue; // Preserve gitkeep
            
            const filePath = path.join(IMAGES_DIR, file);
            // Check if it's a directory (unlikely but possible)
            if (fs.lstatSync(filePath).isDirectory()) {
                 fs.rmSync(filePath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(filePath);
            }
            imageCount++;
        }
        console.log(`   ✅ Deleted ${imageCount} image files.`);
    } else {
        console.log('   ⚪ Images directory not found.');
    }

    console.log('\n================================');
    console.log('✅ NUCLEAR RESET COMPLETE. CATALOG IS EMPTY.');
    console.log('================================\n');
}

nuclearReset();
