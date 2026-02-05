const DatabaseManager = require('../js/mysql-config').DatabaseManager;

class ValuationService {
    constructor(db) {
        this.db = db || new DatabaseManager();
    }

    async calculateFMV(bike, conditionData = null) {
        console.log(`[VALUATION] Calculating FMV for ${bike.brand} ${bike.model}...`);
        
        // LEVEL 1: Exact match (Model + Year ±1)
        let fmv = await this.getFMVFromHistory(
            bike.model,
            bike.year ? bike.year - 1 : 0,
            bike.year ? bike.year + 1 : 9999
        );
        
        if (fmv && fmv > 500) {
            console.log(`[VALUATION] ✅ Level 1 (Exact match): €${fmv}`);
            return this.applyConditionPenalty(fmv, bike.condition_grade);
        }
        
        // LEVEL 2: Similar models (Brand + first 2 words of model)
        if (bike.model) {
            const modelKeywords = bike.model.split(' ').slice(0, 2).join(' ');
            fmv = await this.getFMVFromSimilar(bike.brand, modelKeywords);
            
            if (fmv && fmv > 500) {
                console.log(`[VALUATION] ⚠️ Level 2 (Similar models): €${fmv} (confidence: 80%)`);
                return this.applyConditionPenalty(fmv * 0.9, bike.condition_grade);
            }
        }
        
        // LEVEL 3: Category average (Category + Material + Brand Premium)
        const categoryFMV = await this.getCategoryAverage(
            bike.category,
            bike.frame_material || bike.material
        );
        
        if (categoryFMV && categoryFMV > 500) {
            const brandMultipliers = {
                'Santa Cruz': 1.35,
                'YT': 1.30,
                'Pivot': 1.35,
                'Canyon': 1.20,
                'Specialized': 1.25,
                'Trek': 1.15,
                'Cube': 0.95,
                'Ghost': 0.90
            };
            
            fmv = categoryFMV * (brandMultipliers[bike.brand] || 1.0);
            console.log(`[VALUATION] ⚠️ Level 3 (Category avg): €${fmv} (confidence: 60%)`);
            return this.applyConditionPenalty(fmv * 0.85, bike.condition_grade);
        }
        
        // LEVEL 4: Failure
        console.log('[VALUATION] ❌ Unable to calculate FMV. Not enough data.');
        return null;
    }

    // Helper: Level 1 (History)
    async getFMVFromHistory(model, yearMin, yearMax) {
        if (!model) return null;
        const result = await this.db.query(`
            SELECT AVG(price_eur) as fmv, COUNT(*) as count
            FROM market_history
            WHERE model LIKE ?
            AND year BETWEEN ? AND ?
            AND price_eur > 500
        `, [`%${model}%`, yearMin, yearMax]);
        
        // Need at least 3 exact matches
        return (result && result[0] && result[0].count >= 3) ? Math.round(result[0].fmv) : null;
    }

    // Helper: Level 2 (Similar)
    async getFMVFromSimilar(brand, modelKeywords) {
        if (!brand || !modelKeywords) return null;
        const result = await this.db.query(`
            SELECT AVG(price_eur) as fmv, COUNT(*) as count
            FROM market_history
            WHERE brand = ?
            AND model LIKE ?
            AND price_eur > 500
        `, [brand, `%${modelKeywords}%`]);
        
        // Need at least 5 similar matches
        return (result && result[0] && result[0].count >= 5) ? Math.round(result[0].fmv) : null;
    }

    // Helper: Level 3 (Category)
    async getCategoryAverage(category, frameMaterial) {
        if (!category) return null;
        
        let query = `
            SELECT AVG(price_eur) as fmv
            FROM market_history
            WHERE category = ?
            AND price_eur BETWEEN 800 AND 5000
        `;
        const params = [category];
        
        if (frameMaterial) {
            query += ` AND frame_material = ?`;
            params.push(frameMaterial);
        }
        
        const result = await this.db.query(query, params);
        return (result && result[0] && result[0].fmv) ? Math.round(result[0].fmv) : null;
    }

    // Helper: Apply Penalty
    applyConditionPenalty(baseFMV, grade) {
        const penalties = {
            'A': 0.0,
            'B': 0.15,
            'C': 0.30,
            'D': 0.50
        };
        
        const penalty = penalties[grade] !== undefined ? penalties[grade] : 0.15; // Default to B/C border if unknown
        const finalFMV = Math.round(baseFMV * (1 - penalty));
        
        console.log(`[VALUATION] Condition penalty (${grade || 'Unknown'}): -${(penalty * 100).toFixed(0)}% → €${finalFMV}`);
        
        return {
            fmv: Math.round(baseFMV),
            finalPrice: finalFMV,
            confidence: 'calculated',
            sampleSize: 0, // Not tracked in simplified logic
            min: 0,
            max: 0,
            adjustments: [`Condition Penalty (-${(penalty * 100).toFixed(0)}%)`]
        };
    }

    async calculateFMVWithDepreciation(brand, model, year) {
        // 1. Try Exact Match (Level 1) using internal helper
        // We assume 'B' condition for base FMV
        const exactFMV = await this.getFMVFromHistory(model, year ? year - 1 : 0, year ? year + 1 : 9999);
        
        if (exactFMV && exactFMV > 500) {
            console.log(`[VALUATION] ✅ Level 1 (Exact match): €${exactFMV}`);
            const result = this.applyConditionPenalty(exactFMV, 'B');
            return { ...result, confidence: 'high' };
        }

        if (!year || !model) {
            // Fallback to standard if data missing
            return await this.calculateFMV({ brand, model, year, condition_grade: 'B' });
        }

        // 2. Depreciation Strategy (Level 1.5)
        console.log(`[VALUATION] 📉 Attempting Depreciation Model for ${model} (${year})`);
        
        // Search wide range
        const rows = await this.db.query(`
            SELECT year, AVG(price_eur) as avg_price, COUNT(*) as c 
            FROM market_history 
            WHERE brand = ? AND model LIKE ? AND price_eur > 500
            GROUP BY year
            HAVING c >= 3
        `, [brand, `%${model}%`]);

        if (rows && rows.length > 0) {
            // Find closest year
            let closest = null;
            let minDiff = 999;

            for (const row of rows) {
                const diff = Math.abs(row.year - year);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = row;
                }
            }

            if (closest && minDiff <= 5) {
                 // Calculate depreciation
                 const yearDiff = year - closest.year; 
                 // If target is newer (diff > 0): +8%
                 // If target is older (diff < 0): -12%
                 let adjustedPrice = closest.avg_price;
                 if (yearDiff > 0) {
                      adjustedPrice = closest.avg_price * Math.pow(1.08, yearDiff);
                 } else {
                      adjustedPrice = closest.avg_price * Math.pow(0.88, Math.abs(yearDiff));
                 }
                 
                 const finalFMV = Math.round(adjustedPrice);
                 console.log(`[VALUATION] 📉 Depreciation Applied: Base ${closest.year} (€${Math.round(closest.avg_price)}) -> Target ${year} (€${finalFMV})`);
                 
                 const result = this.applyConditionPenalty(finalFMV, 'B');
                 return { 
                     ...result, 
                     confidence: 'medium', 
                     method: 'depreciation',
                     baseYear: closest.year
                 };
            }
        }

        // 3. Fallback to Standard (Level 2/3)
        return await this.calculateFMV({ brand, model, year, condition_grade: 'B' });
    }

    async evaluateSniperRule(price, fmv, shippingOption) {
        if (!fmv || !price) return { isHit: false, reason: 'Missing data', priority: 'none' };

        const isVersand = shippingOption === 'available';
        const thresholdRatio = isVersand ? 0.85 : 0.75;
        const maxPrice = fmv * thresholdRatio;

        if (price <= maxPrice) {
            return {
                isHit: true,
                reason: `Price ${price} <= ${maxPrice.toFixed(0)} (${isVersand ? 'Shipping' : 'Pickup'} limit)`,
                priority: isVersand ? 'high' : 'medium' // Pickup hits are medium priority unless super cheap
            };
        }

        return {
            isHit: false,
            reason: `Price ${price} > ${maxPrice.toFixed(0)}`,
            priority: 'none'
        };
    }

    calculateHotnessScore(bikeData) {
        // Formula: Hotness_Score = (FMV - Price) * (Views_Velocity)
        // Views_Velocity: Views per hour
        
        const { price, fmv, views, publishDate } = bikeData;
        
        if (!fmv || !price) return 0;
        
        const profit = fmv - price;
        if (profit <= 0) return 0;

        const now = new Date();
        const pub = new Date(publishDate || now);
        
        // Avoid division by zero and handle very new posts
        // Minimum 0.5 hours to avoid skewing velocity for just posted items
        const hoursAlive = Math.max(0.5, (now - pub) / (1000 * 60 * 60)); 
        
        const velocity = (views || 0) / hoursAlive;
        
        return Math.round(profit * velocity);
    }

    async calculateSalvageValue(bikeData, fmv) {
        // Sprint 1.5: "Gold Mine" (Salvage Value Arbitrage)
        // Estimate if the sum of parts > asking price
        
        if (!fmv || !bikeData.price) return { value: 0, isGem: false };

        const price = bikeData.price;
        
        // Base Part-Out Ratio (conservative)
        // We assume we can recover ~60-70% of the FMV of a *working* bike by selling parts,
        // minus the frame if it's broken (which we don't know for sure, but we assume risk).
        // Let's use 65% of FMV as "Total Parts Value" estimate.
        let partOutRatio = 0.65;

        // Boost for high-end components (Fox Factory, AXS, etc)
        const desc = (bikeData.description || '').toLowerCase();
        if (desc.includes('fox factory') || desc.includes('kashima') || desc.includes('axs') || desc.includes('xtr') || desc.includes('xx1')) {
            partOutRatio += 0.1; // Better resale value for top-tier parts
        }

        const estimatedPartValue = Math.round(fmv * partOutRatio);
        const laborCost = 150; // Cost to disassemble and list parts
        const shippingBuffer = 50;
        
        const netSalvageValue = estimatedPartValue - laborCost - shippingBuffer;
        const potentialProfit = netSalvageValue - price;

        // Is it a Gem?
        // 1. Profit > 300 EUR
        // 2. ROI > 30%
        const roi = potentialProfit / price;
        const isGem = potentialProfit > 300 && roi > 0.3;

        return {
            value: netSalvageValue,
            potentialProfit,
            isGem
        };
    }
}

module.exports = ValuationService;
