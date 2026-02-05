const FMVOrchestrator = require('../src/services/FMVOrchestrator');
const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

const MODELS = ['Tues', 'Capra', 'Jeffsy', 'Izzo', 'Decoy'];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

(async () => {
    try {
        console.log('🧹 Cleaning existing YT records from market_history...');
        await db.query("DELETE FROM market_history WHERE brand = 'YT'");
        console.log('✅ Cleaned.');

        for (const model of MODELS) {
            console.log(`\n🚲 Processing YT ${model}...`);
            await FMVOrchestrator.runTestCollection('YT', model, YEARS);
            
            // Extra pause between models
            console.log('💤 Model cooldown (5s)...');
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log('\n🎉 ALL YT COLLECTIONS COMPLETE');
        
        // Verify
        const stats = await db.query(`
            SELECT model, year, count(*) as count, avg(price_eur) as avg_price 
            FROM market_history 
            WHERE brand = 'YT'
            GROUP BY model, year
            ORDER BY model, year
        `);
        console.table(stats);

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
})();