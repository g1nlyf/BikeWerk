const { DatabaseManager } = require('../js/mysql-config');
const db = new DatabaseManager();

class ProfitMaximizer {
    
    async calculateOptimalPrice(bike) {
        const base_fmv = bike.fmv;
        if (!base_fmv) return null;

        const scarcityMult = await this.getScarcityMultiplier(bike);

        // Factors
        const multipliers = {
            tier: {
                1: 1.05,
                2: 0.98,
                3: 0.95
            }[bike.tier] || 1.00,
            
            condition: {
                'excellent': 1.02,
                'very_good': 1.00,
                'good': 0.96,
                'fair': 0.90,
                'A': 1.02,
                'B': 1.00,
                'C': 0.96,
                'D': 0.90
            }[bike.condition || bike.condition_grade] || 1.00,
            
            seasonality: this.getSeasonMultiplier(),
            
            scarcity: scarcityMult
        };

        const optimal = base_fmv * 
            multipliers.tier * 
            multipliers.condition * 
            multipliers.seasonality * 
            multipliers.scarcity;
            
        // Round to psychological price
        const rounded = this.psychologicalPrice(optimal);
        
        // Cost estimation (purchase price is bike.price)
        const cost = bike.price || 0;
        const overhead = 100; // shipping + service
        
        return {
            optimal_price: rounded,
            fmv_reference: base_fmv,
            margin: rounded - cost - overhead,
            markup_pct: ((rounded - base_fmv) / base_fmv * 100).toFixed(1),
            multipliers
        };
    }

    psychologicalPrice(price) {
        // €2990, €3490, €3990 instead of €3012, €3487
        if (price < 1000) return Math.round(price / 10) * 10 - 10; // e.g. 990, 890
        return Math.round(price / 100) * 100 - 10; // e.g. 2990, 1490
    }

    getSeasonMultiplier() {
        const month = new Date().getMonth() + 1;
        return {
            1: 0.92, 2: 0.92, 3: 0.96, // Winter
            4: 1.00, 5: 1.06, 6: 1.10, // Spring-Summer (Peak)
            7: 1.10, 8: 1.06, 9: 1.00, 
            10: 0.96, 11: 0.92, 12: 0.90
        }[month] || 1.00;
    }

    async getScarcityMultiplier(bike) {
        try {
            const rows = await db.query(`
                SELECT COUNT(*) as cnt FROM bikes 
                WHERE brand = ? AND model LIKE ? 
                AND is_active = 1
            `, [bike.brand, `%${bike.model}%`]);
            
            const similar = rows[0]?.cnt || 0;
            
            if (similar === 0) return 1.08; // Unique
            if (similar === 1) return 1.04;
            if (similar <= 3) return 1.00;
            return 0.98; // Saturated
        } catch (e) {
            console.error('Error in scarcity check:', e);
            return 1.00;
        }
    }
}

module.exports = new ProfitMaximizer();
