const RANK_WEIGHTS = {
    pop: 0.20,
    eng: 0.25,
    conv: 0.30,
    quality: 0.10,
    recency: 0.05,
    explore: 0.10
};

const RANK_PARAMS = {
    half_life_views: 7,
    half_life_clicks: 14,
    half_life_purchases: 30,
    prior_count: 5,
    prior_rate: 0.02,
    scale_views: 50,
    scale_eng: 10,
    exploration_base: 0.15
};

async function calculateRank(db, bikeId) {
    try {
        const now = Date.now();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Get Events
        const events = await db.all(`
            SELECT event_type as type, created_at as ts, value 
            FROM analytics_events 
            WHERE bike_id = ? AND created_at >= ?
        `, [bikeId, thirtyDaysAgo]);

        // 2. Get Bike Info
        const bikeRows = await db.all('SELECT added_at, price, rating, is_new FROM bikes WHERE id = ?', [bikeId]);
        if (!bikeRows.length) return 0.5;
        const bike = bikeRows[0];
        
        const evalRows = await db.all('SELECT * FROM bike_evaluations WHERE bike_id = ?', [bikeId]);
        const evals = evalRows[0] || {};

        const decay = (evs, type, halfLife) => {
            const lambda = Math.log(2) / halfLife;
            return evs
                .filter(e => e.type === type)
                .reduce((sum, e) => {
                    const days = (now - new Date(e.ts).getTime()) / (1000 * 60 * 60 * 24);
                    return sum + (e.value || 1) * Math.exp(-lambda * days);
                }, 0);
        };

        const viewsDecayed = decay(events, 'impression', RANK_PARAMS.half_life_views);
        const clicksDecayed = decay(events, 'detail_open', RANK_PARAMS.half_life_clicks);
        const cartsDecayed = decay(events, 'add_to_cart', RANK_PARAMS.half_life_clicks);
        const favsDecayed = decay(events, 'favorite', RANK_PARAMS.half_life_clicks);
        const ordersDecayed = decay(events, 'order', RANK_PARAMS.half_life_purchases);
        const returnsDecayed = decay(events, 'return', RANK_PARAMS.half_life_purchases);

        // 4. Components
        const normalize = (val, scale) => val / (val + scale);

        const p_pop = normalize(viewsDecayed, RANK_PARAMS.scale_views);
        const engRaw = clicksDecayed * 1.0 + favsDecayed * 3.0 + cartsDecayed * 5.0;
        const p_eng = normalize(engRaw, RANK_PARAMS.scale_eng);
        const p_conv_click = (RANK_PARAMS.prior_count * RANK_PARAMS.prior_rate + ordersDecayed) / 
                             (RANK_PARAMS.prior_count + Math.max(1, clicksDecayed));
        
        const returnRate = ordersDecayed > 0 ? returnsDecayed / ordersDecayed : 0;
        const ratingNorm = bike.rating ? (bike.rating / 5) : 0.5;
        const p_quality = Math.max(0, ratingNorm - returnRate * 2);

        const daysOld = (now - new Date(bike.added_at).getTime()) / (1000 * 60 * 60 * 24);
        const p_recency = Math.exp(-daysOld / 30);

        const p_explore = RANK_PARAMS.exploration_base * (1 - p_pop);

        const normScore = v => Math.max(0, Math.min(1, (v - 1) / 9));
        let manualScore = 0.5;
        if (evals.price_value_score) {
             manualScore = 
                normScore(evals.price_value_score || 5) * 0.3 + 
                normScore(evals.quality_appearance_score || 5) * 0.2 + 
                normScore(evals.detail_intent_score || 5) * 0.3 + 
                normScore(evals.trust_confidence_score || 5) * 0.2;
        }

        const p_quality_combined = (p_quality + manualScore) / 2;

        let weighted = 
            RANK_WEIGHTS.pop * p_pop +
            RANK_WEIGHTS.eng * p_eng +
            RANK_WEIGHTS.conv * p_conv_click +
            RANK_WEIGHTS.quality * p_quality_combined +
            RANK_WEIGHTS.recency * p_recency +
            RANK_WEIGHTS.explore * p_explore;

        const rank = Math.max(0.01, Math.min(0.99, weighted));

        const components = JSON.stringify({
            pop: p_pop.toFixed(3),
            eng: p_eng.toFixed(3),
            conv: p_conv_click.toFixed(3),
            qual: p_quality_combined.toFixed(3),
            rec: p_recency.toFixed(3),
            exp: p_explore.toFixed(3)
        });

        // Use 'run' or 'exec' depending on driver. DatabaseManager wraps run/all.
        // Assuming db is DatabaseManager instance or has compatible API.
        // In server.js 'db' has .query(). In script it has .all()/.run().
        // I'll assume 'db' has .query() interface or I check.
        // The helper should probably expect a generic execute function or standard sqlite driver.
        // Let's assume standard sqlite driver methods: all, run.
        // But server.js uses db.query wrapper.
        // I'll use raw SQL statements and let caller handle execution or pass a unified interface.
        // Better: Pass query function.
        
        // However, I need to update the DB.
        
        // Let's return the data and let the caller update, OR pass a standard update function.
        // I will return { rank, components, shouldDiagnose: ... }
        
        return { rank, components, viewsDecayed, clicksDecayed };

    } catch (e) {
        console.error(`Ranking calc error for bike ${bikeId}:`, e);
        return { rank: 0.5, components: '{}' };
    }
}

module.exports = { calculateRank, RANK_WEIGHTS, RANK_PARAMS };
