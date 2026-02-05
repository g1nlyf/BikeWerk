class FeatureExtractor {
    static extractFeatures(bike) {
        const now = new Date();
        const created = new Date(bike.created_at || now);
        const hoursAlive = Math.max(0.1, (now - created) / (3600 * 1000));
        
        let discount_pct = 0;
        if (bike.fmv && bike.price) {
            discount_pct = ((bike.fmv - bike.price) / bike.fmv) * 100;
        }

        return {
            discount_pct,
            brand_tier: bike.tier || 3,
            model_avg_days_to_sell: bike.model_avg_days_to_sell || 30, // Should be injected or fetched
            days_listed: (now - created) / (24 * 3600 * 1000),
            views_velocity: (bike.views || 0) / hoursAlive,
            condition: bike.condition || 'good',
            size: bike.size || 'M'
        };
    }
}
module.exports = FeatureExtractor;
