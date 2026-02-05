const BikesDatabase = require('./bikes-database-node');
const SyncService = require('./SyncService');

async function testSync() {
    console.log('🧪 Testing SyncService...');
    
    const db = new BikesDatabase();
    await db.ensureInitialized();
    
    // Mock bot for notifications
    const mockBot = {
        telegram: {
            sendMessage: (chatId, text) => console.log(`[BOT Mock] To ${chatId}: ${text}`)
        }
    };

    const syncService = new SyncService(db, mockBot);

    // 1. Test Sync Hot
    console.log('\n--- Testing Sync (All Tier) ---');
    await syncService.syncBikes('all');

    // 2. Test Sanitizer
    console.log('\n--- Testing Sanitizer ---');
    await syncService.runSanitizer();

    console.log('\n✅ Sync Test Complete.');
}

testSync().catch(console.error);
