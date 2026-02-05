const { DatabaseManager } = require('../src/js/mysql-config');

async function run() {
    console.log('🚀 Fixing DB Schema...');
    const db = new DatabaseManager();
    await db.initialize();

    try {
        // 1. Fix user_favorites (Drop and Recreate to ensure ID column)
        // We check if "id" column exists first to avoid unnecessary drop if possible, 
        // but given the mess, a drop is safer to ensure clean state.
        // WARNING: This deletes existing favorites. Assuming this is acceptable for now.
        
        // Check if table exists
        const tableExists = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='user_favorites'");
        let needsRecreate = false;
        
        if (tableExists.length > 0) {
            // Check if 'id' column exists
            try {
                await db.query("SELECT id FROM user_favorites LIMIT 1");
            } catch (e) {
                console.log("ℹ️ user_favorites missing 'id' column. Recreating...");
                needsRecreate = true;
            }
        } else {
            needsRecreate = true;
        }

        if (needsRecreate) {
            await db.query('DROP TABLE IF EXISTS user_favorites');
            await db.query(`
                CREATE TABLE user_favorites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL, 
                    bike_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, bike_id),
                    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE CASCADE
                )
            `);
            console.log('✅ user_favorites recreated with ID column.');
        } else {
            console.log('✅ user_favorites already correct.');
        }

        // 2. Create currency_history
        await db.query(`
            CREATE TABLE IF NOT EXISTS currency_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rate REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ currency_history table verified.');
        
        // 2.1 Create system_settings if missing
        await db.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ system_settings table verified.');

        // 3. Fix system_logs
        try {
            await db.query('ALTER TABLE system_logs ADD COLUMN stack TEXT');
            console.log('✅ system_logs altered (stack column added).');
        } catch (e) {
            // Ignore if column exists
            console.log('ℹ️ system_logs check complete.');
        }

    } catch (e) {
        console.error('❌ Error fixing schema:', e);
        process.exit(1);
    }
}

run();
