/**
 * Reset Catalog and Test Hunter Pipeline
 * 
 * 1. Backup current bikes to market_history
 * 2. Clear bikes table
 * 3. Run Hot Deal hunt for 5 bikes
 * 4. Verify results
 */

const Database = require('better-sqlite3');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('═'.repeat(60));
console.log('🔄 Reset Catalog and Test Hunter Pipeline');
console.log('═'.repeat(60));

// Step 1: Backup existing bikes to market_history
console.log('\n📦 Step 1: Backing up bikes to market_history...');

const bikes = db.prepare(`
    SELECT brand, model, year, price as price_eur, name as title, original_url as source_url, category
    FROM bikes 
    WHERE is_active = 1 AND brand IS NOT NULL AND brand != 'Unknown'
`).all();

const insertHistory = db.prepare(`
    INSERT OR IGNORE INTO market_history 
    (brand, model, year, price_eur, title, source_url, category, source_platform, scraped_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'backup', datetime('now'), datetime('now'))
`);

let backed = 0;
db.transaction(() => {
    for (const bike of bikes) {
        try {
            insertHistory.run(bike.brand, bike.model, bike.year, bike.price_eur, bike.title, bike.source_url, bike.category);
            backed++;
        } catch (e) {}
    }
})();

console.log(`   ✅ Backed up ${backed} bikes to market_history`);

// Step 2: Show current state
console.log('\n📊 Current state:');
console.log(`   Bikes: ${db.prepare('SELECT COUNT(*) as cnt FROM bikes').get().cnt}`);
console.log(`   market_history: ${db.prepare('SELECT COUNT(*) as cnt FROM market_history').get().cnt}`);

// Step 3: Clear bikes and related tables
console.log('\n🗑️ Step 2: Clearing bikes table...');

db.exec(`
    DELETE FROM bike_images;
    DELETE FROM bike_specs;
    DELETE FROM bikes;
`);

console.log('   ✅ Cleared bikes, bike_images, bike_specs');

// Verify
const afterClear = db.prepare('SELECT COUNT(*) as cnt FROM bikes').get().cnt;
console.log(`   Bikes after clear: ${afterClear}`);

db.close();

// Step 4: Run Hot Deal Hunter
console.log('\n🔥 Step 3: Running Hot Deal Hunter (5 bikes)...');
console.log('   This may take 2-5 minutes...\n');

try {
    const HotDealHunter = require('../src/services/HotDealHunter');
    
    // Run synchronously for testing
    (async () => {
        const result = await HotDealHunter.hunt(5);
        console.log('\n   Hunter result:', result);
        
        // Verify results
        const db2 = new Database(dbPath);
        const finalCount = db2.prepare('SELECT COUNT(*) as cnt FROM bikes').get().cnt;
        
        console.log('\n📊 Final state:');
        console.log(`   Bikes added: ${finalCount}`);
        
        if (finalCount > 0) {
            console.log('\n📦 New bikes:');
            const newBikes = db2.prepare(`
                SELECT id, brand, model, year, price, fmv, category, sub_category, discipline, is_hot_offer
                FROM bikes ORDER BY id LIMIT 10
            `).all();
            
            newBikes.forEach(b => {
                const hot = b.is_hot_offer ? '🔥' : '';
                console.log(`   [${b.id}] ${b.brand} ${b.model} (${b.year}) - €${b.price} | FMV: ${b.fmv || 'NULL'} | ${b.category}/${b.sub_category} ${hot}`);
            });
            
            // Export first bike as JSON
            console.log('\n📄 First bike full JSON:');
            const first = db2.prepare('SELECT * FROM bikes LIMIT 1').get();
            console.log(JSON.stringify(first, null, 2));
        }
        
        db2.close();
    })();
} catch (e) {
    console.error('   ❌ Hunter error:', e.message);
}
