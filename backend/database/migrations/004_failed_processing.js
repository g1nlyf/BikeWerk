const { db } = require('../../src/js/mysql-config');

async function up() {
    console.log('🔄 Running migration: 004_failed_processing.js');
    
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS failed_bikes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL UNIQUE,
                raw_data TEXT NOT NULL,
                error_message TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'retrying', 'resolved', 'discarded')),
                attempts INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_retry DATETIME
            );
        `);
        
        await db.query(`CREATE INDEX IF NOT EXISTS idx_failed_status ON failed_bikes(status);`);
        
        console.log('✅ Migration 004_failed_processing passed');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    up().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { up };
