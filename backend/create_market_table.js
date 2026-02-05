const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function createMarketTable() {
    const dbPath = path.join(__dirname, 'database/eubike.db');
    console.log(`Opening database at ${dbPath}...`);

    try {
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log('Database opened. Creating market_history table...');

        await db.exec(`
            CREATE TABLE IF NOT EXISTS market_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT,
                brand TEXT,
                year INTEGER,
                frame_material TEXT,
                wheel_size TEXT,
                price_eur REAL,
                condition TEXT,
                scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                source_url TEXT UNIQUE
            );
        `);

        console.log('Creating indexes...');
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_market_model ON market_history(model_name);`);
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_market_brand ON market_history(brand);`);

        console.log('✅ market_history table created successfully.');
        await db.close();

    } catch (error) {
        console.error('❌ Error creating table:', error);
    }
}

createMarketTable();
