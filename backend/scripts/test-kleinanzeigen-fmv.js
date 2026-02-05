const FMVOrchestrator = require('../src/services/FMVOrchestrator');
const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

(async () => {
    try {
        console.log('🧪 Starting Kleinanzeigen FMV Integration Test');
        
        // YT Capra 2023 - All 3 sources
        await FMVOrchestrator.runTestCollection('YT', 'Capra', [2023]);

        console.log('\n📊 Verifying DB Records...');
        const rows = await db.query(`
            SELECT source_platform, count(*) as count, avg(price_eur) as avg_price 
            FROM market_history 
            WHERE brand = 'YT' AND model = 'Capra' AND year = 2023
            GROUP BY source_platform
        `);
        console.table(rows);

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
})();