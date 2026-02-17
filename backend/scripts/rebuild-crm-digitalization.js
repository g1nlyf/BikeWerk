const { DatabaseManager } = require('../src/js/mysql-config');
const { ManagerKpiService } = require('../src/services/ManagerKpiService');

const ACTIVE_STATUSES = [
    'booked',
    'reserve_payment_pending',
    'reserve_paid',
    'seller_check_in_progress',
    'check_ready',
    'awaiting_client_decision',
    'full_payment_pending',
    'full_payment_received',
    'bike_buyout_completed',
    'seller_shipped',
    'expert_received',
    'expert_inspection_in_progress',
    'expert_report_ready',
    'awaiting_client_decision_post_inspection',
    'warehouse_received',
    'warehouse_repacked',
    'shipped_to_russia'
];

async function tableExists(db, tableName) {
    const rows = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1",
        [tableName]
    );
    return Boolean(rows && rows[0]);
}

async function backfillLeadMirror(db) {
    if (!(await tableExists(db, 'applications')) || !(await tableExists(db, 'leads'))) {
        return { inserted: 0, skipped: true };
    }

    const appColumns = await db.query('PRAGMA table_info(applications)');
    const appColumnSet = new Set((appColumns || []).map((col) => String(col.name || '').toLowerCase()));
    const hasCol = (name) => appColumnSet.has(String(name || '').toLowerCase());

    const sourceExpr = hasCol('source') ? 'a.source' : "'legacy_application'";
    const bikeExpr = hasCol('bike_url')
        ? (hasCol('bike_link') ? 'COALESCE(a.bike_url, a.bike_link)' : 'a.bike_url')
        : (hasCol('bike_link') ? 'a.bike_link' : 'NULL');
    const commentExpr = hasCol('customer_comment')
        ? (hasCol('notes') ? 'COALESCE(a.customer_comment, a.notes)' : 'a.customer_comment')
        : (hasCol('notes') ? 'a.notes' : (hasCol('application_notes') ? 'a.application_notes' : 'NULL'));
    const statusExpr = hasCol('status') ? 'a.status' : "'new'";
    const contactMethodExpr = hasCol('contact_method')
        ? 'a.contact_method'
        : (hasCol('preferred_contact')
            ? `CASE
                    WHEN COALESCE(a.preferred_contact, '') <> '' THEN a.preferred_contact
                    WHEN COALESCE(a.contact_email, '') <> '' THEN 'email'
                    WHEN COALESCE(a.contact_phone, '') <> '' THEN 'phone'
                    ELSE 'whatsapp'
               END`
            : `CASE
                    WHEN COALESCE(a.contact_email, '') <> '' THEN 'email'
                    WHEN COALESCE(a.contact_phone, '') <> '' THEN 'phone'
                    ELSE 'whatsapp'
               END`);
    const contactValueExpr = hasCol('contact_value')
        ? (hasCol('contact_email') && hasCol('contact_phone')
            ? 'COALESCE(a.contact_value, a.contact_email, a.contact_phone)'
            : 'a.contact_value')
        : (hasCol('contact_email') && hasCol('contact_phone')
            ? 'COALESCE(a.contact_email, a.contact_phone)'
            : (hasCol('contact_email') ? 'a.contact_email' : (hasCol('contact_phone') ? 'a.contact_phone' : 'NULL')));
    const createdExpr = hasCol('created_at') ? 'a.created_at' : 'CURRENT_TIMESTAMP';
    const updatedExpr = hasCol('updated_at') ? 'a.updated_at' : (hasCol('created_at') ? 'a.created_at' : 'CURRENT_TIMESTAMP');

    await db.query(
        `INSERT OR IGNORE INTO leads
         (id, source, bike_url, customer_comment, status, contact_method, contact_value, created_at, updated_at)
         SELECT
            CAST(a.id AS TEXT),
            COALESCE(${sourceExpr}, 'legacy_application'),
            ${bikeExpr},
            ${commentExpr},
            COALESCE(${statusExpr}, 'new'),
            COALESCE(${contactMethodExpr}, 'whatsapp'),
            ${contactValueExpr},
            COALESCE(${createdExpr}, CURRENT_TIMESTAMP),
            COALESCE(${updatedExpr}, ${createdExpr}, CURRENT_TIMESTAMP)
         FROM applications a`
    );

    const rows = await db.query(
        `SELECT COUNT(*) AS c
         FROM leads
         WHERE source = 'legacy_application'`
    );
    return { inserted: Number(rows?.[0]?.c || 0), skipped: false };
}

async function backfillJourneyAndStages(db) {
    await db.query(
        `INSERT INTO crm_journey_events
         (id, order_id, customer_id, lead_id, manager_id, event_type, stage_code, to_status, source, payload, event_at, created_at)
         SELECT
            'CJE-BACKFILL-' || lower(hex(randomblob(8))),
            o.id,
            o.customer_id,
            o.lead_id,
            o.assigned_manager,
            'order_created',
            o.status,
            o.status,
            'rebuild_script',
            'backfilled_order_created',
            COALESCE(o.created_at, CURRENT_TIMESTAMP),
            CURRENT_TIMESTAMP
         FROM orders o
         WHERE NOT EXISTS (
            SELECT 1
            FROM crm_journey_events e
            WHERE e.order_id = o.id
              AND e.event_type = 'order_created'
         )`
    );

    await db.query(
        `INSERT INTO crm_order_stage_instances
         (id, order_id, status_code, manager_id, entered_at, sla_transition_hours, sla_due_at, created_at, updated_at)
         SELECT
            'CSI-BACKFILL-' || lower(hex(randomblob(8))),
            o.id,
            o.status,
            o.assigned_manager,
            COALESCE(o.status_entered_at, o.updated_at, o.created_at, CURRENT_TIMESTAMP),
            p.transition_hours,
            CASE
                WHEN p.transition_hours IS NOT NULL
                    THEN datetime(COALESCE(o.status_entered_at, o.updated_at, o.created_at, CURRENT_TIMESTAMP), '+' || p.transition_hours || ' hours')
                ELSE NULL
            END,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
         FROM orders o
         LEFT JOIN crm_sla_policies p
            ON p.scope = 'order_status'
           AND p.scope_key = o.status
           AND p.is_active = 1
         WHERE NOT EXISTS (
            SELECT 1
            FROM crm_order_stage_instances s
            WHERE s.order_id = o.id
              AND s.exited_at IS NULL
         )`
    );

    await db.query(
        `INSERT INTO crm_journey_events
         (id, order_id, customer_id, lead_id, manager_id, event_type, stage_code, from_status, to_status, source, payload, event_at, created_at)
         SELECT
            'CJE-HISTORY-' || lower(hex(randomblob(8))),
            ose.order_id,
            o.customer_id,
            o.lead_id,
            COALESCE(ose.changed_by, o.assigned_manager),
            'status_changed',
            ose.new_status,
            ose.old_status,
            ose.new_status,
            'order_status_events_backfill',
            COALESCE(ose.change_notes, ''),
            COALESCE(ose.created_at, CURRENT_TIMESTAMP),
            CURRENT_TIMESTAMP
         FROM order_status_events ose
         LEFT JOIN orders o ON o.id = ose.order_id
         WHERE NOT EXISTS (
            SELECT 1
            FROM crm_journey_events e
            WHERE e.order_id = ose.order_id
              AND e.event_type = 'status_changed'
              AND COALESCE(e.to_status, '') = COALESCE(ose.new_status, '')
              AND datetime(COALESCE(e.event_at, CURRENT_TIMESTAMP)) = datetime(COALESCE(ose.created_at, CURRENT_TIMESTAMP))
         )`
    );
}

async function backfillManagerActivity(db) {
    await db.query(
        `INSERT INTO manager_activity_events
         (id, manager_id, order_id, event_type, event_payload, event_at, created_at, updated_at)
         SELECT
            'MAE-BACKFILL-' || lower(hex(randomblob(8))),
            CAST(ose.changed_by AS TEXT),
            ose.order_id,
            'status_change',
            COALESCE(ose.change_notes, ''),
            COALESCE(ose.created_at, CURRENT_TIMESTAMP),
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
         FROM order_status_events ose
         WHERE ose.changed_by IS NOT NULL
           AND NOT EXISTS (
                SELECT 1
                FROM manager_activity_events m
                WHERE CAST(m.manager_id AS TEXT) = CAST(ose.changed_by AS TEXT)
                  AND m.order_id = ose.order_id
                  AND m.event_type = 'status_change'
                  AND datetime(COALESCE(m.event_at, CURRENT_TIMESTAMP)) = datetime(COALESCE(ose.created_at, CURRENT_TIMESTAMP))
           )`
    );
}

async function refreshStallFlags(db) {
    const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
    await db.query(
        `UPDATE orders
         SET is_stalled = CASE
                WHEN status IN (${placeholders})
                     AND datetime(COALESCE(last_activity_at, updated_at, created_at, CURRENT_TIMESTAMP)) < datetime('now', '-72 hours')
                    THEN 1
                ELSE 0
             END,
             stalled_since = CASE
                WHEN status IN (${placeholders})
                     AND datetime(COALESCE(last_activity_at, updated_at, created_at, CURRENT_TIMESTAMP)) < datetime('now', '-72 hours')
                    THEN COALESCE(stalled_since, datetime('now'))
                ELSE NULL
             END`,
        [...ACTIVE_STATUSES, ...ACTIVE_STATUSES]
    );
}

async function main() {
    const db = new DatabaseManager();
    await db.initialize();

    console.log('[CRM Digitalization] Starting rebuild...');

    const leadBackfill = await backfillLeadMirror(db);
    await backfillJourneyAndStages(db);
    await backfillManagerActivity(db);
    await refreshStallFlags(db);

    const kpiService = new ManagerKpiService(db);
    const kpiResult = await kpiService.recomputeRecent(45);

    const [journeyCountRows, stageCountRows, touchpointCountRows, scorecardCountRows] = await Promise.all([
        db.query('SELECT COUNT(*) AS c FROM crm_journey_events'),
        db.query('SELECT COUNT(*) AS c FROM crm_order_stage_instances'),
        db.query('SELECT COUNT(*) AS c FROM crm_touchpoints'),
        db.query('SELECT COUNT(*) AS c FROM manager_kpi_period_scorecards')
    ]);

    console.log('[CRM Digitalization] Done.');
    console.log(JSON.stringify({
        leadBackfill,
        kpiResult,
        totals: {
            journeyEvents: Number(journeyCountRows?.[0]?.c || 0),
            stageInstances: Number(stageCountRows?.[0]?.c || 0),
            touchpoints: Number(touchpointCountRows?.[0]?.c || 0),
            scorecards: Number(scorecardCountRows?.[0]?.c || 0)
        }
    }, null, 2));

    await db.close();
}

main().catch((error) => {
    console.error('[CRM Digitalization] Failed:', error);
    process.exitCode = 1;
});
