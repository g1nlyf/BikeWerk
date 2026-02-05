const BikesDatabase = require('./bikes-database-node');

class ScoringService {
    constructor(db) {
        this.db = db || new BikesDatabase();
        
        // Brand Factors (Liquidity/Prestige)
        this.brandFactors = {
            'specialized': 1.2,
            'canyon': 1.2,
            'santa cruz': 1.2,
            'trek': 1.2,
            'scott': 1.2,
            'cannondale': 1.2,
            'pinarello': 1.2,
            'bmc': 1.2,
            'yeti': 1.2,
            's-works': 1.2,
            'cube': 1.0,
            'ghost': 1.0,
            'giant': 1.0,
            'merida': 1.0,
            'rose': 1.0,
            'radon': 1.0,
            'focus': 1.0,
            'orbea': 1.0,
            'yt': 1.1,
            'commencal': 1.1,
            'propain': 1.1
        };
    }

    getBrandFactor(brand) {
        if (!brand) return 1.0;
        const b = brand.toLowerCase().trim();
        for (const [key, val] of Object.entries(this.brandFactors)) {
            if (b.includes(key)) return val;
        }
        return 1.0; // Default
    }

    /**
     * Normalize Brand Factor to 0-10 scale for the formula
     * Tier 1 (1.2) -> 10
     * Tier 2 (1.0) -> 8
     * Others -> 5
     */
    getNormalizedBrandScore(brandFactor) {
        if (brandFactor >= 1.2) return 10;
        if (brandFactor >= 1.0) return 8;
        return 5;
    }

    /**
     * Calculate Profit Score (0-10)
     * Profit % = (FMV - Price) / FMV * 100
     * 0% -> 0
     * 40% -> 10
     */
    getProfitScore(price, fmv) {
        if (!fmv || fmv <= 0) return 0;
        const profit = fmv - price;
        const profitPercent = (profit / fmv) * 100;
        
        if (profitPercent <= 0) return 0;
        // Linear mapping: 0% -> 0, 40% -> 10.
        // Score = Profit% / 4
        return Math.min(profitPercent / 4, 10);
    }

    /**
     * Sweet Spot Score (0-10)
     * Target: €1000 - €2000 (Max Score)
     * Soft decay for €2000 - €3000 and €500 - €1000
     */
    getSweetSpotScore(price) {
        if (!price || price <= 0) return 0;
        
        // Prime Zone: 1000 - 2000
        if (price >= 1000 && price <= 2000) return 10;
        
        // Near Prime (High): 2000 - 3000 (Linear decay 10 -> 5)
        if (price > 2000 && price <= 3000) {
            return 10 - ((price - 2000) / 1000) * 5;
        }
        
        // Near Prime (Low): 500 - 1000 (Linear decay 5 -> 10)
        if (price >= 500 && price < 1000) {
            return 5 + ((price - 500) / 500) * 5;
        }
        
        // Luxury: > 3000 (Plateau at 5, to keep them visible but not dominant)
        if (price > 3000) return 5;
        
        // Cheap: < 500 (Low score)
        return 2;
    }

    /**
     * Marburg Transit Engine (Mock/Skeleton)
     * Checks if the bike is within 3 hours of Marburg via public transit.
     * @param {string} zipCode 
     * @returns {Promise<boolean>}
     */
    async checkTransitAccessibility(zipCode) {
        if (!zipCode) return false;
        
        // TODO: Integrate Google Maps / Transit API here
        // Origin: Marburg, Germany
        // Mode: transit
        // Max Duration: 180 min
        
        // Mock Logic: Marburg PLZ area starts with 35...
        // 35xxx is definitely close. 60xxx (Frankfurt) is also close (~1h).
        // Let's assume 35xxx, 36xxx, 60xxx, 61xxx, 63xxx are within 3h for now.
        const z = String(zipCode).trim();
        const validPrefixes = ['35', '36', '60', '61', '63', '64', '65', '55', '56']; // Hessen & nearby
        
        // Simulate API latency
        // await new Promise(r => setTimeout(r, 100));
        
        return validPrefixes.some(p => z.startsWith(p));
    }

    /**
     * Core Formula: FinalScore = (Profit * 0.3) + (Condition * 0.2) + (UserInterest * 0.3) + (SweetSpot * 0.2)
     * Updated for Scoring 3.0 (Hybrid Brain)
     */
    async calculateDesirability(listing, fmv, conditionScore = 7, userInterestScore = 0) {
        const brandFactor = this.getBrandFactor(listing.brand);
        
        // P: Profit Factor (0-10)
        const pScore = this.getProfitScore(listing.price_eur, fmv);
        
        // C: Condition Factor (1-10)
        const cScore = Math.max(1, Math.min(10, conditionScore));
        
        // B: Brand Factor (0-10) - Kept for reference, but weight moved to UserInterest
        const bScore = this.getNormalizedBrandScore(brandFactor);
        
        // S: Sweet Spot Factor (0-10)
        const sScore = this.getSweetSpotScore(listing.price_eur);
        
        // U: User Interest Factor (0-10)
        // If userInterestScore is not provided (e.g. new listing), we can fallback to Brand Score
        // as a proxy for "expected interest"
        const uScore = userInterestScore > 0 ? userInterestScore : bScore;

        // F: Freshness Score (Penalty for stale listings)
        let fPenalty = 0;
        if (listing.scraped_at) {
            const daysOld = (Date.now() - new Date(listing.scraped_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld > 7) {
                fPenalty = Math.min(2, (daysOld - 7) * 0.1);
            }
        }

        // Calculate D (Hybrid Formula)
        let desirability = (pScore * 0.3) + (cScore * 0.2) + (uScore * 0.3) + (sScore * 0.2);
        
        if (fPenalty > 0) {
            desirability -= fPenalty;
            desirability = Math.max(0, desirability);
        }
        
        return {
            totalScore: Number(desirability.toFixed(2)),
            components: {
                profitScore: Number(pScore.toFixed(2)),
                conditionScore: Number(cScore.toFixed(2)),
                userInterestScore: Number(uScore.toFixed(2)),
                sweetSpotScore: Number(sScore.toFixed(2)),
                freshnessPenalty: Number(fPenalty.toFixed(2)),
                brandScore: Number(bScore.toFixed(2)), // Info only
                rawValues: {
                    price: listing.price_eur,
                    fmv: fmv,
                    profitPercent: fmv ? Math.round(((fmv - listing.price_eur) / fmv) * 100) : 0,
                    conditionRaw: conditionScore,
                    daysOld: listing.scraped_at ? Math.round((Date.now() - new Date(listing.scraped_at).getTime()) / (1000 * 60 * 60 * 24)) : 0
                }
            }
        };
    }

    // Reuse FMV logic (simplified for this service, or use DB)
    async calculateFMV(brand, model) {
        // This should connect to DB to get median
        // Assuming the DB instance has a method or we query directly
        // For component testing, we might need to query the DB directly if BikesDatabase doesn't expose it
        // Let's implement a direct query here using the db object if it's a sqlite instance, 
        // or expect the caller to provide FMV.
        // BUT, the prompt says "The Scoring Engine...". It implies it should do the work.
        // Let's assume 'db' is the BikesDatabase instance which has 'db' property (sqlite3).
        
        if (!brand || !model) return null;
        
        const query = `
            SELECT price_eur 
            FROM market_history 
            WHERE brand LIKE ? AND model_name LIKE ? 
            ORDER BY scraped_at DESC 
            LIMIT 50
        `;
        
        return new Promise((resolve, reject) => {
            if (!this.db.db) {
                resolve(null); // No DB connection
                return;
            }
            this.db.db.all(query, [`%${brand}%`, `%${model}%`], (err, rows) => {
                if (err) {
                    console.error('FMV Query Error:', err);
                    resolve(null);
                } else if (!rows || rows.length < 3) {
                    resolve(null);
                } else {
                    const prices = rows.map(r => r.price_eur).sort((a, b) => a - b);
                    const mid = Math.floor(prices.length / 2);
                    const median = prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
                    resolve(median);
                }
            });
        });
    }
}

module.exports = ScoringService;
