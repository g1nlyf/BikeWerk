const DatabaseManager = require('../js/mysql-config').DatabaseManager;
const ValuationService = require('./ValuationService');

class RecommendationService {
    constructor(db) {
        this.db = db || new DatabaseManager();
        this.valuationService = new ValuationService(this.db);
    }

    async getRecommendations(userId) {
        // 1. Get User Preferences
        const prefs = await this.db.query('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
        
        if (!prefs || prefs.length === 0) {
            // Default: Show hot offers or recent items
            return await this.getGenericRecommendations();
        }

        const p = prefs[0];
        const brands = p.brands ? JSON.parse(p.brands) : [];
        const categories = p.categories ? JSON.parse(p.categories) : [];
        
        // 2. Build Query
        let query = `SELECT * FROM bikes WHERE is_active = 1`;
        const params = [];

        if (brands.length > 0) {
            query += ` AND brand IN (${brands.map(() => '?').join(',')})`;
            params.push(...brands);
        }
        
        if (p.min_price) {
            query += ` AND price >= ?`;
            params.push(p.min_price);
        }
        
        if (p.max_price) {
            query += ` AND price <= ?`;
            params.push(p.max_price);
        }

        query += ` ORDER BY created_at DESC LIMIT 10`;

        const candidates = await this.db.query(query, params);

        // 3. Calculate Profit for each candidate
        const recommendations = [];
        
        for (const bike of candidates) {
            // Estimate FMV
            const fmvData = await this.valuationService.calculateFMV({
                brand: bike.brand,
                model: bike.model,
                year: bike.year,
                material: bike.frame_material
            }, {
                penalty: bike.condition_penalty || 0
            });

            if (fmvData) {
                const deliveryFee = 150; // Est.
                const serviceFee = bike.price * 0.05; // 5%
                const totalCost = bike.price + deliveryFee + serviceFee;
                const profit = fmvData.finalPrice - totalCost;

                if (profit > 0) {
                    recommendations.push({
                        ...bike,
                        fmv: fmvData.finalPrice,
                        estimatedProfit: Math.round(profit),
                        profitMargin: Math.round((profit / totalCost) * 100)
                    });
                }
            }
        }

        // Sort by Profit
        recommendations.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
        
        return recommendations;
    }

    async getGenericRecommendations() {
        // Fallback: Return Top 3 Hot Offers with Highest Profit Potential
        // We select bikes that are marked as hot offers or just high ranked, 
        // then calculate potential profit for them to show the badge.
        
        // 1. Get candidate bikes (Hot offers first, then high rank)
        const query = `
            SELECT * FROM bikes 
            WHERE is_active = 1 
            ORDER BY is_hot_offer DESC, ranking_score DESC, created_at DESC 
            LIMIT 10
        `;
        
        const candidates = await this.db.query(query);
        const recommendations = [];
        
        // 2. Calculate Profit for these generic recommendations
        for (const bike of candidates) {
            const fmvData = await this.valuationService.calculateFMV({
                brand: bike.brand,
                model: bike.model,
                year: bike.year,
                material: bike.frame_material
            }, {
                penalty: bike.condition_penalty || 0
            });

            if (fmvData) {
                const deliveryFee = 150; 
                const serviceFee = bike.price * 0.05;
                const totalCost = bike.price + deliveryFee + serviceFee;
                const profit = fmvData.finalPrice - totalCost;

                // Even if profit is small or negative (unlikely for top rank), we might want to show it?
                // For "Hot Offers" we prefer positive profit.
                if (profit > 0) {
                    recommendations.push({
                        ...bike,
                        fmv: fmvData.finalPrice,
                        estimatedProfit: Math.round(profit),
                        profitMargin: Math.round((profit / totalCost) * 100),
                        is_hot_deal: true // Mark as hot deal
                    });
                }
            }
        }
        
        // Sort by highest profit to be impressive
        recommendations.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
        
        // Return Top 3
        return recommendations.slice(0, 3);
    }
}

module.exports = RecommendationService;
