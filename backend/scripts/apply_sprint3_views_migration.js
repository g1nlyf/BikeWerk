const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function migrate() {
    console.log('🔄 Applying Sprint 3 Views Migration...');
    try {
        await db.query(`ALTER TABLE bikes ADD COLUMN views INTEGER DEFAULT 0`);
        console.log('✅ Added column: views');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('⚠️ Column views already exists.');
        } else {
            console.error('❌ Error adding views:', e.message);
        }
    }
    console.log('✅ Migration complete.');
    process.exit(0);
}

migrate();
