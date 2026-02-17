const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const TEST_DB_PATH = path.join(__dirname, 'test_metrics_funnel_contract.db');
process.env.DB_PATH = TEST_DB_PATH;

const { DatabaseManager } = require('../../src/js/mysql-config');
const { MetricsPipelineService } = require('../../src/services/metrics/MetricsPipelineService');
const { OperationalIntelligenceService } = require('../../src/services/metrics/OperationalIntelligenceService');

describe('Metrics Funnel Contract', function () {
    this.timeout(15000);

    let db;
    let pipeline;
    let ops;

    before(async () => {
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
        db = new DatabaseManager();
        await db.initialize();

        await db.query(
            `INSERT INTO users (id, name, email, password, role)
             VALUES (?, ?, ?, ?, ?)` ,
            [7, 'Contract User', 'contract-user@example.com', 'hash', 'user']
        );

        await db.query(
            `INSERT INTO bikes (id, name, brand, model, discipline, category, price, rank, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
            [
                1, 'Road Contract', 'Trek', 'Domane', 'road', 'road', 2200, 0.92, 1,
                2, 'MTB Contract', 'Giant', 'Trance', 'mtb', 'mtb', 3400, 0.88, 1
            ]
        );

        pipeline = new MetricsPipelineService(db, {
            onBikeMetricsUpdated: async () => { }
        });
        ops = new OperationalIntelligenceService(db, { geminiClient: null });
    });

    after(async () => {
        if (db) await db.close();
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    });

    it('keeps critical path contract: page -> product -> checkout -> booking', async () => {
        await pipeline.ingestEvents(
            [
                { type: 'page_view', source_path: '/catalog' },
                { type: 'catalog_view', source_path: '/catalog' },
                { type: 'product_view', bikeId: 1, source_path: '/product/1' },
                { type: 'checkout_start', source_path: '/guest-order' },
                { type: 'checkout_submit_attempt', source_path: '/guest-order' },
                { type: 'booking_success', bikeId: 1, source_path: '/booking-checkout/1/booking' },
                { type: 'order', bikeId: 1, source_path: '/booking-checkout/1/booking' }
            ],
            { sessionId: 'funnel-session-1', userId: 7, source: 'test_funnel_contract' }
        );

        const facts = await ops.getSessionFacts({ windowHours: 24, limit: 20, offset: 0 });
        const row = facts.rows.find((r) => r.sessionId === 'funnel-session-1');
        expect(row).to.exist;
        expect(Number(row.pageViews)).to.be.greaterThan(0);
        expect(Number(row.productViews)).to.be.greaterThan(0);
        expect(Number(row.checkoutSubmitAttempts)).to.be.greaterThan(0);
        expect(Number(row.bookingSuccess || row.orders)).to.be.greaterThan(0);
    });

    it('survives UI form schema changes and keeps checkout telemetry', async () => {
        await pipeline.ingestEvents(
            [
                { type: 'form_seen', metadata: { formId: 'v2-flow-form', stage: 'checkout' } },
                { type: 'form_first_input', metadata: { formId: 'v2-flow-form', stage: 'checkout' } },
                { type: 'form_validation_error', metadata: { formId: 'v2-flow-form', stage: 'checkout', field: 'phone', reason: 'pattern_mismatch', attempt_no: 1 } },
                { type: 'checkout_field_error', metadata: { formId: 'v2-flow-form', stage: 'checkout', field: 'phone', reason: 'pattern_mismatch', attempt_no: 1 } },
                { type: 'form_submit_attempt', metadata: { formId: 'v2-flow-form', stage: 'checkout', attempt_no: 2 } },
                { type: 'checkout_submit_attempt', metadata: { formId: 'v2-flow-form', stage: 'checkout', attempt_no: 2 } },
                { type: 'checkout_abandon', metadata: { formId: 'v2-flow-form', stage: 'checkout', reason: 'validation_unresolved' } }
            ],
            { sessionId: 'funnel-session-2', source: 'test_funnel_contract_v2' }
        );

        const overview = await ops.getCoreOverview({ windowHours: 24 });
        const hasPhoneField = (overview.checkoutTelemetry?.topErrorFields || []).some((row) => String(row.field) === 'phone');
        expect(hasPhoneField).to.equal(true);

        const checkoutStage = (overview.checkoutTelemetry?.stageLoss || []).find((row) => String(row.stage) === 'checkout');
        expect(checkoutStage).to.exist;
        expect(Number(checkoutStage.submitAttempts || 0)).to.be.greaterThan(0);
    });

    it('stitches identity across anon session, CRM lead and login', async () => {
        await pipeline.ingestEvents(
            [{ type: 'page_view' }],
            {
                sessionId: 'anon-identity-1',
                crmLeadId: 'LEAD-900',
                customerEmail: 'stitch-user@example.com',
                source: 'identity_phase_anon'
            }
        );

        await pipeline.ingestEvents(
            [{ type: 'checkout_submit_attempt' }],
            {
                sessionId: 'auth-identity-1',
                userId: 7,
                crmLeadId: 'LEAD-900',
                customerEmail: 'stitch-user@example.com',
                source: 'identity_phase_auth'
            }
        );

        const rows = await db.query(
            `SELECT DISTINCT person_key
             FROM metrics_identity_nodes
             WHERE (identity_type = 'session' AND identity_value IN (?, ?))
                OR (identity_type = 'crm_lead' AND identity_value = ?)
                OR (identity_type = 'user' AND identity_value = ?)`,
            ['anon-identity-1', 'auth-identity-1', 'LEAD-900', '7']
        );

        expect(rows.length).to.equal(1);
    });

    it('builds feature-store profile for ranking', async () => {
        await pipeline.ingestEvents(
            [
                { type: 'detail_open', bikeId: 1 },
                { type: 'add_to_cart', bikeId: 1 },
                { type: 'favorite', bikeId: 1 },
                { type: 'detail_open', bikeId: 2 }
            ],
            {
                sessionId: 'auth-identity-1',
                userId: 7,
                crmLeadId: 'LEAD-900',
                source: 'feature_store_phase'
            }
        );

        const featureRows = await db.query('SELECT * FROM metrics_feature_store LIMIT 5');
        expect(featureRows.length).to.be.greaterThan(0);
        const fsRow = featureRows[0];
        expect(String(fsRow.budget_cluster || '')).to.not.equal('');

        const brandEmbedding = fsRow.brand_embedding_json ? JSON.parse(fsRow.brand_embedding_json) : {};
        const disciplineEmbedding = fsRow.discipline_embedding_json ? JSON.parse(fsRow.discipline_embedding_json) : {};
        expect(Object.keys(brandEmbedding).length + Object.keys(disciplineEmbedding).length).to.be.greaterThan(0);
    });

    it('raises funnel-contract violation on malformed critical event', async () => {
        const result = await pipeline.ingestEvents(
            [
                { type: 'checkout_submit_attempt' }
            ],
            { sessionId: 'funnel-session-malformed', source: 'contract_violation_test' }
        );

        expect(result).to.have.property('funnelContract');
        expect(Number(result.funnelContract.violationsTotal || 0)).to.be.greaterThan(0);
    });
});
