const { db } = require('../../src/js/mysql-config');

async function up() {
    console.log('🔄 Running migration: 005_fix_failed_bikes.js');
    
    try {
        await db.query('DROP TABLE IF EXISTS failed_bikes');
        
        await db.query(`
            CREATE TABLE failed_bikes (
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
        
        console.log('✅ Migration 005_fix_failed_bikes passed');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

if (require.main === module) {
    up().catch(console.error);
}

module.exports = { up };
