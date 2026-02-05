const { DatabaseManager } = require('../backend/src/js/mysql-config.js');

async function run() {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    console.log('Setting up market_history table...');
    const sql = `
    CREATE TABLE IF NOT EXISTS market_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_name TEXT,
        brand TEXT,
        price_eur REAL,
        source_url TEXT,
        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_market_history_scraped_at ON market_history(scraped_at);
    CREATE INDEX IF NOT EXISTS idx_market_history_brand ON market_history(brand);
    `;
    
    try {
        await dbManager.db.exec(sql);
        console.log('Table created.');
    } catch (e) {
        console.error('Error creating table:', e);
    }
}

run();
