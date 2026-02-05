const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
console.log(`📂 Opening DB at: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH);

const columnsToAdd = [
    { name: 'ai_specs', type: 'TEXT' },
    { name: 'description_ru', type: 'TEXT' },
    { name: 'hotness_score', type: 'REAL DEFAULT 0' },
    { name: 'views_count', type: 'INTEGER DEFAULT 0' },
    { name: 'publish_date', type: 'DATETIME' },
    { name: 'confidence_score', type: 'REAL' },
    { name: 'salvage_value', type: 'REAL' },
    { name: 'is_salvage_gem', type: 'INTEGER DEFAULT 0' },
    { name: 'kill_reason', type: 'TEXT' }
];

db.serialize(() => {
    columnsToAdd.forEach(col => {
        const query = `ALTER TABLE bikes ADD COLUMN ${col.name} ${col.type}`;
        db.run(query, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`✅ Column ${col.name} already exists.`);
                } else {
                    console.error(`❌ Error adding column ${col.name}:`, err.message);
                }
            } else {
                console.log(`✨ Added column ${col.name}`);
            }
        });
    });
});

db.close(() => {
    console.log('🏁 Schema update attempt finished.');
});
