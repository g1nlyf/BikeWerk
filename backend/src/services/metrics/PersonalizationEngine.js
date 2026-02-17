class PersonalizationEngine {
    constructor(db, options = {}) {
        this.db = db;
        this.metricsPipeline = options.metricsPipeline;
        this.experimentEngine = options.experimentEngine;
        this.geminiClient = options.geminiClient || null;
    }

    pickValidImage(mainImage, imagesCsv) {
        const images = String(imagesCsv || '')
            .split(',')
            .map((x) => x.trim())
            .filter((x) => x && x.startsWith('http'));

        if (mainImage && String(mainImage).startsWith('http')) return mainImage;
        return images[0] || mainImage || null;
    }

    topKeys(mapObj = {}, limit = 3) {
        return Object.entries(mapObj || {})
            .map(([key, value]) => ({ key: String(key), value: Number(value || 0) }))
            .filter((row) => row.key && Number.isFinite(row.value) && row.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, Math.max(1, limit))
            .map((row) => row.key);
    }

    budgetRange(cluster) {
        const key = String(cluster || '').toLowerCase();
        if (key === 'budget') return { min: 0, max: 1400 };
        if (key === 'value') return { min: 800, max: 2600 };
        if (key === 'mid') return { min: 1600, max: 4300 };
        if (key === 'premium') return { min: 2600, max: 6200 };
        if (key === 'ultra') return { min: 4500, max: 20000 };
        return null;
    }

    async queryCandidateSet(whereSql = '', params = [], limit = 180, orderSql = 'b.rank DESC') {
        const safeLimit = Math.max(20, Math.min(400, Number(limit || 180)));
        const sql = `SELECT
                b.*,
                GROUP_CONCAT(DISTINCT COALESCE(bi.local_path, bi.image_url) ORDER BY bi.image_order) as images,
                COALESCE(m.detail_clicks, 0) as detail_clicks,
                COALESCE(m.favorites, 0) as favorites,
                COALESCE(m.add_to_cart, 0) as add_to_cart
             FROM bikes b
             LEFT JOIN bike_images bi ON b.id = bi.bike_id
             LEFT JOIN bike_behavior_metrics m ON b.id = m.bike_id
             WHERE b.is_active = 1
               ${whereSql ? `AND (${whereSql})` : ''}
             GROUP BY b.id
             ORDER BY ${orderSql}
             LIMIT ?`;
        return this.db.query(sql, [...params, safeLimit]);
    }

    async buildCandidatePool(profile, assignments = {}) {
        const featureStore = profile?.featureStore || {};
        const disciplines = this.topKeys(featureStore?.disciplineEmbedding || profile?.disciplines || {}, 3);
        const brands = this.topKeys(featureStore?.brandEmbedding || profile?.brands || {}, 3);
        const budget = this.budgetRange(featureStore?.budgetCluster);
        const strategy = String(assignments?.recommendation_strategy || 'control');

        const jobs = [
            this.queryCandidateSet('', [], 240, 'b.rank DESC')
        ];

        if (disciplines.length > 0) {
            const placeholders = disciplines.map(() => '?').join(',');
            jobs.push(
                this.queryCandidateSet(
                    `COALESCE(NULLIF(TRIM(b.discipline), ''), TRIM(b.category)) IN (${placeholders})`,
                    disciplines,
                    220,
                    'b.rank DESC'
                )
            );
        }

        if (brands.length > 0) {
            const placeholders = brands.map(() => '?').join(',');
            jobs.push(
                this.queryCandidateSet(
                    `TRIM(b.brand) IN (${placeholders})`,
                    brands,
                    180,
                    'b.rank DESC'
                )
            );
        }

        if (budget) {
            jobs.push(
                this.queryCandidateSet(
                    'b.price >= ? AND b.price <= ?',
                    [budget.min, budget.max],
                    200,
                    'b.rank DESC'
                )
            );
        }

        // Explore arm keeps long-tail discoverability.
        if (strategy === 'explore') {
            jobs.push(this.queryCandidateSet('', [], 120, 'RANDOM()'));
        }

        const chunks = await Promise.all(jobs);
        const byId = new Map();
        for (const rows of chunks) {
            for (const row of rows || []) {
                const id = Number(row.id || 0);
                if (!Number.isFinite(id) || id <= 0) continue;
                if (!byId.has(id)) byId.set(id, row);
            }
        }

        return [...byId.values()].slice(0, 420);
    }

    scoreBike(bike, profile, variantByExperiment) {
        const disciplines = profile?.disciplines || {};
        const brands = profile?.brands || {};
        const featureStore = profile?.featureStore || {};
        const disciplineEmbedding = featureStore?.disciplineEmbedding || {};
        const brandEmbedding = featureStore?.brandEmbedding || {};
        const categoryEmbedding = featureStore?.categoryEmbedding || {};
        const weightedPrice = Number(profile?.priceSensitivity?.weightedAverage || 0);
        const budgetCluster = String(featureStore?.budgetCluster || 'unknown');
        const recencyDecay = Number(featureStore?.recencyDecay || 1);

        const discipline = String(bike.discipline || bike.category || '').trim();
        const brand = String(bike.brand || '').trim();
        const price = Number(bike.price || 0);

        const disciplineAffinity = Number(disciplineEmbedding[discipline] || disciplines[discipline] || 0);
        const brandAffinity = Number(brandEmbedding[brand] || brands[brand] || 0);
        const categoryAffinity = Number(categoryEmbedding[String(bike.category || '').trim()] || 0);
        const behavior = Number(bike.detail_clicks || 0) * 4 + Number(bike.favorites || 0) * 12 + Number(bike.add_to_cart || 0) * 20;

        let priceFit = 0;
        if (weightedPrice > 0 && price > 0) {
            const delta = Math.abs(price - weightedPrice) / weightedPrice;
            priceFit = Math.max(0, 100 - (delta * 100));
        }

        if (price > 0) {
            if (budgetCluster === 'budget' && price <= 1200) priceFit += 15;
            if (budgetCluster === 'value' && price >= 900 && price <= 2400) priceFit += 15;
            if (budgetCluster === 'mid' && price >= 1800 && price <= 4200) priceFit += 15;
            if (budgetCluster === 'premium' && price >= 3000 && price <= 5600) priceFit += 15;
            if (budgetCluster === 'ultra' && price >= 4800) priceFit += 15;
        }

        let score =
            Number(bike.rank || bike.ranking_score || 0) * 20 +
            disciplineAffinity * 120 +
            brandAffinity * 95 +
            categoryAffinity * 80 +
            behavior * 0.8 +
            priceFit * 0.25;

        // Optional experiment-based behavior.
        const strategy = variantByExperiment.recommendation_strategy;
        if (strategy === 'explore') {
            score += Math.random() * 8;
        }
        if (strategy === 'high_intent') {
            score += Number(bike.add_to_cart || 0) * 8;
        }

        score *= Math.max(0.4, Math.min(1.2, recencyDecay + 0.25));

        return score;
    }

    diversifyRanking(rows = []) {
        const output = [];
        const brandSeen = new Map();
        const disciplineSeen = new Map();

        const sorted = [...rows];
        sorted.sort((a, b) => Number(b._score || 0) - Number(a._score || 0));

        for (const bike of sorted) {
            const brand = String(bike.brand || '').trim() || 'unknown_brand';
            const discipline = String(bike.discipline || bike.category || '').trim() || 'unknown_discipline';
            const brandRepeat = Number(brandSeen.get(brand) || 0);
            const disciplineRepeat = Number(disciplineSeen.get(discipline) || 0);

            // Penalize heavy repetition to keep top-N block diverse.
            const penalty = (brandRepeat * 1.8) + (disciplineRepeat * 1.2);
            const adjustedScore = Number(bike._score || 0) - penalty;
            output.push({
                ...bike,
                _diversifiedScore: adjustedScore
            });

            brandSeen.set(brand, brandRepeat + 1);
            disciplineSeen.set(discipline, disciplineRepeat + 1);
        }

        output.sort((a, b) => Number(b._diversifiedScore || 0) - Number(a._diversifiedScore || 0));
        return output.map((bike) => {
            const clean = { ...bike };
            delete clean._diversifiedScore;
            return clean;
        });
    }

    async maybeGeminiRerank(bikes, profile) {
        if (!this.geminiClient || bikes.length === 0) return bikes;
        if (String(process.env.ENABLE_GEMINI_PERSONALIZATION || '0') !== '1') return bikes;

        const compact = bikes.slice(0, 20).map((bike) => ({
            id: bike.id,
            brand: bike.brand,
            discipline: bike.discipline || bike.category || null,
            price: bike.price,
            rank: bike.rank,
            score: bike._score
        }));

        const prompt = [
            'Return JSON only: {"ids":[...]}',
            'Re-rank bike ids for this profile (intent-first, then price-fit).',
            `Profile: ${JSON.stringify(profile || {})}`,
            `Candidates: ${JSON.stringify(compact)}`
        ].join('\n');

        try {
            const result = await this.geminiClient.generateContent(prompt);
            const text = typeof result === 'string' ? result : (result?.text || '');
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start < 0 || end <= start) return bikes;
            const parsed = JSON.parse(text.slice(start, end + 1));
            const ids = Array.isArray(parsed.ids) ? parsed.ids.map((x) => Number(x)) : [];
            if (ids.length === 0) return bikes;

            const byId = new Map(bikes.map((b) => [Number(b.id), b]));
            const reranked = [];
            for (const id of ids) {
                if (byId.has(id)) reranked.push(byId.get(id));
            }
            for (const bike of bikes) {
                if (!ids.includes(Number(bike.id))) reranked.push(bike);
            }
            return reranked;
        } catch (_) {
            return bikes;
        }
    }

    async getPersonalizedRecommendations(payload = {}, context = {}) {
        const limit = Math.max(1, Math.min(60, Number(payload.limit || 24)));
        const offset = Math.max(0, Number(payload.offset || 0));

        const profile = payload.profile || (this.metricsPipeline
            ? await this.metricsPipeline.getProfile({ userId: context.userId, sessionId: context.sessionId })
            : null);

        const assignments = this.experimentEngine
            ? await this.experimentEngine.getAssignments({ userId: context.userId, sessionId: context.sessionId })
            : {};

        const rows = await this.buildCandidatePool(profile, assignments);

        const scored = rows.map((bike) => {
            const score = this.scoreBike(bike, profile, assignments);
            const image = this.pickValidImage(bike.main_image, bike.images);
            return {
                ...bike,
                image,
                main_image: image,
                _score: score
            };
        });

        const diversified = this.diversifyRanking(scored);
        const reranked = await this.maybeGeminiRerank(diversified, profile);

        const slice = reranked.slice(offset, offset + limit).map((bike) => {
            const clean = { ...bike };
            delete clean._score;
            return clean;
        });

        return {
            success: true,
            bikes: slice,
            profileUsed: profile || null,
            experiments: assignments,
            retrieval: {
                candidateCount: rows.length,
                strategy: String(assignments?.recommendation_strategy || 'control'),
                topDisciplines: this.topKeys(profile?.featureStore?.disciplineEmbedding || profile?.disciplines || {}, 3),
                topBrands: this.topKeys(profile?.featureStore?.brandEmbedding || profile?.brands || {}, 3),
                budgetCluster: String(profile?.featureStore?.budgetCluster || 'unknown')
            }
        };
    }
}

module.exports = {
    PersonalizationEngine
};
