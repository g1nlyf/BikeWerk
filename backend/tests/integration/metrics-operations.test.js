const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const TEST_DB_PATH = path.join(__dirname, 'test_metrics_operations.db');
process.env.DB_PATH = TEST_DB_PATH;

const { DatabaseManager } = require('../../src/js/mysql-config');
const { OperationalIntelligenceService } = require('../../src/services/metrics/OperationalIntelligenceService');

describe('Metrics Operations - Production Layer', function () {
    this.timeout(10000);

    let db;
    let ops;

    before(async () => {
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
        db = new DatabaseManager();
        await db.initialize();

        await db.query(
            `INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`,
            [11, 'Ops User', 'ops-user@example.com', 'hash', 'admin']
        );

        await db.query(
            `INSERT INTO bikes (id, name, brand, model, discipline, category, price, rank, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                1, 'Road 1', 'Trek', 'Madone', 'road', 'road', 2100, 0.9, 1,
                2, 'MTB 1', 'Giant', 'Reign', 'mtb', 'mtb', 3500, 0.8, 1
            ]
        );

        await db.query(
            `INSERT INTO metric_events (bike_id, event_type, created_at, session_id, source_path, referrer, user_id)
             VALUES
             (1, 'impression', datetime('now'), 's1', '/catalog', 'https://google.com', 11),
             (1, 'detail_open', datetime('now'), 's1', '/product/1', 'https://google.com', 11),
             (1, 'add_to_cart', datetime('now'), 's1', '/product/1', 'https://google.com', 11),
             (1, 'order', datetime('now'), 's1', '/checkout', 'https://google.com', 11),
             (2, 'impression', datetime('now'), 's2', '/catalog', 'https://bing.com', 11)`
        );

        await db.query(
            `INSERT INTO metric_events (bike_id, event_type, metadata, created_at, session_id, source_path, user_id)
             VALUES
             (NULL, 'web_vital', ?, datetime('now'), 's1', '/catalog', 11),
             (NULL, 'web_vital', ?, datetime('now'), 's1', '/catalog', 11),
             (NULL, 'api_latency', ?, datetime('now'), 's1', '/catalog', 11),
             (NULL, 'api_latency', ?, datetime('now'), 's1', '/catalog', 11)`,
            [
                JSON.stringify({ name: 'LCP', value: 2100, path: '/catalog' }),
                JSON.stringify({ name: 'CLS', value: 0.07, path: '/catalog' }),
                JSON.stringify({ path: '/catalog/bikes', method: 'GET', status: 200, duration_ms: 220 }),
                JSON.stringify({ path: '/admin/stats', method: 'GET', status: 500, duration_ms: 1040 })
            ]
        );

        await db.query(
            `INSERT INTO metrics_session_facts (
                session_id, user_id, first_seen_at, last_seen_at, event_count, page_views, first_clicks,
                catalog_views, product_views, add_to_cart, checkout_submit_attempts, booking_success, orders,
                first_source_path, last_source_path, utm_source, utm_medium
            ) VALUES (?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['s1', 11, 12, 3, 1, 1, 1, 1, 1, 1, 1, '/catalog', '/checkout', 'google', 'cpc']
        );

        await db.query(
            `INSERT INTO metrics_anomalies (anomaly_key, severity, metric_name, baseline_value, current_value, delta_pct, details, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))`,
            ['seed_warning', 'warning', 'events_per_hour', 120, 40, -66.7, JSON.stringify({ source: 'test' })]
        );

        await db.query(
            `INSERT INTO user_interest_profiles (profile_key, user_id, session_id, disciplines_json, brands_json, weighted_price, intent_score, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            ['user:11', 11, 's1', JSON.stringify({ road: 120, mtb: 15 }), JSON.stringify({ Trek: 90 }), 2300, 280]
        );

        await db.query(
            `INSERT INTO ab_experiments (experiment_key, name, variants_json, enabled)
             VALUES (?, ?, ?, 1)`,
            ['recommendation_strategy', 'Recommendation Strategy', JSON.stringify([
                { name: 'control', weight: 50 },
                { name: 'high_intent', weight: 50 }
            ])]
        );

        const assignmentInsert = [];
        for (let i = 0; i < 160; i++) {
            assignmentInsert.push(`('recommendation_strategy', 'sub_control_${i}', 11, 's1', 'control', datetime('now'))`);
        }
        for (let i = 0; i < 170; i++) {
            assignmentInsert.push(`('recommendation_strategy', 'sub_variant_${i}', 11, 's1', 'high_intent', datetime('now'))`);
        }
        await db.query(
            `INSERT INTO ab_assignments (experiment_key, subject_key, user_id, session_id, variant, assigned_at)
             VALUES ${assignmentInsert.join(',')}`
        );

        await db.query(
            `INSERT INTO ab_goal_events (experiment_key, variant, metric_name, bike_id, user_id, session_id, value, created_at)
             VALUES
             ('recommendation_strategy', 'control', 'add_to_cart', 1, 11, 's1', 10, datetime('now')),
             ('recommendation_strategy', 'control', 'order', 1, 11, 's1', 2, datetime('now')),
             ('recommendation_strategy', 'high_intent', 'add_to_cart', 1, 11, 's1', 38, datetime('now')),
             ('recommendation_strategy', 'high_intent', 'order', 1, 11, 's1', 14, datetime('now'))`
        );

        ops = new OperationalIntelligenceService(db, { geminiClient: null });
    });

    after(async () => {
        if (db) await db.close();
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    });

    it('builds operational overview with health, funnel and experiments', async () => {
        const overview = await ops.getCoreOverview({ windowHours: 24 });
        expect(overview.success).to.equal(true);
        expect(Number(overview.health.eventsTotal)).to.be.greaterThan(0);
        expect(Number(overview.funnel.order)).to.be.greaterThan(0);
        expect(Array.isArray(overview.experiments.list)).to.equal(true);
        expect(overview.experiments.list.length).to.be.greaterThan(0);
        expect(overview.profiles.total).to.be.greaterThan(0);
        expect(overview).to.have.property('acquisition');
        expect(overview).to.have.property('performance');
        expect(overview).to.have.property('sessionFacts');
        expect(overview).to.have.property('funnelContract');
        expect(overview).to.have.property('churn');
        expect(Array.isArray(overview.anomalies)).to.equal(true);
    });

    it('refreshes profile insights with heuristic engine', async () => {
        const result = await ops.refreshProfileInsights({ limit: 10, force: true });
        expect(result.success).to.equal(true);
        expect(result.updated).to.be.greaterThan(0);

        const rows = await db.query('SELECT insight_text, insight_model FROM user_interest_profiles WHERE profile_key = ?', ['user:11']);
        expect(rows[0].insight_text).to.be.a('string');
        expect(rows[0].insight_model).to.equal('heuristic');
    });

    it('auto-optimizer applies fallback reweight when guardrails degrade', async () => {
        const preview = await ops.autoOptimizeExperiments({ dryRun: true, windowDays: 14, minAssignments: 120 });
        expect(preview.success).to.equal(true);
        const previewDecision = preview.decisions.find((d) => d.experimentKey === 'recommendation_strategy');
        expect(previewDecision).to.exist;
        expect(preview).to.have.property('guardrails');
        expect(previewDecision.action).to.match(/fallback|preview_fallback/);

        const applied = await ops.autoOptimizeExperiments({ dryRun: false, windowDays: 14, minAssignments: 120 });
        expect(applied.success).to.equal(true);

        const rows = await db.query('SELECT variants_json FROM ab_experiments WHERE experiment_key = ?', ['recommendation_strategy']);
        const variants = JSON.parse(rows[0].variants_json);
        const control = variants.find((v) => v.name === 'control');
        expect(Number(control.weight)).to.equal(80);
    });

    it('returns session-facts list and can run anomaly detector', async () => {
        const facts = await ops.getSessionFacts({ windowHours: 24, limit: 10, offset: 0 });
        expect(facts.success).to.equal(true);
        expect(Array.isArray(facts.rows)).to.equal(true);
        expect(facts.rows.length).to.be.greaterThan(0);

        const anomalyRun = await ops.detectAndStoreAnomalies({ lookbackHours: 24, baselineHours: 12 });
        expect(anomalyRun.success).to.equal(true);
        expect(Array.isArray(anomalyRun.created)).to.equal(true);
    });

    it('evaluates funnel contract, churn risk and replay simulation', async () => {
        const contract = await ops.checkFunnelContract({ windowHours: 24, minCoveragePct: 70 });
        expect(contract.success).to.equal(true);
        expect(Array.isArray(contract.checks)).to.equal(true);

        const churn = await ops.buildChurnInsights({ windowHours: 24, limit: 50 });
        expect(churn.summary).to.have.property('totalEvaluated');
        expect(Array.isArray(churn.topAtRiskSessions)).to.equal(true);

        const replay = await ops.runReplaySimulation({ windowDays: 14, minAssignments: 60, strategy: 'causal_best' });
        expect(replay.success).to.equal(true);
        expect(Array.isArray(replay.experiments)).to.equal(true);
    });
});
