const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function migrate() {
    console.log('🔄 Applying Freshness Tracking Migration...');
    
    const columns = [
        { name: 'last_checked', type: 'DATETIME' },
        { name: 'deactivation_reason', type: 'TEXT' },
        { name: 'deactivated_at', type: 'DATETIME' }
    ];

    for (const col of columns) {
        try {
            await db.query(`ALTER TABLE bikes ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ Added column: ${col.name}`);
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log(`⚠️ Column ${col.name} already exists.`);
            } else {
                console.error(`❌ Error adding ${col.name}:`, e.message);
            }
        }
    }
    
    console.log('✅ Migration complete.');
    process.exit(0);
}

migrate();
