const { DatabaseManager } = require('../src/js/mysql-config');

(async () => {
    const db = new DatabaseManager();
    await db.initialize();
    console.log('🔌 DB Connected for V6 Schema Update');

    // 1. Drop user_favorites table (Schema mismatch fix)
    try {
        await db.query('DROP TABLE IF EXISTS user_favorites');
        console.log('🗑️ Dropped table: user_favorites');
    } catch (e) {
        console.error('❌ Error dropping user_favorites:', e.message);
    }

    // 2. Recreate user_favorites table with correct schema (with ID)
    try {
        await db.query(`
            CREATE TABLE user_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                bike_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created table: user_favorites (with ID)');
        
        // Index
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_favorites_user_bike ON user_favorites(user_id, bike_id)');
    } catch (e) {
        console.error('❌ Error creating user_favorites:', e.message);
    }

    console.log('🏁 Schema V6 Update Complete');
})();
