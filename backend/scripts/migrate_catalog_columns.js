
const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function migrate() {
    console.log('🚀 Starting Catalog Columns Migration...');
    
    const columnsToAdd = [
        { name: 'sub_category', type: 'TEXT' },
        { name: 'discipline', type: 'TEXT' },
        { name: 'wheel_size', type: 'TEXT' }
    ];

    for (const col of columnsToAdd) {
        try {
            console.log(`Checking column: ${col.name}...`);
            // Try to add the column. If it exists, SQLite will throw an error which we catch.
            await db.query(`ALTER TABLE bikes ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ Added column: ${col.name}`);
        } catch (error) {
            if (error.message && error.message.includes('duplicate column name')) {
                console.log(`ℹ️ Column ${col.name} already exists. Skipping.`);
            } else {
                console.error(`❌ Error adding column ${col.name}:`, error.message);
            }
        }
    }
    
    console.log('✨ Migration Complete!');
}

migrate().catch(console.error);
