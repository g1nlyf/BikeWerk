const { DatabaseManager } = require('../src/js/mysql-config');

(async () => {
    const db = new DatabaseManager();
    await db.initialize();
    console.log('🔌 DB Connected for V5 Schema Update');

    // 1. Create bike_specs table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS bike_specs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bike_id INTEGER NOT NULL,
                spec_label TEXT NOT NULL,
                spec_value TEXT,
                spec_order INTEGER DEFAULT 0,
                FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created table: bike_specs');
        
        // Index
        await db.query('CREATE INDEX IF NOT EXISTS idx_bike_specs_bike_id ON bike_specs(bike_id)');
    } catch (e) {
        console.error('❌ Error creating bike_specs:', e.message);
    }

    // 2. Add is_new column to bikes
    try {
        await db.query('ALTER TABLE bikes ADD COLUMN is_new INTEGER DEFAULT 0');
        console.log('✅ Added column: bikes.is_new');
    } catch (e) {
        console.log('ℹ️ bikes.is_new might exist');
    }

    console.log('🏁 Schema V5 Update Complete');
})();
