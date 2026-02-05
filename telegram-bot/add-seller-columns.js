const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'database', 'eubike.db');

console.log(`📂 Opening database: ${dbPath}`);
const db = new sqlite3.Database(dbPath);

const columnsToAdd = [
    { name: 'seller_name', type: 'TEXT' },
    { name: 'seller_type', type: 'TEXT' },
    { name: 'seller_member_since', type: 'TEXT' },
    { name: 'seller_badges_json', type: 'TEXT' },
    { name: 'sub_category', type: 'TEXT' },
    { name: 'source_domain', type: 'TEXT' },
    { name: 'source_platform_type', type: 'TEXT' },
    { name: 'classification_confidence', type: 'REAL' },
    { name: 'needs_review', type: 'INTEGER DEFAULT 0' },
    { name: 'source_ad_id', type: 'TEXT' }
];

function runQuery(query) {
    return new Promise((resolve, reject) => {
        db.run(query, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function migrate() {
    for (const col of columnsToAdd) {
        try {
            await runQuery(`ALTER TABLE bikes ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ Added column: ${col.name}`);
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log(`ℹ️ Column already exists: ${col.name}`);
            } else {
                console.error(`❌ Error adding column ${col.name}:`, error.message);
            }
        }
    }
    console.log('🎉 Migration completed!');
    db.close();
}

migrate().catch(console.error);
