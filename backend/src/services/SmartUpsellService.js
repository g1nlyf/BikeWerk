const { DatabaseManager } = require('../js/mysql-config.js');
const geminiProcessor = require('./geminiProcessor.js');

class SmartUpsellService {
    constructor(dbManager) {
        this.db = dbManager || new DatabaseManager();
    }

    async getUpsellRecommendations(bikeId) {
        // 1. Get Bike Details
        const bike = (await this.db.query("SELECT * FROM bikes WHERE id = ?", [bikeId]))[0];
        if (!bike) return null;

        // 2. Get Active Accessories
        const accessories = await this.db.query("SELECT * FROM accessories WHERE is_active = 1");

        // 3. AI Matching
        console.log(`[SmartUpsell] Matching accessories for ${bike.brand} ${bike.model}...`);
        const aiResult = await geminiProcessor.matchAccessories(bike, accessories);
        
        // 4. Enrich results
        const enrichedRecs = [];
        if (aiResult.recommendations) {
            for (const rec of aiResult.recommendations) {
                const acc = accessories.find(a => a.id === rec.id);
                if (acc) {
                    enrichedRecs.push({
                        ...acc,
                        reason: rec.reason
                    });
                }
            }
        }

        return {
            intro: aiResult.email_intro,
            recommendations: enrichedRecs
        };
    }
}

module.exports = { SmartUpsellService };
