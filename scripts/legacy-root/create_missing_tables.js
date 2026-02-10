const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/database/eubike.db');
console.log('Opening DB:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

async function migrate() {
    try {
        console.log('Creating transactions table...');
        await run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'EUR',
                type TEXT DEFAULT 'payment',
                method TEXT,
                description TEXT,
                status TEXT DEFAULT 'completed',
                transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Creating shipments table...');
        await run(`
            CREATE TABLE IF NOT EXISTS shipments (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                provider TEXT,
                carrier TEXT,
                tracking_number TEXT,
                estimated_delivery_date DATETIME,
                warehouse_received INTEGER DEFAULT 0,
                warehouse_photos_received INTEGER DEFAULT 0,
                client_received INTEGER DEFAULT 0,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Creating order_status_events table...');
        await run(`
            CREATE TABLE IF NOT EXISTS order_status_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                old_status TEXT,
                new_status TEXT,
                change_notes TEXT,
                changed_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        db.close();
    }
}

migrate();
