const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function migrate() {
    console.log('🔄 Applying Source URL Migration...');
    
    // Check bikes for source_url column
    try {
        await db.query(`ALTER TABLE bikes ADD COLUMN source_url TEXT`);
        console.log('✅ Added column: source_url to bikes');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('⚠️ Column source_url already exists in bikes.');
        } else {
            console.error('❌ Error adding source_url to bikes:', e.message);
        }
    }
    
    console.log('✅ Migration complete.');
    process.exit(0);
}

migrate();
