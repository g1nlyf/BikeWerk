const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const TEST_DB_PATH = path.join(__dirname, 'test_metrics_platform.db');
process.env.DB_PATH = TEST_DB_PATH;

const { DatabaseManager } = require('../../src/js/mysql-config');
const { MetricsPipelineService } = require('../../src/services/metrics/MetricsPipelineService');
const { ExperimentEngine } = require('../../src/services/metrics/ExperimentEngine');
const { PersonalizationEngine } = require('../../src/services/metrics/PersonalizationEngine');

async function seedBikes(db) {
    await db.query(
        `INSERT INTO users (id, name, email, password, role)
         VALUES (?, ?, ?, ?, ?)`,
        [42, 'Metrics Test User', 'metrics-test@example.com', 'test-hash', 'user']
    );

    await db.query(
        `INSERT INTO bikes (name, brand, model, discipline, category, price, rank, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            'Trek Madone SL7', 'Trek', 'Madone', 'road', 'road', 2100, 0.9, 1,
            'Giant Reign', 'Giant', 'Reign', 'mtb', 'mtb', 4300, 0.95, 1,
            'Canyon Aeroad', 'Canyon', 'Aeroad', 'road', 'road', 5200, 0.8, 1
        ]
    );

    await db.query(
        `INSERT INTO bike_images (bike_id, image_url, image_order)
         VALUES (1, 'https://example.com/1.jpg', 1),
                (2, 'https://example.com/2.jpg', 1),
                (3, 'https://example.com/3.jpg', 1)`
    );

    await db.query(
        `INSERT INTO ab_experiments (experiment_key, name, variants_json, enabled)
         VALUES (?, ?, ?, 1)`,
        [
            'recommendation_strategy',
            'Recommendation Strategy',
            JSON.stringify([
                { name: 'control', weight: 50 },
                { name: 'high_intent', weight: 50 }
            ])
        ]
    );
}

describe('Metrics Platform - 4 Layers', function () {
    this.timeout(10000);

    let db;
    let pipeline;
    let experimentEngine;
    let personalizationEngine;

    before(async () => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }

        db = new DatabaseManager();
        await db.initialize();
        await seedBikes(db);

        pipeline = new MetricsPipelineService(db, {
            onBikeMetricsUpdated: async () => {
                // Not needed in this isolated suite.
            }
        });
        experimentEngine = new ExperimentEngine(db);
        personalizationEngine = new PersonalizationEngine(db, {
            metricsPipeline: pipeline,
            experimentEngine,
            geminiClient: null
        });
    });

    after(async () => {
        if (db) {
            await db.close();
        }
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    it('Part 1: Ingest normalizes events and updates aggregates', async () => {
        const result = await pipeline.ingestEvents(
            [
                { type: 'click', bikeId: 1, event_id: 'evt-1' },
                { type: 'click', bikeId: 1, event_id: 'evt-1' }, // duplicate
                { type: 'impression', bikeId: 1, event_id: 'evt-2' },
                { type: 'dwell', bikeId: 1, ms: 15000, event_id: 'evt-3' },
                { type: 'cart_add', bikeId: 1, event_id: 'evt-4' },
                { type: 'favorite', bikeId: 1, event_id: 'evt-5' }
            ],
            { source: 'test_stage_1', sessionId: 'session-1', userId: 42 }
        );

        expect(result.accepted).to.equal(5);
        expect(result.duplicateDropped).to.equal(1);
        expect(result.bikeUpdates).to.equal(1);

        const rows = await db.query('SELECT event_type FROM metric_events WHERE session_id = ? ORDER BY id ASC', ['session-1']);
        expect(rows.map((r) => r.event_type)).to.deep.equal([
            'detail_open',
            'impression',
            'dwell',
            'add_to_cart',
            'favorite'
        ]);

        const metrics = (await db.query('SELECT * FROM bike_behavior_metrics WHERE bike_id = ?', [1]))[0];
        expect(Number(metrics.detail_clicks)).to.equal(1);
        expect(Number(metrics.impressions)).to.equal(1);
        expect(Number(metrics.add_to_cart)).to.equal(1);
        expect(Number(metrics.favorites)).to.equal(1);
        expect(Number(metrics.dwell_time_ms)).to.equal(15000);

        const sessionFact = (await db.query('SELECT * FROM metrics_session_facts WHERE session_id = ?', ['session-1']))[0];
        expect(sessionFact).to.exist;
        expect(Number(sessionFact.event_count)).to.equal(5);
        expect(Number(sessionFact.product_views)).to.equal(1);
        expect(Number(sessionFact.add_to_cart)).to.equal(1);
    });

    it('Part 2: Profile layer links to ingest and builds behavior DNA', async () => {
        await pipeline.ingestEvents(
            [
                { type: 'favorite', bikeId: 1 },
                { type: 'add_to_cart', bikeId: 1 },
                { type: 'share', bikeId: 1 }
            ],
            { source: 'test_stage_2', sessionId: 'session-1', userId: 42 }
        );

        const profile = await pipeline.getProfile({ userId: 42, sessionId: 'session-1' });
        expect(profile).to.exist;
        expect(profile.disciplines.road).to.be.greaterThan(0);
        expect(profile.brands.Trek).to.be.greaterThan(0);
        expect(profile.priceSensitivity.weightedAverage).to.be.greaterThan(0);
        expect(profile.intentScore).to.be.greaterThan(0);
    });

    it('Part 3: Experiment layer assigns variants and tracks goals', async () => {
        const assignments = await experimentEngine.getAssignments({ userId: 42, sessionId: 'session-1' });
        expect(assignments).to.have.property('recommendation_strategy');

        await experimentEngine.trackGoal({
            experimentKey: 'recommendation_strategy',
            variant: assignments.recommendation_strategy,
            metricName: 'add_to_cart',
            bikeId: 1,
            userId: 42,
            sessionId: 'session-1',
            value: 1
        });

        const goals = await db.query(
            'SELECT * FROM ab_goal_events WHERE experiment_key = ? AND metric_name = ?',
            ['recommendation_strategy', 'add_to_cart']
        );
        expect(goals.length).to.be.greaterThan(0);
    });

    it('Part 3.1: Bandit layer builds constrained adaptive weights', async () => {
        await db.query(
            `INSERT INTO ab_assignments (experiment_key, subject_key, user_id, session_id, variant, assigned_at)
             VALUES
             ('recommendation_strategy', 'session:seed-a', 42, 'seed-a', 'control', datetime('now')),
             ('recommendation_strategy', 'session:seed-b', 42, 'seed-b', 'high_intent', datetime('now')),
             ('recommendation_strategy', 'session:seed-c', 42, 'seed-c', 'high_intent', datetime('now'))`
        );
        await db.query(
            `INSERT INTO ab_goal_events (experiment_key, variant, metric_name, bike_id, user_id, session_id, value, created_at)
             VALUES
             ('recommendation_strategy', 'high_intent', 'order', 1, 42, 'seed-b', 1, datetime('now')),
             ('recommendation_strategy', 'high_intent', 'add_to_cart', 1, 42, 'seed-c', 1, datetime('now'))`
        );

        const plan = await experimentEngine.computeBanditWeights(
            'recommendation_strategy',
            [
                { name: 'control', weight: 50 },
                { name: 'high_intent', weight: 50 }
            ],
            { minObservations: 1, controlFloor: 20, minWeight: 5 }
        );

        expect(plan.enabled).to.equal(true);
        const weightValues = Object.values(plan.weightsByVariant || {}).map((v) => Number(v || 0));
        expect(weightValues.reduce((s, v) => s + v, 0)).to.equal(100);
        expect(Number(plan.weightsByVariant?.control || 0)).to.be.greaterThanOrEqual(20);
    });

    it('Part 4: Final integration links ingest + profile + experiments + recommendation', async () => {
        const result = await personalizationEngine.getPersonalizedRecommendations(
            { limit: 5, offset: 0 },
            { userId: 42, sessionId: 'session-1' }
        );

        expect(result.success).to.equal(true);
        expect(result.bikes.length).to.be.greaterThan(0);
        expect(result.experiments).to.have.property('recommendation_strategy');
        expect(Number(result.retrieval?.candidateCount || 0)).to.be.greaterThan(0);

        // Profile strongly favors Trek road bike; it should surface first.
        expect(Number(result.bikes[0].id)).to.equal(1);
    });
});
