const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(DB_PATH);

console.log('🔧 APPLYING MISSING INDEXES...');

try {
    // Check if index exists
    const indexes = db.prepare("PRAGMA index_list('bikes')").all();
    const exists = indexes.some(idx => idx.name === 'idx_bikes_created_at');

    if (exists) {
        console.log('   ✅ Index idx_bikes_created_at already exists');
    } else {
        console.log('   ⏳ Creating index idx_bikes_created_at...');
        db.prepare("CREATE INDEX idx_bikes_created_at ON bikes(created_at DESC)").run();
        console.log('   ✅ Index created successfully');
    }

} catch (e) {
    console.error('   ❌ Error creating index:', e.message);
    process.exit(1);
}

db.close();
console.log('✨ Done');
