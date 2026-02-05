const { DatabaseManager } = require('../src/js/mysql-config');

async function run() {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();

    console.log('Creating market_benchmarks table...');
    await dbManager.query(`
        CREATE TABLE IF NOT EXISTS market_benchmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_name TEXT NOT NULL,
            avg_eu_price REAL NOT NULL,
            avg_rf_price REAL NOT NULL,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log('Seeding market_benchmarks data...');
    const seeds = [
        { model: 'Specialized Tarmac SL7', eu: 4200, rf: 6500 },
        { model: 'Canyon Ultimate CF SLX', eu: 3800, rf: 5900 },
        { model: 'Scott Addict RC', eu: 4500, rf: 7200 },
        { model: 'Trek Emonda SLR', eu: 5100, rf: 7800 },
        { model: 'Pinarello Dogma F12', eu: 6800, rf: 9500 }
    ];

    for (const s of seeds) {
        // Check if exists
        const exists = await dbManager.query('SELECT id FROM market_benchmarks WHERE model_name = ?', [s.model]);
        if (exists.length > 0) {
            await dbManager.query(`
                UPDATE market_benchmarks 
                SET avg_eu_price = ?, avg_rf_price = ?, last_updated = datetime('now')
                WHERE model_name = ?
            `, [s.eu, s.rf, s.model]);
        } else {
            await dbManager.query(`
                INSERT INTO market_benchmarks (model_name, avg_eu_price, avg_rf_price)
                VALUES (?, ?, ?)
            `, [s.model, s.eu, s.rf]);
        }
    }

    console.log('✅ Market Benchmarks initialized.');
}

run().catch(console.error);
