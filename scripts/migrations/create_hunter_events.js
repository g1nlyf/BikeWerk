const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../backend/database/eubike.db');
console.log(`[Migration] Using DB Path: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log('📦 Creating hunter_events table...');
    
    db.run(`
        CREATE TABLE IF NOT EXISTS hunter_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- INFO, ERROR, WARNING, SUCCESS, REJECTION
            source TEXT DEFAULT 'UnifiedHunter',
            details TEXT, -- JSON or simple text
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating table:', err.message);
        } else {
            console.log('✅ Table hunter_events created/verified.');
        }
    });

    // Create index on created_at for faster dashboard queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_hunter_events_created_at ON hunter_events(created_at)`, (err) => {
        if (!err) console.log('✅ Index created on created_at');
    });
});

db.close();
