const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');
const IMAGES_DIR = path.resolve(__dirname, '../public/images/bikes');

function main() {
    console.log('🔍 DATABASE INTEGRITY CHECK');
    console.log('');

    if (!fs.existsSync(DB_PATH)) {
        console.log('❌ Database file not found');
        process.exit(1);
    }

    const db = new Database(DB_PATH);

    console.log('CHECKING BIKES TABLE...');
    const bikes = db.prepare('SELECT * FROM bikes').all();
    console.log(`   ✅ Total bikes: ${bikes.length}`);

    const unifiedMissing = bikes.filter(b => !b.unified_data).length;
    if (unifiedMissing === 0) console.log('   ✅ All bikes have unified_data');
    else console.log(`   ❌ ${unifiedMissing} bikes missing unified_data`);

    const imageMissing = bikes.filter(b => !b.main_image).length;
    if (imageMissing === 0) console.log('   ✅ All bikes have main_image');
    else console.log(`   ⚠️  ${imageMissing} bikes missing main_image`);

    const qualityLow = bikes.filter(b => !b.quality_score || b.quality_score <= 0).length;
    if (qualityLow === 0) console.log('   ✅ All bikes have quality_score > 0');
    else console.log(`   ⚠️  ${qualityLow} bikes have quality_score <= 0`);

    // Check duplicate source_ad_id
    const duplicates = db.prepare(`
        SELECT source_platform, source_ad_id, COUNT(*) as count 
        FROM bikes 
        WHERE source_ad_id IS NOT NULL AND TRIM(source_ad_id) != ''
        GROUP BY source_platform, source_ad_id 
        HAVING count > 1
    `).all();
    if (duplicates.length === 0) console.log('   ✅ No duplicate source_ad_id found');
    else console.log(`   ❌ Found ${duplicates.length} duplicate source_ad_id entries`);

    const bikeIndexes = db.prepare(`PRAGMA index_list('bikes')`).all();
    const hasCreatedAtIndex = bikeIndexes.some(idx => idx.name === 'idx_bikes_created_at');
    if (hasCreatedAtIndex) console.log('   ✅ Index idx_bikes_created_at exists');
    else console.log('   ❌ Missing index idx_bikes_created_at');

    console.log('');
    console.log('CHECKING BIKE_IMAGES TABLE...');
    const images = db.prepare('SELECT * FROM bike_images').all();
    console.log(`   ✅ Total image records: ${images.length}`);

    const orphanImages = images.filter(img => !bikes.find(b => b.id === img.bike_id));
    if (orphanImages.length === 0) console.log('   ✅ All images linked to existing bikes (no orphans)');
    else console.log(`   ❌ ${orphanImages.length} orphaned image records`);

    const localPathImages = images.filter(img => img.local_path);
    const pctLocal = images.length > 0 ? Math.round(localPathImages.length / images.length * 100) : 0;
    console.log(`   ✅ ${localPathImages.length}/${images.length} images have local_path (${pctLocal}%)`);

    let missingFiles = 0;
    localPathImages.forEach(img => {
        // Assuming local_path starts with /images/bikes/...
        // We need to map it to filesystem
        const relPath = img.local_path.replace(/^\/images\/bikes\//, '');
        const fullPath = path.join(IMAGES_DIR, relPath);
        if (!fs.existsSync(fullPath)) missingFiles++;
    });

    if (missingFiles === 0) console.log(`   ✅ ${localPathImages.length}/${localPathImages.length} local files exist on disk (100%)`);
    else console.log(`   ⚠️  ${missingFiles} local files missing (will be re-downloaded on next retry script)`);

    console.log('');
    console.log('CHECKING FILE SYSTEM...');
    if (fs.existsSync(IMAGES_DIR)) {
        const dirs = fs.readdirSync(IMAGES_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
        console.log(`   ✅ Total bike folders: ${dirs.length}`);
        
        const orphanFolders = dirs.filter(d => {
            const match = d.name.match(/^id(\d+)$/);
            if (!match) return true;
            return !bikes.find(b => b.id === parseInt(match[1]));
        });

        if (orphanFolders.length === 0) console.log('   ✅ All folders correspond to existing bikes (no orphans)');
        else console.log(`   ❌ ${orphanFolders.length} orphaned folders found`);

        // Calculate size
        // Skipping detailed size calc for speed, just counting
        console.log(`   ✅ Average photos per bike: ${bikes.length > 0 ? (images.length / bikes.length).toFixed(1) : 0}`);
    } else {
        console.log('   ❌ Images directory not found');
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    const passed = unifiedMissing === 0 && duplicates.length === 0 && orphanImages.length === 0;
    console.log(`✅ DATABASE INTEGRITY: ${passed ? 'PASSED' : 'FAILED'}`);
    if (missingFiles > 0) console.log(`Minor issues: ${missingFiles} missing local files (recoverable)`);
    console.log('═══════════════════════════════════════');
    
    db.close();
}

main();
