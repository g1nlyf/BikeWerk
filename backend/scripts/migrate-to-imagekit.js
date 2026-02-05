require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const imageKitService = require('../src/services/ImageKitService');

const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_LOCAL = process.argv.includes('--delete-local');

async function migratePhotos() {
    console.log(`\n🚀 Starting migration to ImageKit... ${DRY_RUN ? '(DRY RUN)' : ''}\n`);

    const dbPath = path.resolve(__dirname, '../database/eubike.db');
    const db = new Database(dbPath);
    
    const records = db.prepare(`
        SELECT * FROM bike_images 
        WHERE local_path LIKE '/images/%' OR local_path LIKE 'public/images/%'
    `).all();

    const projectRoot = path.resolve(__dirname, '../../');
    const possibleRoots = [
        path.join(projectRoot, 'backend/public'),
        path.join(projectRoot, 'frontend/public'),
        path.join(projectRoot, 'public')
    ];

    const stats = {
        total: records.length,
        migrated: 0,
        failed: 0,
        skipped: 0,
        bytesUploaded: 0,
        errors: []
    };

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const relPath = record.local_path.startsWith('/') ? record.local_path.slice(1) : record.local_path;
        
        let fullPath = null;
        for (const root of possibleRoots) {
            const p = path.join(root, relPath);
            if (fs.existsSync(p)) {
                fullPath = p;
                break;
            }
        }

        if (!fullPath) {
            console.warn(`[${i+1}/${records.length}] ❌ Missing file: ${record.local_path}`);
            stats.failed++;
            stats.errors.push(`${record.local_path} (File not found)`);
            continue;
        }

        const fileName = path.basename(fullPath);
        const fileSize = fs.statSync(fullPath).size;
        const fileSizeKB = (fileSize / 1024).toFixed(1);

        console.log(`[${i+1}/${records.length}] Bike #${record.bike_id} - ${fileName}`);
        console.log(`   📂 Reading: ${record.local_path} (${fileSizeKB} KB)`);

        if (DRY_RUN) {
            console.log(`   ☁️  [DRY RUN] Would upload to ImageKit...`);
            console.log(`   💾 [DRY RUN] Would update DB...`);
            stats.migrated++;
            stats.bytesUploaded += fileSize;
            continue;
        }

        try {
            const buffer = fs.readFileSync(fullPath);
            console.log(`   ☁️  Uploading to ImageKit...`);
            
            const folder = `/bikes/id${record.bike_id}`;
            const result = await imageKitService.uploadImage(buffer, fileName, folder);
            
            console.log(`   ✅ Uploaded: ${result.url}`);

            // Update DB
            db.prepare('UPDATE bike_images SET local_path = ? WHERE id = ?')
              .run(result.url, record.id);
            
            // If this is the main image, update bikes table too
            if (record.is_main) {
                db.prepare('UPDATE bikes SET main_image = ? WHERE id = ?')
                  .run(result.url, record.bike_id);
            }

            console.log(`   💾 Updated DB`);
            stats.migrated++;
            stats.bytesUploaded += fileSize;

            if (DELETE_LOCAL) {
                fs.unlinkSync(fullPath);
                console.log(`   🗑️ Deleted local file`);
            }

        } catch (error) {
            console.error(`   ❌ Upload failed: ${error.message}`);
            stats.failed++;
            stats.errors.push(`${record.local_path} (${error.message})`);
        }
    }

    const sizeMB = (stats.bytesUploaded / (1024 * 1024)).toFixed(2);

    console.log(`\n═══════════════════════════════════════`);
    console.log(` MIGRATION SUMMARY`);
    console.log(`═══════════════════════════════════════`);
    console.log(` Total files: ${stats.total}`);
    console.log(` Successfully migrated: ${stats.migrated} (${((stats.migrated/stats.total)*100).toFixed(1)}%)`);
    console.log(` Failed: ${stats.failed} (${((stats.failed/stats.total)*100).toFixed(1)}%)`);
    if (stats.errors.length > 0) {
        console.log(`\n Errors:`);
        stats.errors.slice(0, 10).forEach(e => console.log(`   - ${e}`));
        if (stats.errors.length > 10) console.log(`   ... and ${stats.errors.length - 10} more`);
    }
    console.log(`\n Total uploaded: ${sizeMB} MB`);
    
    if (DRY_RUN) {
        console.log(`\n⚠️ This was a DRY RUN. No changes were made.`);
        console.log(`Run without --dry-run to execute.`);
    }
}

migratePhotos();
