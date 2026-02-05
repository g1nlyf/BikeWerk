
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '../../database/eubike.db');
let db;

try {
    db = new Database(dbPath, { readonly: true });
} catch (e) {
    console.error(`Failed to open DB at ${dbPath}: ${e.message}`);
    process.exit(1);
}

console.log('🔍 Checking SQLite DB Status...');

// 1. Silent Collector Check
try {
    const row = db.prepare(`
        SELECT COUNT(*) as recent_records 
        FROM market_history 
        WHERE created_at > datetime('now', '-1 hour') 
        AND source_url LIKE '%kleinanzeigen%'
    `).get();
    // Note: source column might be 'kleinanzeigen' or we check source_url
    
    console.log(`\n1. Silent Collector (Last 1 hour):`);
    console.log(`   Records found: ${row.recent_records}`);
    if (row.recent_records === 0) console.log('   ❌ Silent Collector might be broken or inactive.');
    else console.log('   ✅ Silent Collector is active.');
} catch (e) {
    console.error(`Error checking market_history: ${e.message}`);
}

// 2. TechDecoder Check
try {
    const row = db.prepare(`
        SELECT COUNT(*) as normalized 
        FROM bikes 
        WHERE (original_url LIKE '%kleinanzeigen%' OR source_url LIKE '%kleinanzeigen%')
        AND hotness_score > 0 
        AND created_at > datetime('now', '-24 hours') 
    `).get();
    // Note: quality_score might not be in bikes table, using hotness_score as proxy for AI processing
    
    console.log(`\n2. TechDecoder (Last 24 hours):`);
    console.log(`   Normalized bikes: ${row.normalized}`);
    if (row.normalized === 0) console.log('   ❌ TechDecoder might not be processing bikes.');
    else console.log('   ✅ TechDecoder is working.');
} catch (e) {
    console.error(`Error checking bikes: ${e.message}`);
}
