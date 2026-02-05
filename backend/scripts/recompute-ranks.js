const { DatabaseManager } = require('../src/js/mysql-config');
const { calculateRank } = require('../src/js/ranking-service');

async function recomputeAll() {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    const db = dbManager.db;

    try {
        console.log('--- Starting Nightly Rank Recompute ---');
        const start = Date.now();

        // 1. Get all active bikes
        const bikes = await db.all('SELECT id, name FROM bikes WHERE is_active = 1');
        console.log(`Found ${bikes.length} active bikes.`);

        let updated = 0;
        let errors = 0;

        for (const bike of bikes) {
            try {
                // 2. Calculate Rank
                const result = await calculateRank(db, bike.id);
                
                // 3. Update DB
                if (result && result.rank !== undefined) {
                    await db.run(`
                        UPDATE bikes 
                        SET ranking_score = ?, rank = ?, rank_components = ?, rank_updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `, [result.rank, result.rank, result.components, bike.id]);
                    
                    // Optional: Log diagnostics for significant changes or low ranks
                    if (result.rank < 0.2 && (result.viewsDecayed > 0)) {
                         await db.run(`
                            INSERT INTO rank_diagnostics (bike_id, new_rank, reason, components) 
                            VALUES (?, ?, 'batch_low_rank', ?)
                         `, [bike.id, result.rank, result.components]);
                    }
                    updated++;
                }
            } catch (e) {
                console.error(`Error processing bike ${bike.id}:`, e);
                errors++;
            }
            
            if (updated % 50 === 0) process.stdout.write('.');
        }

        const duration = (Date.now() - start) / 1000;
        console.log(`\n\n--- Recompute Finished ---`);
        console.log(`Processed: ${bikes.length}`);
        console.log(`Updated: ${updated}`);
        console.log(`Errors: ${errors}`);
        console.log(`Duration: ${duration.toFixed(2)}s`);

    } catch (e) {
        console.error('Fatal error:', e);
    } finally {
        await dbManager.close();
    }
}


if (require.main === module) {
    recomputeAll();
}

module.exports = { recomputeAll };
