
const FMVOrchestrator = require('../src/services/FMVOrchestrator');
const path = require('path');
const Database = require('better-sqlite3');

// Ensure DB exists
const DB_PATH = path.resolve(__dirname, '../database/eubike.db');

async function runTest() {
    console.log('🧪 RUNNING FMV COLLECTION TEST');
    console.log('🎯 Target: YT Capra (2023, 2024, 2025)');
    
    try {
        await FMVOrchestrator.runTestCollection('YT', 'Capra', [2023, 2024, 2025]);
        
        // Verify DB
        console.log('\n🔍 VERIFYING DATABASE RECORDS...');
        const db = new Database(DB_PATH, { readonly: true });
        
        const rows = db.prepare(`
            SELECT brand, model, year, count(*) as count, avg(price_eur) as avg_price 
            FROM market_history 
            WHERE brand = 'YT' AND model = 'Capra' AND year IN (2023, 2024, 2025)
            GROUP BY year
        `).all();
        
        console.table(rows);
        
        if (rows.length === 0) {
            console.error('❌ NO RECORDS FOUND IN DB!');
            process.exit(1);
        } else {
            console.log('✅ Records verified.');
        }
        
        db.close();
        
    } catch (e) {
        console.error('❌ TEST FAILED:', e);
        process.exit(1);
    }
}

runTest();
