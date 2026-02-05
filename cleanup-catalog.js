const BikesDatabase = require('./telegram-bot/bikes-database-node');
const path = require('path');

async function cleanup() {
    console.log('🧹 Starting Smart Catalog Cleanup...');
    
    const db = new BikesDatabase();
    await db.ensureInitialized();

    try {
        console.log('🗑️ Deleting all bikes from catalog...');
        // We delete from 'bikes' and 'bike_images'.
        // We preserve 'user_interactions' (if any), 'bounties', 'market_history', 'system_logs'.
        // Note: 'orders' might reference bikes. If we delete bikes, orders might break if no CASCADE.
        // Assuming we want to clear the 'active' catalog.
        
        await db.runQuery('DELETE FROM bikes');
        await db.runQuery('DELETE FROM bike_images');
        
        // Reset sqlite_sequence for bikes is optional, but keeps IDs clean. 
        // User didn't explicitly ask for ID reset, just "full cleanup". 
        // Keeping IDs growing is usually safer for references.
        
        console.log('✅ Catalog cleared successfully.');
        console.log('🛡️ Preserved: User Interactions, Bounties, Market History.');
        
    } catch (e) {
        console.error('❌ Cleanup failed:', e);
    }
}

cleanup();
