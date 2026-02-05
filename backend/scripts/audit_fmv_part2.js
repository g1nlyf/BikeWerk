
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new sqlite3.Database(dbPath);

const TARGET_BRANDS = [
    'Santa Cruz', 'YT', 'Pivot', 'Specialized', 'Canyon', 'Commencal', 
    'Trek', 'Giant', 'Cube', 'Scott', 'Ibis', 'Yeti', 'Evil', 'Transition', 
    'Norco', 'Rocky Mountain', 'Devinci', 'Intense', 'Mondraker', 
    'Propain', 'Radon', 'Rose', 'Ghost', 'Focus', 'Nicolai'
];

const runQuery = (label, sql, params = []) => {
    return new Promise((resolve) => {
        console.log(`\n🔹 ${label}`);
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error(`❌ Error: ${err.message}`);
                resolve([]);
            } else {
                if (rows.length > 0) console.table(rows);
                else console.log('No data.');
                resolve(rows);
            }
        });
    });
};

async function runAuditPart2() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 FMV AUDIT PART 2: QUALITY & PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════');

    // 3.1 FMV Coverage by Target Brands
    console.log('\n🔍 3.1 FMV Coverage by Target Brands');
    const placeholders = TARGET_BRANDS.map(() => '?').join(',');
    await runQuery('Target Brands Stats', `
        SELECT 
            brand, 
            COUNT(*) as records, 
            COUNT(DISTINCT model) as unique_models, 
            ROUND(AVG(price_eur), 0) as avg_price, 
            COUNT(CASE WHEN year IS NOT NULL THEN 1 END) as records_with_year,
            ROUND(COUNT(CASE WHEN year IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as year_pct,
            MIN(year) as oldest_year, 
            MAX(year) as newest_year 
        FROM market_history 
        WHERE brand IN (${placeholders}) 
        GROUP BY brand
        ORDER BY records DESC
    `, TARGET_BRANDS);

    // 3.2 Variance Analysis
    console.log('\n🔍 3.2 Variance Analysis (Top Models)');
    const modelsToCheck = [
        { brand: 'Canyon', model: 'Spectral' },
        { brand: 'YT', model: 'Capra' },
        { brand: 'Specialized', model: 'Levo' }, // Checking if "Levo" exists or full name
        { brand: 'Santa Cruz', model: 'Megatower' }
    ];

    for (const m of modelsToCheck) {
        // Use LIKE for model to catch variations
        await runQuery(`Variance: ${m.brand} ${m.model}`, `
            SELECT brand, model, year, 
                COUNT(*) as cnt, 
                ROUND(AVG(price_eur), 0) as avg, 
                MIN(price_eur) as min, 
                MAX(price_eur) as max, 
                MAX(price_eur) - MIN(price_eur) as spread, 
                ROUND((MAX(price_eur) - MIN(price_eur)) * 100.0 / AVG(price_eur), 1) as spread_pct 
            FROM market_history 
            WHERE brand = ? AND model LIKE ? 
            GROUP BY brand, model, year 
            HAVING cnt >= 2 
            ORDER BY year DESC
        `, [m.brand, `%${m.model}%`]);
    }

    // 4.1 Collection Rate (Last 24h)
    // Note: Using 'scraped_at' instead of 'created_at' based on schema migration
    console.log('\n🔍 4.1 Collection Rate');
    await runQuery('Total Last 24h', `
        SELECT COUNT(*) as last_24h 
        FROM market_history 
        WHERE scraped_at > datetime('now', '-24 hours')
    `);

    await runQuery('Hourly Rate (Last 24h)', `
        SELECT strftime('%H', scraped_at) as hour, COUNT(*) as cnt 
        FROM market_history 
        WHERE scraped_at > datetime('now', '-24 hours') 
        GROUP BY hour 
        ORDER BY hour
    `);

    db.close();
}

runAuditPart2();
