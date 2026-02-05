const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function migrate() {
    console.log('🔄 Applying Source Tracking Migration...');
    
    // Check market_history for source column
    try {
        await db.query(`ALTER TABLE market_history ADD COLUMN source TEXT DEFAULT 'kleinanzeigen'`);
        console.log('✅ Added column: source to market_history');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('⚠️ Column source already exists in market_history.');
        } else {
            console.error('❌ Error adding source to market_history:', e.message);
        }
    }
    
    // Check bikes for source column
    try {
        await db.query(`ALTER TABLE bikes ADD COLUMN source TEXT DEFAULT 'kleinanzeigen'`);
        console.log('✅ Added column: source to bikes');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('⚠️ Column source already exists in bikes.');
        } else {
            console.error('❌ Error adding source to bikes:', e.message);
        }
    }

    // Check bikes for external_id (useful for tracking source ID)
    try {
        await db.query(`ALTER TABLE bikes ADD COLUMN external_id TEXT`);
        console.log('✅ Added column: external_id to bikes');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('⚠️ Column external_id already exists in bikes.');
        }
    }
    
    console.log('✅ Migration complete.');
    process.exit(0);
}

migrate();
