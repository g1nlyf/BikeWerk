const { DatabaseManager } = require('../src/js/mysql-config');

async function migrate() {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    console.log('🔄 Checking for `data` column in `bikes` table...');
    
    try {
        const columns = await dbManager.db.query('PRAGMA table_info(bikes)');
        const hasData = columns.some(c => c.name === 'data');
        
        if (!hasData) {
            console.log('   ➕ Adding `data` column...');
            await dbManager.db.query('ALTER TABLE bikes ADD COLUMN data TEXT');
            console.log('   ✅ Column added.');
        } else {
            console.log('   ℹ️ Column `data` already exists.');
        }
        
    } catch (e) {
        console.error('   ❌ Migration failed:', e.message);
    }
}

migrate();