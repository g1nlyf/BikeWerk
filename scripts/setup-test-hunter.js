const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(DB_PATH);

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function setup() {
    console.log('🧪 Setting up test data for Autonomous Hunter...');
    
    // 1. Clear market_history for test brand
    await runQuery('DELETE FROM market_history WHERE brand = ? AND model_name LIKE ?', ['Canyon', '%Grand Canyon 5%']);
    
    // 2. Insert 10 history records (FMV ~ 1000€)
    const basePrice = 1000;
    for (let i = 0; i < 10; i++) {
        await runQuery(`
            INSERT INTO market_history (brand, model_name, price_eur, source_url, scraped_at)
            VALUES (?, ?, ?, ?, ?)
        `, ['Canyon', 'Grand Canyon 5', basePrice + (Math.random() * 200 - 100), `http://fake.url/${i}`, new Date().toISOString()]);
    }
    console.log('✅ Inserted 10 history records.');

    // 3. Insert the Target "Gem" (680€)
    const targetUrl = 'https://www.kleinanzeigen.de/s-anzeige/canyon-mountainbike-grand-canyon-5-groesse-l-aus-2024/3285182014-217-2570';
    
    // Ensure it's not in bikes table (delete if exists)
    await runQuery('DELETE FROM bikes WHERE original_url = ?', [targetUrl]);
    await runQuery('DELETE FROM market_history WHERE source_url = ?', [targetUrl]);

    await runQuery(`
        INSERT INTO market_history (brand, model_name, price_eur, source_url, scraped_at)
        VALUES (?, ?, ?, ?, ?)
    `, ['Canyon', 'Grand Canyon 5', 680, targetUrl, new Date().toISOString()]);
    
    console.log('✅ Inserted target candidate (680€).');
    console.log('👉 Now run: node scripts/autonomous-hunter.js');
}

setup().then(() => db.close());
