/**
 * Final Catalog Verification Script
 * Run before deploy to confirm everything is working
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('═'.repeat(60));
console.log('✅ CATALOG VERIFICATION REPORT');
console.log('═'.repeat(60));
console.log(`Database: ${dbPath}`);
console.log(`Time: ${new Date().toLocaleString()}`);
console.log();

// 1. Bike Count
const totalBikes = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE is_active = 1').get().cnt;
const hotBikes = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE is_active = 1 AND (is_hot = 1 OR is_hot_offer = 1)').get().cnt;
console.log(`📊 BIKES`);
console.log(`   Total Active: ${totalBikes}`);
console.log(`   Hot Offers: ${hotBikes}`);

// 2. Images
const totalImages = db.prepare('SELECT COUNT(*) as cnt FROM bike_images').get().cnt;
const imageKitImages = db.prepare("SELECT COUNT(*) as cnt FROM bike_images WHERE local_path LIKE '%imagekit%'").get().cnt;
console.log(`\n📷 IMAGES`);
console.log(`   Total: ${totalImages}`);
console.log(`   ImageKit: ${imageKitImages}`);

// 3. Categories
const categories = db.prepare(`
    SELECT category, sub_category, COUNT(*) as cnt 
    FROM bikes WHERE is_active = 1 
    GROUP BY category, sub_category
`).all();
console.log(`\n📁 CATEGORIES`);
categories.forEach(c => console.log(`   ${c.category}/${c.sub_category || '-'}: ${c.cnt}`));

// 4. Brands
const brands = db.prepare(`
    SELECT brand, COUNT(*) as cnt 
    FROM bikes WHERE is_active = 1 
    GROUP BY brand 
    ORDER BY cnt DESC
`).all();
console.log(`\n🏷️ BRANDS`);
brands.forEach(b => console.log(`   ${b.brand}: ${b.cnt}`));

// 5. Rankings
const rankingStats = db.prepare(`
    SELECT 
        MIN(ranking_score) as min_rank,
        MAX(ranking_score) as max_rank,
        AVG(ranking_score) as avg_rank
    FROM bikes WHERE is_active = 1 AND ranking_score IS NOT NULL
`).get();
console.log(`\n📈 RANKING SCORES`);
console.log(`   Min: ${(rankingStats.min_rank || 0).toFixed(3)}`);
console.log(`   Max: ${(rankingStats.max_rank || 0).toFixed(3)}`);
console.log(`   Avg: ${(rankingStats.avg_rank || 0).toFixed(3)}`);

// 6. FMV Coverage
const fmvStats = db.prepare(`
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN fmv IS NOT NULL AND fmv > 0 THEN 1 ELSE 0 END) as with_fmv
    FROM bikes WHERE is_active = 1
`).get();
console.log(`\n💰 FMV COVERAGE`);
console.log(`   With FMV: ${fmvStats.with_fmv}/${fmvStats.total} (${((fmvStats.with_fmv/fmvStats.total)*100).toFixed(1)}%)`);

// 7. Market History
const historyCount = db.prepare('SELECT COUNT(*) as cnt FROM market_history').get().cnt;
const historyDistinct = db.prepare('SELECT COUNT(DISTINCT brand || model) as cnt FROM market_history').get().cnt;
console.log(`\n📜 MARKET HISTORY`);
console.log(`   Total Records: ${historyCount}`);
console.log(`   Distinct Models: ${historyDistinct}`);

// 8. Main Images Check
const brokenMainImages = db.prepare(`
    SELECT id, brand, model, main_image 
    FROM bikes 
    WHERE is_active = 1 AND (main_image IS NULL OR main_image = '' OR main_image NOT LIKE 'https://%')
`).all();
console.log(`\n🖼️ MAIN IMAGES`);
if (brokenMainImages.length > 0) {
    console.log(`   ⚠️ ${brokenMainImages.length} bikes with broken main_image:`);
    brokenMainImages.forEach(b => console.log(`      [${b.id}] ${b.brand} ${b.model}`));
} else {
    console.log(`   ✅ All bikes have valid main_image URLs`);
}

// 9. Data Quality
const incompleteData = db.prepare(`
    SELECT id, brand, model,
        CASE WHEN brand IS NULL OR brand = '' THEN 'brand' END as missing_brand,
        CASE WHEN model IS NULL OR model = '' THEN 'model' END as missing_model,
        CASE WHEN price IS NULL OR price = 0 THEN 'price' END as missing_price,
        CASE WHEN category IS NULL OR category = '' THEN 'category' END as missing_category
    FROM bikes 
    WHERE is_active = 1 AND (
        brand IS NULL OR brand = '' OR
        model IS NULL OR model = '' OR
        price IS NULL OR price = 0 OR
        category IS NULL OR category = ''
    )
`).all();
console.log(`\n📋 DATA QUALITY`);
if (incompleteData.length > 0) {
    console.log(`   ⚠️ ${incompleteData.length} bikes with incomplete data`);
} else {
    console.log(`   ✅ All bikes have complete core data`);
}

// 10. Top Bikes Preview
console.log(`\n🏆 TOP 5 BY RANKING`);
const topBikes = db.prepare(`
    SELECT id, brand, model, year, price, fmv, ranking_score, is_hot_offer
    FROM bikes 
    WHERE is_active = 1 
    ORDER BY ranking_score DESC 
    LIMIT 5
`).all();
topBikes.forEach((b, i) => {
    const hot = b.is_hot_offer ? '🔥' : '';
    const margin = b.fmv ? Math.round((b.fmv - b.price) / b.fmv * 100) : 0;
    console.log(`   ${i+1}. [${b.id}] ${b.brand} ${b.model} (${b.year || '?'})`);
    console.log(`      €${b.price} (FMV €${b.fmv || '?'}, ${margin > 0 ? '+' : ''}${margin}%) Score: ${(b.ranking_score || 0).toFixed(3)} ${hot}`);
});

// Summary
console.log('\n' + '═'.repeat(60));
console.log('📌 SUMMARY');
console.log('═'.repeat(60));

const issues = [];
if (totalBikes === 0) issues.push('No bikes in catalog!');
if (imageKitImages === 0 && totalImages > 0) issues.push('No ImageKit images');
if (brokenMainImages.length > 0) issues.push(`${brokenMainImages.length} broken main images`);
if (incompleteData.length > 0) issues.push(`${incompleteData.length} incomplete bike records`);

if (issues.length === 0) {
    console.log('✅ All checks passed! Catalog is ready for deployment.');
} else {
    console.log('⚠️ Issues found:');
    issues.forEach(i => console.log(`   - ${i}`));
}

console.log('═'.repeat(60));

db.close();
