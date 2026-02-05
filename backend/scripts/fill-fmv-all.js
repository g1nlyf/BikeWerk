/**
 * Fill FMV (Fair Market Value) for all bikes that have NULL fmv
 * Uses market_history table to calculate FMV based on similar models
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('═'.repeat(60));
console.log('💰 FMV Fill Script - Заполнение справедливой рыночной цены');
console.log('═'.repeat(60));

// Get bikes with NULL fmv
const bikesWithoutFMV = db.prepare(`
    SELECT id, brand, model, year, name, price 
    FROM bikes 
    WHERE (fmv IS NULL OR fmv = 0) AND is_active = 1
`).all();

console.log(`\n📊 Найдено ${bikesWithoutFMV.length} байков без FMV\n`);

let updated = 0;
let failed = 0;

function calculateIQRMean(prices) {
    if (prices.length < 3) return null;
    
    prices.sort((a, b) => a - b);
    
    const q1Idx = Math.floor(prices.length * 0.25);
    const q3Idx = Math.floor(prices.length * 0.75);
    
    // Get IQR prices (between Q1 and Q3)
    const iqrPrices = prices.slice(q1Idx, q3Idx + 1);
    
    if (iqrPrices.length === 0) return prices.reduce((a, b) => a + b, 0) / prices.length;
    
    return iqrPrices.reduce((a, b) => a + b, 0) / iqrPrices.length;
}

function findFMV(bike) {
    const { brand, model, year, name } = bike;
    
    // Handle null/unknown values
    if (!brand || brand === 'Unknown') return null;
    
    const safeModel = model || name || '';
    
    // Strategy 1: Exact brand + model match
    let rows = [];
    if (safeModel && safeModel !== 'Unknown') {
        rows = db.prepare(`
            SELECT price_eur 
            FROM market_history 
            WHERE brand = ? 
              AND (model LIKE ? OR title LIKE ?)
              AND price_eur > 100
              ${year ? 'AND (year BETWEEN ? AND ? OR year IS NULL)' : ''}
            ORDER BY price_eur
        `).all(
            brand,
            `%${safeModel}%`,
            `%${safeModel}%`,
            ...(year ? [year - 2, year + 2] : [])
        );
        
        if (rows.length >= 3) {
            const prices = rows.map(r => r.price_eur);
            const fmv = calculateIQRMean(prices);
            return { fmv: Math.round(fmv), confidence: 0.9, sample_size: rows.length, method: 'exact' };
        }
    }
    
    // Strategy 2: Brand + first word of model
    const modelFirstWord = safeModel ? safeModel.split(/\s+/)[0] : '';
    if (modelFirstWord && modelFirstWord.length > 2 && modelFirstWord !== 'Unknown') {
        rows = db.prepare(`
            SELECT price_eur 
            FROM market_history 
            WHERE brand = ? 
              AND (model LIKE ? OR title LIKE ?)
              AND price_eur > 100
            ORDER BY price_eur
        `).all(brand, `%${modelFirstWord}%`, `%${modelFirstWord}%`);
        
        if (rows.length >= 3) {
            const prices = rows.map(r => r.price_eur);
            const fmv = calculateIQRMean(prices);
            return { fmv: Math.round(fmv), confidence: 0.7, sample_size: rows.length, method: 'partial_model' };
        }
    }
    
    // Strategy 3: Brand average
    rows = db.prepare(`
        SELECT price_eur 
        FROM market_history 
        WHERE brand = ?
          AND price_eur > 100
        ORDER BY price_eur
    `).all(brand);
    
    if (rows.length >= 5) {
        const prices = rows.map(r => r.price_eur);
        const fmv = calculateIQRMean(prices);
        return { fmv: Math.round(fmv), confidence: 0.5, sample_size: rows.length, method: 'brand_avg' };
    }
    
    // Strategy 4: Category average (last resort)
    const bikeCategory = db.prepare('SELECT category FROM bikes WHERE id = ?').get(bike.id)?.category;
    if (bikeCategory) {
        rows = db.prepare(`
            SELECT price_eur 
            FROM market_history 
            WHERE category = ?
              AND price_eur > 100
            ORDER BY price_eur
        `).all(bikeCategory);
        
        if (rows.length >= 5) {
            const prices = rows.map(r => r.price_eur);
            const fmv = calculateIQRMean(prices);
            return { fmv: Math.round(fmv), confidence: 0.3, sample_size: rows.length, method: 'category_avg' };
        }
    }
    
    return null;
}

function getMarketComparison(price, fmv) {
    if (!price || !fmv) return 'unknown';
    const diff = ((fmv - price) / fmv) * 100;
    if (diff > 20) return 'excellent_deal';
    if (diff > 10) return 'good_deal';
    if (diff > 0) return 'fair_price';
    if (diff > -10) return 'slightly_overpriced';
    return 'overpriced';
}

// Process each bike
const updateStmt = db.prepare(`
    UPDATE bikes 
    SET fmv = ?, fmv_confidence = ?, market_comparison = ?
    WHERE id = ?
`);

db.transaction(() => {
    for (const bike of bikesWithoutFMV) {
        const result = findFMV(bike);
        
        if (result) {
            const marketComparison = getMarketComparison(bike.price, result.fmv);
            updateStmt.run(result.fmv, result.confidence, marketComparison, bike.id);
            updated++;
            console.log(`✅ [${bike.id}] ${bike.brand} ${bike.model} (${bike.year || '?'}) → FMV: €${result.fmv} (${result.method}, conf: ${result.confidence}, ${marketComparison})`);
        } else {
            // Use price * 1.1 as fallback estimate
            const estimatedFMV = Math.round(bike.price * 1.1);
            updateStmt.run(estimatedFMV, 0.2, 'estimated', bike.id);
            failed++;
            console.log(`⚠️ [${bike.id}] ${bike.brand} ${bike.model} - No data, estimated FMV: €${estimatedFMV}`);
        }
    }
})();

console.log('\n' + '═'.repeat(60));
console.log(`✅ Обновлено: ${updated}`);
console.log(`⚠️ Оценка (нет данных): ${failed}`);
console.log('═'.repeat(60));

// Show sample results
console.log('\n📊 Примеры обновленных FMV:');
const samples = db.prepare(`
    SELECT id, brand, model, price, fmv, fmv_confidence, market_comparison 
    FROM bikes 
    WHERE fmv IS NOT NULL 
    ORDER BY RANDOM() 
    LIMIT 10
`).all();

samples.forEach(s => {
    const margin = s.fmv ? ((s.fmv - s.price) / s.price * 100).toFixed(1) : '?';
    console.log(`  [${s.id}] ${s.brand} ${s.model}: €${s.price} → FMV €${s.fmv} (${margin}% margin, ${s.market_comparison})`);
});

db.close();
console.log('\n✅ Done!');
