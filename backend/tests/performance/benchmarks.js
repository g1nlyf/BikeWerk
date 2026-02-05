const path = require('path');
const fs = require('fs');
const DatabaseManager = require('../../database/db-manager');

const BENCH_DB_PATH = path.join(__dirname, 'bench_eubike.db');
process.env.DB_PATH = BENCH_DB_PATH;

async function setupBenchDatabase() {
    if (fs.existsSync(BENCH_DB_PATH)) {
        try { fs.unlinkSync(BENCH_DB_PATH); } catch(e) {}
    }
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    
    // Minimal schema for benchmarking
    db.exec(`
        CREATE TABLE IF NOT EXISTS bikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand TEXT,
            model TEXT,
            price REAL,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_bikes_brand ON bikes(brand);
        CREATE INDEX IF NOT EXISTS idx_bikes_price ON bikes(price);
    `);
    return { dbManager, db };
}

async function runPerformanceBenchmarks() {
    console.log('🚀 Starting Performance Benchmarks...\n');
    
    const { dbManager, db } = await setupBenchDatabase();
    
    // 1. Bulk Insert Speed
    console.log('1️⃣  Bulk Insert Speed (1000 items)');
    const startInsert = process.hrtime();
    const insertStmt = db.prepare('INSERT INTO bikes (brand, model, price, category) VALUES (?, ?, ?, ?)');
    
    const insertTx = db.transaction((count) => {
        for (let i = 0; i < count; i++) {
            insertStmt.run('Brand' + (i % 10), 'Model' + i, 1000 + i, 'Category' + (i % 3));
        }
    });
    insertTx(1000);
    
    const endInsert = process.hrtime(startInsert);
    const insertMs = (endInsert[0] * 1000 + endInsert[1] / 1e6).toFixed(2);
    console.log(`   ⏱️  Time: ${insertMs}ms`);
    console.log(`   ⚡ Rate: ${(1000 / (insertMs / 1000)).toFixed(0)} items/sec`);
    if (insertMs < 500) console.log('   ✅ PASS (< 500ms)');
    else console.log('   ⚠️  WARN (> 500ms)');
    console.log('');

    // 2. Complex Query Latency
    console.log('2️⃣  Complex Query Latency (Filter + Sort + Limit)');
    const startQuery = process.hrtime();
    const rows = db.prepare('SELECT * FROM bikes WHERE price > 1500 AND brand = ? ORDER BY price DESC LIMIT 50').all('Brand5');
    const endQuery = process.hrtime(startQuery);
    const queryMs = (endQuery[0] * 1000 + endQuery[1] / 1e6).toFixed(2);
    console.log(`   ⏱️  Time: ${queryMs}ms`);
    console.log(`   found: ${rows.length} rows`);
    if (queryMs < 100) console.log('   ✅ PASS (< 100ms)');
    else console.log('   ⚠️  WARN (> 100ms)');
    console.log('');

    // 3. Concurrent User Simulation
    console.log('3️⃣  Concurrent User Simulation (100 parallel reads)');
    const startConcurrent = process.hrtime();
    const promises = [];
    for (let i = 0; i < 100; i++) {
        promises.push(new Promise((resolve) => {
            // Simulate random read
            const r = db.prepare('SELECT * FROM bikes WHERE id = ?').get(Math.floor(Math.random() * 1000) + 1);
            resolve(r);
        }));
    }
    await Promise.all(promises);
    const endConcurrent = process.hrtime(startConcurrent);
    const concurrentMs = (endConcurrent[0] * 1000 + endConcurrent[1] / 1e6).toFixed(2);
    console.log(`   ⏱️  Time: ${concurrentMs}ms`);
    console.log(`   ⚡ Rate: ${(100 / (concurrentMs / 1000)).toFixed(0)} req/sec`);
    if (concurrentMs < 200) console.log('   ✅ PASS (< 200ms total)');
    else console.log('   ⚠️  WARN (> 200ms total)');
    console.log('');
    
    // Cleanup
    if (fs.existsSync(BENCH_DB_PATH)) {
        try { fs.unlinkSync(BENCH_DB_PATH); } catch(e) {}
    }
}

runPerformanceBenchmarks().catch(console.error);
