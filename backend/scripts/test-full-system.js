/**
 * Full System Test Script
 * Tests: Database, FMV, Sorting, Hot Filter, Hunter Integration
 */

const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('═'.repeat(60));
console.log('🧪 Full System Test');
console.log('═'.repeat(60));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result === true) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`❌ ${name}: ${result}`);
            failed++;
        }
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

// Test 1: Database Connection
test('Database connection', () => {
    const result = db.prepare('SELECT 1 as ok').get();
    return result.ok === 1 ? true : 'Connection failed';
});

// Test 2: Bikes exist
test('Bikes table has data', () => {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM bikes').get().cnt;
    return count > 0 ? true : `No bikes found (count: ${count})`;
});

// Test 3: Active bikes
test('Active bikes exist', () => {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE is_active = 1').get().cnt;
    return count > 50 ? true : `Only ${count} active bikes`;
});

// Test 4: FMV filled
test('FMV filled for most bikes', () => {
    const total = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE is_active = 1').get().cnt;
    const withFmv = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE is_active = 1 AND fmv IS NOT NULL AND fmv > 0').get().cnt;
    const pct = Math.round(withFmv / total * 100);
    return pct >= 90 ? true : `Only ${pct}% have FMV (${withFmv}/${total})`;
});

// Test 5: Ranking scores diverse
test('Ranking scores are diverse', () => {
    const scores = db.prepare(`
        SELECT MIN(ranking_score) as min, MAX(ranking_score) as max, AVG(ranking_score) as avg
        FROM bikes WHERE is_active = 1
    `).get();
    const range = scores.max - scores.min;
    return range > 0.3 ? true : `Score range too narrow: ${scores.min.toFixed(2)}-${scores.max.toFixed(2)} (range: ${range.toFixed(2)})`;
});

// Test 6: Hot deals exist
test('Hot deals exist', () => {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE is_hot = 1 OR is_hot_offer = 1').get().cnt;
    return count >= 5 ? true : `Only ${count} hot deals`;
});

// Test 7: Top ranked bikes are high margin
test('Top ranked bikes have good margins', () => {
    const top5 = db.prepare(`
        SELECT id, brand, price, fmv, ranking_score,
               CASE WHEN fmv > 0 THEN (fmv - price) / fmv * 100 ELSE 0 END as margin
        FROM bikes 
        WHERE is_active = 1 AND fmv > 0
        ORDER BY ranking_score DESC 
        LIMIT 5
    `).all();
    
    const avgMargin = top5.reduce((sum, b) => sum + b.margin, 0) / top5.length;
    return avgMargin > 10 ? true : `Top 5 avg margin only ${avgMargin.toFixed(1)}%`;
});

// Test 8: market_history has data
test('market_history has sufficient data', () => {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM market_history').get().cnt;
    return count >= 1000 ? true : `Only ${count} market history records`;
});

// Test 9: bike_images linked
test('Bikes have images linked', () => {
    const withImages = db.prepare(`
        SELECT COUNT(DISTINCT bikes.id) as cnt 
        FROM bikes 
        JOIN bike_images ON bikes.id = bike_images.bike_id 
        WHERE bikes.is_active = 1
    `).get().cnt;
    const total = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE is_active = 1').get().cnt;
    const pct = Math.round(withImages / total * 100);
    return pct >= 70 ? true : `Only ${pct}% have images (${withImages}/${total})`;
});

// Test 10: Categories normalized
test('Categories are normalized', () => {
    const cats = db.prepare(`
        SELECT DISTINCT category FROM bikes WHERE is_active = 1
    `).all().map(r => r.category);
    
    const validCats = ['mtb', 'road', 'gravel', 'emtb', 'kids', 'other', null];
    const invalid = cats.filter(c => c && !validCats.includes(c.toLowerCase()));
    
    return invalid.length === 0 ? true : `Invalid categories: ${invalid.join(', ')}`;
});

console.log('\n' + '─'.repeat(60));
console.log('📊 Summary:');
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log('─'.repeat(60));

// Show sample data
console.log('\n📦 Sample Top 5 Bikes by Ranking:');
const top5 = db.prepare(`
    SELECT id, brand, model, price, fmv, ranking_score, is_hot_offer,
           CASE WHEN fmv > 0 THEN ROUND((fmv - price) / fmv * 100, 1) ELSE 0 END as margin_pct
    FROM bikes 
    WHERE is_active = 1
    ORDER BY ranking_score DESC 
    LIMIT 5
`).all();

top5.forEach((b, i) => {
    const hot = b.is_hot_offer ? '🔥' : '';
    console.log(`${i+1}. [${b.id}] ${b.brand} ${b.model} - €${b.price} (FMV €${b.fmv}, ${b.margin_pct}% margin, score: ${b.ranking_score.toFixed(3)}) ${hot}`);
});

console.log('\n📊 Distribution by Category:');
const catDist = db.prepare(`
    SELECT category, COUNT(*) as cnt FROM bikes WHERE is_active = 1 GROUP BY category ORDER BY cnt DESC
`).all();
catDist.forEach(c => console.log(`  ${c.category || 'NULL'}: ${c.cnt}`));

db.close();

console.log('\n' + (failed === 0 ? '✅ All tests passed!' : `⚠️ ${failed} test(s) failed`));
process.exit(failed > 0 ? 1 : 0);
