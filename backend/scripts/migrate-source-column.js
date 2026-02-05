const DatabaseManager = require('../database/db-manager');

(async () => {
    console.log('🔄 MIGRATION: Adding source column to market_history...');

    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();

    try {
        const tableInfo = db.prepare('PRAGMA table_info(market_history)').all();
        const hasSource = tableInfo.some(col => col.name === 'source');

        if (!hasSource) {
            console.log('   ➕ Adding column: source (TEXT)');
            db.prepare('ALTER TABLE market_history ADD COLUMN source TEXT').run();
            
            // Backfill
            console.log('   🔄 Backfilling source data...');
            const updateBuycycle = db.prepare("UPDATE market_history SET source = 'buycycle' WHERE source_url LIKE '%buycycle.com%'").run();
            console.log(`     - Buycycle: ${updateBuycycle.changes} rows updated`);
            
            const updateKleinanzeigen = db.prepare("UPDATE market_history SET source = 'kleinanzeigen' WHERE source_url LIKE '%kleinanzeigen.de%'").run();
            console.log(`     - Kleinanzeigen: ${updateKleinanzeigen.changes} rows updated`);
            
            // Default others
            const updateOther = db.prepare("UPDATE market_history SET source = 'other' WHERE source IS NULL").run();
            console.log(`     - Other: ${updateOther.changes} rows updated`);
            
        } else {
            console.log('   ✅ Column "source" already exists.');
        }

    } catch (error) {
        console.error('   ❌ Migration failed:', error.message);
    } finally {
        console.log('🏁 Migration complete.');
        dbManager.close();
    }
})();
