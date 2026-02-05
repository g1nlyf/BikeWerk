
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new sqlite3.Database(dbPath);

console.log('═══════════════════════════════════════════════════════════');
console.log('📊 DATABASE FORENSICS REPORT');
console.log(`Checking DB: ${dbPath}`);
console.log('═══════════════════════════════════════════════════════════');

const runQuery = (label, sql) => {
    return new Promise((resolve, reject) => {
        console.log(`\n🔹 ${label}`);
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error(`❌ Error: ${err.message}`);
                resolve([]);
            } else {
                if (rows.length === 1 && Object.keys(rows[0]).length > 1) {
                    console.table(rows[0]);
                } else if (rows.length > 0) {
                    console.table(rows);
                } else {
                    console.log('No data found.');
                }
                resolve(rows);
            }
        });
    });
};

async function runAudit() {
    // 1.1 General Stats
    await runQuery('1.1 General Stats', `
        SELECT 
            COUNT(*) as total_records, 
            COUNT(DISTINCT brand) as unique_brands, 
            COUNT(DISTINCT model) as unique_models, 
            MIN(scraped_at) as first_record, 
            MAX(scraped_at) as last_record 
        FROM market_history
    `);

    // 1.2 Top 20 Brands
    await runQuery('1.2 Top 20 Brands', `
        SELECT brand, COUNT(*) as cnt, ROUND(AVG(price_eur), 0) as avg_price 
        FROM market_history 
        GROUP BY brand 
        ORDER BY cnt DESC 
        LIMIT 20
    `);

    // 1.3 Data Completeness
    await runQuery('1.3 Data Completeness', `
        SELECT 
            COUNT(*) as total, 
            COUNT(CASE WHEN brand IS NOT NULL AND brand != '' THEN 1 END) as has_brand, 
            COUNT(CASE WHEN model IS NOT NULL AND model != '' THEN 1 END) as has_model, 
            COUNT(CASE WHEN year IS NOT NULL THEN 1 END) as has_year, 
            COUNT(CASE WHEN frame_size IS NOT NULL THEN 1 END) as has_frame_size, 
            COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as has_category, 
            
            ROUND(COUNT(CASE WHEN brand IS NOT NULL AND brand != '' THEN 1 END) * 100.0 / COUNT(*), 1) as brand_pct, 
            ROUND(COUNT(CASE WHEN model IS NOT NULL AND model != '' THEN 1 END) * 100.0 / COUNT(*), 1) as model_pct, 
            ROUND(COUNT(CASE WHEN year IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as year_pct 
        FROM market_history
    `);

    // 1.4 Price Distribution
    await runQuery('1.4 Price Distribution', `
        SELECT 
            MIN(price_eur) as min_price, 
            MAX(price_eur) as max_price, 
            ROUND(AVG(price_eur), 0) as avg_price, 
            
            COUNT(CASE WHEN price_eur < 100 THEN 1 END) as under_100, 
            COUNT(CASE WHEN price_eur BETWEEN 100 AND 500 THEN 1 END) as range_100_500, 
            COUNT(CASE WHEN price_eur BETWEEN 500 AND 1500 THEN 1 END) as range_500_1500, 
            COUNT(CASE WHEN price_eur BETWEEN 1500 AND 3000 THEN 1 END) as range_1500_3000, 
            COUNT(CASE WHEN price_eur BETWEEN 3000 AND 6000 THEN 1 END) as range_3000_6000, 
            COUNT(CASE WHEN price_eur > 6000 THEN 1 END) as over_6000 
        FROM market_history
    `);

    // 1.5 Year Distribution
    await runQuery('1.5 Year Distribution', `
        SELECT year, COUNT(*) as cnt 
        FROM market_history 
        WHERE year IS NOT NULL 
        GROUP BY year 
        ORDER BY year DESC
    `);

    // 1.6 Garbage Examples
    await runQuery('1.6 Garbage Data Examples', `
        SELECT id, brand, model, year, price_eur, category, source_url 
        FROM market_history 
        WHERE 
            brand IS NULL 
            OR brand IN ('MTB', 'Bike', 'Fahrrad', 'Generic', 'Unbranded', '') 
            OR model IS NULL 
            OR model = '' 
            OR price_eur < 50 
            OR price_eur > 15000 
        LIMIT 20
    `);

    // 1.7 Duplicates
    await runQuery('1.7 Duplicates', `
        SELECT source_url, COUNT(*) as duplicates 
        FROM market_history 
        WHERE source_url IS NOT NULL 
        GROUP BY source_url 
        HAVING COUNT(*) > 1 
        ORDER BY duplicates DESC 
        LIMIT 10
    `);

    // 1.8 Export Sample
    const sample = await new Promise((resolve) => {
        db.all(`
            SELECT brand, model, year, price_eur, frame_size, category, condition, scraped_at, source_url 
            FROM market_history 
            ORDER BY scraped_at DESC 
            LIMIT 100
        `, [], (err, rows) => {
            if (err) resolve([]);
            else resolve(rows);
        });
    });

    if (sample.length > 0) {
        fs.writeFileSync(path.resolve(__dirname, 'fmv_sample.json'), JSON.stringify(sample, null, 2));
        console.log(`\n✅ Saved 100 sample records to fmv_sample.json`);
    }

    db.close();
}

runAudit();
