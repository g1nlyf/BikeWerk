const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(DB_PATH);

console.log('🔧 CLEANING UP DUPLICATES...');

try {
    // 1. Find duplicates
    const duplicates = db.prepare(`
        SELECT source_platform, source_ad_id, COUNT(*) as count 
        FROM bikes 
        WHERE source_ad_id IS NOT NULL AND TRIM(source_ad_id) != ''
        GROUP BY source_platform, source_ad_id 
        HAVING count > 1
    `).all();

    console.log(`   🔍 Found ${duplicates.length} sets of duplicates`);

    if (duplicates.length === 0) {
        console.log('   ✅ No duplicates found');
        db.close();
        process.exit(0);
    }

    let deletedCount = 0;
    const deleteStmt = db.prepare('DELETE FROM bikes WHERE id = ?');

    for (const dup of duplicates) {
        // Get all bikes for this duplicate set
        const bikes = db.prepare(`
            SELECT id, quality_score, unified_data, created_at 
            FROM bikes 
            WHERE source_platform = ? AND source_ad_id = ?
        `).all(dup.source_platform, dup.source_ad_id);

        console.log(`   Processing duplicate set: ${dup.source_platform} / ${dup.source_ad_id} (${bikes.length} records)`);

        // Sort to find the best one
        bikes.sort((a, b) => {
            // 1. Quality Score DESC
            const qa = a.quality_score || 0;
            const qb = b.quality_score || 0;
            if (qa !== qb) return qb - qa;

            // 2. Completeness (approximate by unified_data length) DESC
            const ca = a.unified_data ? a.unified_data.length : 0;
            const cb = b.unified_data ? b.unified_data.length : 0;
            if (ca !== cb) return cb - ca;

            // 3. Created At DESC (newer is better)
            const ta = new Date(a.created_at).getTime();
            const tb = new Date(b.created_at).getTime();
            return tb - ta;
        });

        // The first one is the winner
        const winner = bikes[0];
        const losers = bikes.slice(1);

        console.log(`      🏆 Winner: ID ${winner.id} (QS: ${winner.quality_score})`);
        
        for (const loser of losers) {
            console.log(`      🗑️ Deleting ID ${loser.id}`);
            deleteStmt.run(loser.id);
            deletedCount++;
        }
    }

    console.log(`   ✅ Deleted ${deletedCount} duplicate records`);

} catch (e) {
    console.error('   ❌ Error during cleanup:', e.message);
    process.exit(1);
}

db.close();
console.log('✨ Done');
