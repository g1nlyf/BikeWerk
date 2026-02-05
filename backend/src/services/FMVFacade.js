/**
 * Unified FMV Facade
 * 
 * Single entry point for all FMV (Fair Market Value) operations.
 * Consolidates: FMVAnalyzer, ValuationService, FMVCollector
 * 
 * Usage:
 *   const FMV = require('./services/FMVFacade');
 *   const fmv = await FMV.calculate('YT', 'Capra', 2022);
 *   const comparison = FMV.compare(price, fmv);
 */

const { DatabaseManager } = require('../js/mysql-config');
const FMVAnalyzer = require('./FMVAnalyzer');
const FMVCollector = require('./FMVCollector');

class FMVFacade {
    constructor() {
        this.db = new DatabaseManager();
        this.analyzer = null;
        this._initialized = false;
    }

    async ensureInitialized() {
        if (this._initialized) return;

        if (!this.db.db) {
            await this.db.initialize();
        }
        this.analyzer = new FMVAnalyzer(this.db);
        this._initialized = true;
    }

    /**
     * Calculate FMV for a bike
     * @param {string} brand - e.g., "YT"
     * @param {string} model - e.g., "Capra"
     * @param {number} year - e.g., 2022
     * @param {object} options - { frameSize, frameMaterial }
     * @returns {object} { fmv, confidence, sample_size, price_range, data_source }
     */
    async calculate(brand, model, year, options = {}) {
        await this.ensureInitialized();

        if (!brand || !model) {
            return {
                fmv: null,
                confidence: 0,
                sample_size: 0,
                data_source: 'insufficient_data',
                error: 'Brand and model are required'
            };
        }

        try {
            return await this.analyzer.getFairMarketValue(brand, model, year, options);
        } catch (e) {
            console.error(`[FMVFacade] Error calculating FMV: ${e.message}`);
            return {
                fmv: null,
                confidence: 0,
                sample_size: 0,
                data_source: 'error',
                error: e.message
            };
        }
    }

    /**
     * Compare a price against FMV
     * @param {number} price - Listing price
     * @param {number|object} fmv - FMV value or FMV result object
     * @returns {string} 'well_below_market', 'below_market', 'at_market', 'above_market', 'well_above_market'
     */
    compare(price, fmv) {
        const fmvValue = typeof fmv === 'object' ? fmv.fmv : fmv;

        if (!fmvValue || fmvValue === 0 || !price) {
            return 'unknown';
        }

        const diff = ((price - fmvValue) / fmvValue) * 100;

        if (diff <= -20) return 'well_below_market';
        if (diff <= -10) return 'below_market';
        if (diff <= 10) return 'at_market';
        if (diff <= 25) return 'above_market';
        return 'well_above_market';
    }

    /**
     * Check if a listing is a "good deal"
     * @param {number} price - Listing price
     * @param {object} fmvResult - FMV calculation result
     * @returns {object} { isGoodDeal, discount, confidence, reason }
     */
    evaluateDeal(price, fmvResult) {
        if (!fmvResult || !fmvResult.fmv || !price) {
            return { isGoodDeal: false, discount: 0, confidence: 0, reason: 'Insufficient FMV data' };
        }

        const discount = ((fmvResult.fmv - price) / fmvResult.fmv) * 100;
        const confidence = fmvResult.confidence || 0;

        // Good deal criteria:
        // 1. Price at least 15% below FMV
        // 2. FMV confidence at least 60%
        const isGoodDeal = discount >= 15 && confidence >= 0.6;

        let reason;
        if (isGoodDeal) {
            reason = `${discount.toFixed(0)}% below market (FMV: €${fmvResult.fmv}, confidence: ${(confidence * 100).toFixed(0)}%)`;
        } else if (discount < 15) {
            reason = `Discount too small (${discount.toFixed(0)}%, need 15%+)`;
        } else {
            reason = `Low FMV confidence (${(confidence * 100).toFixed(0)}%, need 60%+)`;
        }

        return { isGoodDeal, discount: Math.round(discount), confidence, reason };
    }

    /**
     * Get depreciation factor for a bike age
     * @param {number} age - Years since manufacture
     * @returns {number} Value retention factor (0.0 - 1.0)
     */
    getDepreciationFactor(age) {
        if (age <= 1) return 0.80;
        if (age <= 2) return 0.70;
        if (age <= 3) return 0.60;
        if (age <= 5) return 0.45;
        if (age <= 7) return 0.30;
        return 0.20;
    }

    /**
     * Get brand tier info
     * @param {string} brand
     * @returns {object} { tier, basePrice }
     */
    getBrandTier(brand) {
        const tiers = {
            'specialized': { tier: 1, basePrice: 3500 },
            'trek': { tier: 1, basePrice: 3500 },
            'santa cruz': { tier: 1, basePrice: 4500 },
            'yt': { tier: 1, basePrice: 3200 },
            'canyon': { tier: 1, basePrice: 3000 },
            'scott': { tier: 1, basePrice: 3000 },
            'evil': { tier: 1, basePrice: 5000 },
            'yeti': { tier: 1, basePrice: 5500 },
            'pivot': { tier: 1, basePrice: 5000 },
            'giant': { tier: 2, basePrice: 2000 },
            'cube': { tier: 2, basePrice: 2000 },
            'focus': { tier: 2, basePrice: 2000 },
            'merida': { tier: 2, basePrice: 1800 },
            'ghost': { tier: 2, basePrice: 1800 },
            'commencal': { tier: 2, basePrice: 2500 },
            'nukeproof': { tier: 2, basePrice: 2200 },
            'bulls': { tier: 3, basePrice: 1500 },
            'kellys': { tier: 3, basePrice: 1200 },
            'radon': { tier: 3, basePrice: 1800 }
        };

        const brandLower = brand?.toLowerCase() || '';
        return tiers[brandLower] || { tier: 3, basePrice: 1500 };
    }

    /**
     * Collect market data for FMV database
     * @param {object} target - { brand, model, year, url, source }
     * @param {number} limit - Max items to collect
     * @returns {object} { collected, duplicates, errors }
     */
    async collectMarketData(target, limit = 50) {
        return await FMVCollector.collect(target, limit);
    }

    /**
     * Get market history stats
     * @returns {object} { totalRecords, avgPrice, recentRecords }
     */
    async getStats() {
        await this.ensureInitialized();

        try {
            const total = await this.db.query('SELECT COUNT(*) as count FROM market_history');
            const recentCount = await this.db.query(
                "SELECT COUNT(*) as count FROM market_history WHERE created_at > datetime('now', '-7 days')"
            );
            const avgPrice = await this.db.query(
                'SELECT AVG(price_eur) as avg FROM market_history WHERE price_eur > 0'
            );

            return {
                totalRecords: total?.[0]?.count || 0,
                recentRecords: recentCount?.[0]?.count || 0,
                avgPrice: Math.round(avgPrice?.[0]?.avg || 0)
            };
        } catch (e) {
            console.error(`[FMVFacade] Error getting stats: ${e.message}`);
            return { totalRecords: 0, recentRecords: 0, avgPrice: 0 };
        }
    }
}

// Export singleton
module.exports = new FMVFacade();
