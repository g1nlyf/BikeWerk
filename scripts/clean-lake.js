const BikesDatabase = require('../telegram-bot/bikes-database-node');
const db = new BikesDatabase();

async function cleanLake() {
    console.log('🧹 Cleaning up Lake (market_history)...');
    try {
        await db.ensureInitialized();
        
        // Check count before
        const before = await db.getQuery('SELECT COUNT(*) as c FROM market_history');
        console.log(`Current items in Lake: ${before.c}`);

        // Delete ALL items
        const result = await db.runQuery(`
            DELETE FROM market_history 
        `);
        
        console.log(`🗑️ Deleted ALL ${result.changes} items from Lake.`);

        // Check count after
        const after = await db.getQuery('SELECT COUNT(*) as c FROM market_history');
        console.log(`Remaining items in Lake: ${after.c}`);
        
    } catch (e) {
        console.error('Error cleaning lake:', e);
    }
}

cleanLake();
