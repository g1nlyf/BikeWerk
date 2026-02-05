const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function migrate() {
    console.log('🔄 Applying Refill Queue Migration...');
    
    // Create refill_queue table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS refill_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                model TEXT NOT NULL,
                tier INTEGER,
                reason TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME
            )
        `);
        console.log('✅ Created table: refill_queue');
    } catch (e) {
        console.error('❌ Error creating refill_queue:', e.message);
    }
    
    console.log('✅ Migration complete.');
    process.exit(0);
}

migrate();
