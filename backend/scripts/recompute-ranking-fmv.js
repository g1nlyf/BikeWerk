/**
 * Recompute ranking_score for all bikes using FMV-based value scoring
 * 
 * New formula components:
 * - FMV margin: (fmv - price) / fmv → higher margin = better deal
 * - Hotness boost: is_hot_offer bikes get +0.2
 * - Condition score: normalized from condition_score
 * - Recency: newer listings score higher
 * - Brand premium: known premium brands get slight boost
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('═'.repeat(60));
console.log('📊 Recompute Ranking with FMV Data');
console.log('═'.repeat(60));

// Premium brand multipliers
const BRAND_MULTIPLIERS = {
    'Santa Cruz': 1.15,
    'YT': 1.10,
    'Pivot': 1.15,
    'Canyon': 1.08,
    'Specialized': 1.10,
    'Trek': 1.05,
    'Giant': 1.02,
    'Cube': 0.98,
    'Ghost': 0.95
};

// Get all active bikes
const bikes = db.prepare(`
    SELECT id, brand, price, fmv, is_hot_offer, is_hot, condition_score, 
           created_at, quality_score, fmv_confidence, market_comparison
    FROM bikes 
    WHERE is_active = 1
`).all();

console.log(`\n📦 Processing ${bikes.length} bikes...\n`);

const updateStmt = db.prepare(`
    UPDATE bikes 
    SET ranking_score = ?, rank = ?
    WHERE id = ?
`);

let updated = 0;

db.transaction(() => {
    for (const bike of bikes) {
        // 1. FMV Margin Score (0-0.4)
        // Higher margin = better deal
        let fmvScore = 0;
        if (bike.fmv && bike.price && bike.fmv > 0) {
            const margin = (bike.fmv - bike.price) / bike.fmv;
            // Clamp to -0.3 to 0.5 range, then normalize to 0-0.4
            const normalizedMargin = Math.max(-0.3, Math.min(0.5, margin));
            fmvScore = (normalizedMargin + 0.3) / 0.8 * 0.4;
        }
        
        // 2. Hotness Boost (0-0.2)
        const hotnessBoost = (bike.is_hot_offer || bike.is_hot) ? 0.2 : 0;
        
        // 3. Condition Score (0-0.15)
        let conditionScore = 0.075; // default middle
        if (bike.condition_score) {
            conditionScore = Math.min(100, bike.condition_score) / 100 * 0.15;
        }
        
        // 4. Quality Score (0-0.1)
        let qualityScore = 0.05;
        if (bike.quality_score) {
            qualityScore = Math.min(100, bike.quality_score) / 100 * 0.1;
        }
        
        // 5. Recency Score (0-0.1)
        let recencyScore = 0.05;
        if (bike.created_at) {
            const daysOld = (Date.now() - new Date(bike.created_at).getTime()) / (1000 * 60 * 60 * 24);
            recencyScore = Math.exp(-daysOld / 30) * 0.1; // Decay over 30 days
        }
        
        // 6. Brand Premium (0.95-1.15 multiplier)
        const brandMultiplier = BRAND_MULTIPLIERS[bike.brand] || 1.0;
        
        // 7. FMV Confidence boost (0-0.05)
        const confidenceBoost = (bike.fmv_confidence || 0) * 0.05;
        
        // Calculate final score
        let baseScore = fmvScore + hotnessBoost + conditionScore + qualityScore + recencyScore + confidenceBoost;
        let finalScore = baseScore * brandMultiplier;
        
        // Clamp to 0.01-0.99
        finalScore = Math.max(0.01, Math.min(0.99, finalScore));
        
        updateStmt.run(finalScore, finalScore, bike.id);
        updated++;
        
        if (updated <= 10 || bike.is_hot_offer) {
            console.log(`[${bike.id}] ${bike.brand}: FMV=${fmvScore.toFixed(3)} Hot=${hotnessBoost} Cond=${conditionScore.toFixed(3)} → Score=${finalScore.toFixed(3)}`);
        }
    }
})();

console.log(`\n✅ Updated ${updated} bikes\n`);

// Show top 15 by new ranking
console.log('🏆 Top 15 by new ranking:');
const top = db.prepare(`
    SELECT id, brand, model, price, fmv, ranking_score, is_hot_offer, market_comparison
    FROM bikes 
    WHERE is_active = 1 
    ORDER BY ranking_score DESC 
    LIMIT 15
`).all();

top.forEach((b, i) => {
    const margin = b.fmv ? ((b.fmv - b.price) / b.price * 100).toFixed(1) : '?';
    const hot = b.is_hot_offer ? '🔥' : '';
    console.log(`${i + 1}. [${b.id}] ${b.brand} ${b.model} - €${b.price} (FMV €${b.fmv}, ${margin}% margin) Score: ${b.ranking_score.toFixed(3)} ${hot}`);
});

// Distribution
console.log('\n📊 Score Distribution:');
const dist = db.prepare(`
    SELECT 
        CASE 
            WHEN ranking_score >= 0.7 THEN 'Excellent (0.7+)'
            WHEN ranking_score >= 0.5 THEN 'Good (0.5-0.7)'
            WHEN ranking_score >= 0.3 THEN 'Fair (0.3-0.5)'
            ELSE 'Low (<0.3)'
        END as tier,
        COUNT(*) as count
    FROM bikes 
    WHERE is_active = 1
    GROUP BY tier
    ORDER BY MIN(ranking_score) DESC
`).all();
dist.forEach(d => console.log(`  ${d.tier}: ${d.count}`));

db.close();
console.log('\n✅ Done!');
