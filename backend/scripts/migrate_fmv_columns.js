const { DatabaseManager } = require('../src/js/mysql-config');
const dbManager = new DatabaseManager();

async function migrate() {
    console.log('🚀 Starting FMV Columns Migration...');
    await dbManager.initialize();
    const db = dbManager.db; // Access raw db instance (sqlite3/sqlite)

    const columnsToAdd = [
        { name: 'fmv_confidence', type: 'REAL' },
        { name: 'market_comparison', type: 'TEXT' },
        { name: 'optimal_price', type: 'REAL' },
        { name: 'days_on_market', type: 'INTEGER DEFAULT 0' }
    ];

    for (const col of columnsToAdd) {
        try {
            console.log(`   👉 Adding column: ${col.name}...`);
            await db.run(`ALTER TABLE bikes ADD COLUMN ${col.name} ${col.type}`);
            console.log(`   ✅ Added ${col.name}`);
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log(`   ⚠️ Column ${col.name} already exists. Skipping.`);
            } else {
                console.error(`   ❌ Failed to add ${col.name}: ${e.message}`);
            }
        }
    }

    console.log('🏁 Migration Complete.');
}

migrate().catch(console.error);
