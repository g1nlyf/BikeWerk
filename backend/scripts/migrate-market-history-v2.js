const DatabaseManager = require('../database/db-manager');

(async () => {
    console.log('🔄 MIGRATION: Adding year and frame_size to market_history...');

    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();

    try {
        // Check if columns exist
        const tableInfo = db.prepare('PRAGMA table_info(market_history)').all();
        const hasYear = tableInfo.some(col => col.name === 'year');
        const hasFrameSize = tableInfo.some(col => col.name === 'frame_size');

        if (!hasYear) {
            console.log('   ➕ Adding column: year (INTEGER)');
            db.prepare('ALTER TABLE market_history ADD COLUMN year INTEGER').run();
        } else {
            console.log('   ✅ Column "year" already exists.');
        }

        if (!hasFrameSize) {
            console.log('   ➕ Adding column: frame_size (TEXT)');
            db.prepare('ALTER TABLE market_history ADD COLUMN frame_size TEXT').run();
        } else {
            console.log('   ✅ Column "frame_size" already exists.');
        }

        // Create Index
        console.log('   🔨 Creating index: idx_market_year_size');
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_market_year_size 
            ON market_history(brand, model, year, frame_size)
        `).run();
        console.log('   ✅ Index created/verified.');

    } catch (error) {
        console.error('   ❌ Migration failed:', error.message);
    } finally {
        console.log('🏁 Migration complete.');
        dbManager.close();
    }
})();
