const DAY_MS = 24 * 60 * 60 * 1000;

const METRIC_CONFIG = Object.freeze({
    booked_to_full_payment_rate: { target: 0.45, weight: 0.22, mode: 'higher_better', bucket: 'conversion' },
    full_payment_to_delivered_rate: { target: 0.9, weight: 0.23, mode: 'higher_better', bucket: 'conversion' },
    first_contact_sla_hit_rate: { target: 0.95, weight: 0.15, mode: 'higher_better', bucket: 'sla' },
    response_sla_hit_rate: { target: 0.9, weight: 0.1, mode: 'higher_better', bucket: 'sla' },
    stage_transition_sla_hit_rate: { target: 0.9, weight: 0.1, mode: 'higher_better', bucket: 'sla' },
    tension_sla_hit_rate: { target: 0.9, weight: 0.05, mode: 'higher_better', bucket: 'sla' },
    stale_orders_ratio: { target: 0.08, weight: 0.08, mode: 'lower_better', bucket: 'reliability' },
    tension_backlog_ratio: { target: 0.15, weight: 0.05, mode: 'lower_better', bucket: 'reliability' },
    complaint_rate: { target: 0.05, weight: 0.06, mode: 'lower_better', bucket: 'quality' },
    post_delivery_support_touchpoints: { target: 1.5, weight: 0.06, mode: 'higher_better', bucket: 'quality' }
});

function dayKeyFromDate(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function monthKeyFromDay(dayKey) {
    return String(dayKey || '').slice(0, 7);
}

function isoRangeFromDayKey(dayKey) {
    const start = new Date(`${dayKey}T00:00:00.000Z`);
    const end = new Date(start.getTime() + DAY_MS);
    return {
        fromIso: start.toISOString(),
        toIso: end.toISOString()
    };
}

function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeDiv(numerator, denominator, fallback = 0) {
    const den = Number(denominator || 0);
    if (!Number.isFinite(den) || den <= 0) return fallback;
    const num = Number(numerator || 0);
    if (!Number.isFinite(num)) return fallback;
    return num / den;
}

function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

function completionRatio(metricCode, actualValue, targetValue) {
    const cfg = METRIC_CONFIG[metricCode];
    const target = Number(targetValue || 0);
    const actual = Number(actualValue || 0);
    if (!cfg || !Number.isFinite(actual) || target <= 0) return 0;

    if (cfg.mode === 'lower_better') {
        if (actual <= 0) return 1.2;
        return clamp(target / actual, 0, 1.2);
    }

    return clamp(actual / target, 0, 1.2);
}

function payoutMultiplier(scorePct) {
    const score = Number(scorePct || 0);
    if (score >= 105) return 1.2;
    if (score >= 90) return 1.1;
    if (score >= 75) return 1.0;
    if (score >= 60) return 0.9;
    return 0.8;
}

class ManagerKpiService {
    constructor(db) {
        this.db = db;
    }

    async getManagerIds() {
        const [userRows, profileRows] = await Promise.all([
            this.db.query("SELECT CAST(id AS TEXT) as id FROM users WHERE role IN ('manager', 'admin')"),
            this.db.query("SELECT CAST(user_id AS TEXT) as id FROM manager_profiles WHERE COALESCE(is_active, 1) = 1 AND user_id IS NOT NULL")
        ]);
        const ids = new Set();
        for (const row of userRows || []) ids.add(String(row.id));
        for (const row of profileRows || []) ids.add(String(row.id));
        return Array.from(ids);
    }

    async ensureTargetsForPeriod(managerId, periodKey) {
        for (const [metricCode, cfg] of Object.entries(METRIC_CONFIG)) {
            await this.db.query(
                `INSERT INTO manager_kpi_targets
                 (id, manager_id, period_key, metric_code, target_value, weight, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT(manager_id, period_key, metric_code) DO NOTHING`,
                [makeId('MKT'), String(managerId), String(periodKey), metricCode, cfg.target, cfg.weight]
            );
        }
    }

    async computeDailyMetrics(managerId, dayKey) {
        const { fromIso, toIso } = isoRangeFromDayKey(dayKey);

        const activeStatuses = `'booked','reserve_payment_pending','reserve_paid','seller_check_in_progress','check_ready','awaiting_client_decision','full_payment_pending','full_payment_received','bike_buyout_completed','seller_shipped','expert_received','expert_inspection_in_progress','expert_report_ready','awaiting_client_decision_post_inspection','warehouse_received','warehouse_repacked','shipped_to_russia'`;

        const [ordersCreatedRows, touchpointRows, stageRows, complaintRows, supportRows, repeatRows, dailyTensionsRows, openTensionsRows] = await Promise.all([
            this.db.query(
                `SELECT
                    COUNT(*) AS booked_total,
                    SUM(CASE WHEN status IN ('full_payment_received','bike_buyout_completed','seller_shipped','expert_received','expert_inspection_in_progress','expert_report_ready','awaiting_client_decision_post_inspection','warehouse_received','warehouse_repacked','shipped_to_russia','delivered','closed') THEN 1 ELSE 0 END) AS full_payment_total,
                    SUM(CASE WHEN status IN ('delivered','closed') THEN 1 ELSE 0 END) AS delivered_total,
                    SUM(CASE WHEN first_manager_contact_at IS NOT NULL AND datetime(first_manager_contact_at) <= datetime(created_at, '+15 minutes') THEN 1 ELSE 0 END) AS first_contact_sla_hits
                 FROM orders
                 WHERE CAST(assigned_manager AS TEXT) = ?
                   AND datetime(created_at) >= datetime(?)
                   AND datetime(created_at) < datetime(?)`,
                [String(managerId), fromIso, toIso]
            ),
            this.db.query(
                `SELECT
                    COUNT(*) AS response_total,
                    SUM(CASE WHEN COALESCE(is_sla_breached, 0) = 0 THEN 1 ELSE 0 END) AS response_hits
                 FROM crm_touchpoints
                 WHERE CAST(manager_id AS TEXT) = ?
                   AND response_due_at IS NOT NULL
                   AND datetime(happened_at) >= datetime(?)
                   AND datetime(happened_at) < datetime(?)`,
                [String(managerId), fromIso, toIso]
            ),
            this.db.query(
                `SELECT
                    COUNT(*) AS stage_total,
                    SUM(CASE WHEN sla_due_at IS NULL OR sla_breached_at IS NULL THEN 1 ELSE 0 END) AS stage_hits
                 FROM crm_order_stage_instances
                 WHERE CAST(manager_id AS TEXT) = ?
                   AND datetime(entered_at) >= datetime(?)
                   AND datetime(entered_at) < datetime(?)`,
                [String(managerId), fromIso, toIso]
            ),
            this.db.query(
                `SELECT COUNT(*) AS complaint_total
                 FROM order_cases oc
                 JOIN orders o ON o.id = oc.order_id
                 WHERE CAST(o.assigned_manager AS TEXT) = ?
                   AND datetime(oc.opened_at) >= datetime(?)
                   AND datetime(oc.opened_at) < datetime(?)`,
                [String(managerId), fromIso, toIso]
            ),
            this.db.query(
                `SELECT COUNT(*) AS support_touchpoints
                 FROM crm_touchpoints tp
                 JOIN orders o ON o.id = tp.order_id
                 WHERE CAST(tp.manager_id AS TEXT) = ?
                   AND o.status IN ('delivered', 'closed')
                   AND datetime(tp.happened_at) >= datetime(?)
                   AND datetime(tp.happened_at) < datetime(?)`,
                [String(managerId), fromIso, toIso]
            ),
            this.db.query(
                `SELECT COUNT(*) AS repeat_orders
                 FROM orders o
                 WHERE CAST(o.assigned_manager AS TEXT) = ?
                   AND datetime(o.created_at) >= datetime(?)
                   AND datetime(o.created_at) < datetime(?)
                   AND o.customer_id IN (
                       SELECT customer_id
                       FROM orders
                       WHERE customer_id IS NOT NULL
                       GROUP BY customer_id
                       HAVING COUNT(*) > 1
                   )`,
                [String(managerId), fromIso, toIso]
            ),
            this.db.query(
                `SELECT
                    COUNT(*) AS tension_total,
                    SUM(CASE
                            WHEN status = 'resolved'
                             AND (due_at IS NULL OR (resolved_at IS NOT NULL AND datetime(resolved_at) <= datetime(due_at)))
                            THEN 1
                            ELSE 0
                        END) AS tension_sla_hits
                 FROM crm_holacracy_tensions
                 WHERE CAST(owner_user_id AS TEXT) = ?
                   AND datetime(created_at) >= datetime(?)
                   AND datetime(created_at) < datetime(?)`,
                [String(managerId), fromIso, toIso]
            ),
            this.db.query(
                `SELECT COUNT(*) AS open_tensions
                 FROM crm_holacracy_tensions
                 WHERE CAST(owner_user_id AS TEXT) = ?
                   AND status IN ('open','in_progress','blocked')`,
                [String(managerId)]
            )
        ]);

        const bookedTotal = Number(ordersCreatedRows?.[0]?.booked_total || 0);
        const fullPaymentTotal = Number(ordersCreatedRows?.[0]?.full_payment_total || 0);
        const deliveredTotal = Number(ordersCreatedRows?.[0]?.delivered_total || 0);
        const firstContactHits = Number(ordersCreatedRows?.[0]?.first_contact_sla_hits || 0);

        const responseTotal = Number(touchpointRows?.[0]?.response_total || 0);
        const responseHits = Number(touchpointRows?.[0]?.response_hits || 0);
        const stageTotal = Number(stageRows?.[0]?.stage_total || 0);
        const stageHits = Number(stageRows?.[0]?.stage_hits || 0);
        const complaintsTotal = Number(complaintRows?.[0]?.complaint_total || 0);
        const supportTouchpoints = Number(supportRows?.[0]?.support_touchpoints || 0);
        const repeatOrders = Number(repeatRows?.[0]?.repeat_orders || 0);
        const tensionTotal = Number(dailyTensionsRows?.[0]?.tension_total || 0);
        const tensionSlaHits = Number(dailyTensionsRows?.[0]?.tension_sla_hits || 0);
        const openTensions = Number(openTensionsRows?.[0]?.open_tensions || 0);

        const activeRows = await this.db.query(
            `SELECT
                COUNT(*) AS active_orders,
                SUM(CASE WHEN COALESCE(is_stalled, 0) = 1 THEN 1 ELSE 0 END) AS stalled_orders
             FROM orders
             WHERE CAST(assigned_manager AS TEXT) = ?
               AND status IN (${activeStatuses})`,
            [String(managerId)]
        );
        const activeOrders = Number(activeRows?.[0]?.active_orders || 0);
        const stalledOrders = Number(activeRows?.[0]?.stalled_orders || 0);

        return {
            booked_to_full_payment_rate: safeDiv(fullPaymentTotal, bookedTotal, 0),
            full_payment_to_delivered_rate: safeDiv(deliveredTotal, fullPaymentTotal, 0),
            first_contact_sla_hit_rate: safeDiv(firstContactHits, bookedTotal, 0),
            response_sla_hit_rate: safeDiv(responseHits, responseTotal, 0),
            stage_transition_sla_hit_rate: safeDiv(stageHits, stageTotal, 0),
            tension_sla_hit_rate: safeDiv(tensionSlaHits, tensionTotal, 0),
            stale_orders_ratio: safeDiv(stalledOrders, activeOrders, 0),
            tension_backlog_ratio: safeDiv(openTensions, Math.max(activeOrders, 1), 0),
            complaint_rate: safeDiv(complaintsTotal, Math.max(deliveredTotal, 1), 0),
            post_delivery_support_touchpoints: supportTouchpoints,
            repeat_orders_signal: repeatOrders,
            _debug: {
                bookedTotal,
                fullPaymentTotal,
                deliveredTotal,
                firstContactHits,
                responseTotal,
                responseHits,
                stageTotal,
                stageHits,
                activeOrders,
                stalledOrders,
                tensionTotal,
                tensionSlaHits,
                openTensions,
                complaintsTotal,
                supportTouchpoints,
                repeatOrders
            }
        };
    }

    async upsertDailyFactsForManager(managerId, dayKey) {
        const metrics = await this.computeDailyMetrics(managerId, dayKey);
        const periodKey = monthKeyFromDay(dayKey);
        await this.ensureTargetsForPeriod(managerId, periodKey);

        for (const [metricCode, cfg] of Object.entries(METRIC_CONFIG)) {
            const value = Number(metrics[metricCode] || 0);
            const target = Number(cfg.target || 0);
            const ratio = completionRatio(metricCode, value, target);
            const weighted = ratio * Number(cfg.weight || 0);

            await this.db.query(
                `INSERT INTO manager_kpi_daily_facts
                 (id, manager_id, day_key, metric_code, metric_value, target_value, weight, weighted_score, payload, captured_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(manager_id, day_key, metric_code) DO UPDATE SET
                    metric_value = excluded.metric_value,
                    target_value = excluded.target_value,
                    weight = excluded.weight,
                    weighted_score = excluded.weighted_score,
                    payload = excluded.payload,
                    captured_at = CURRENT_TIMESTAMP`,
                [
                    makeId('MKD'),
                    String(managerId),
                    String(dayKey),
                    metricCode,
                    value,
                    target,
                    Number(cfg.weight || 0),
                    weighted,
                    JSON.stringify({ source: 'ManagerKpiService', debug: metrics._debug || null })
                ]
            );
        }
    }

    async recomputeDaily(dayKeyInput = null) {
        const dayKey = dayKeyInput || dayKeyFromDate();
        const managerIds = await this.getManagerIds();
        for (const managerId of managerIds) {
            await this.upsertDailyFactsForManager(managerId, dayKey);
        }
        return { dayKey, managerCount: managerIds.length };
    }

    async recomputePeriod(periodKeyInput = null) {
        const periodKey = periodKeyInput || monthKeyFromDay(dayKeyFromDate());
        const managerIds = await this.getManagerIds();

        for (const managerId of managerIds) {
            await this.ensureTargetsForPeriod(managerId, periodKey);
            const dailyRows = await this.db.query(
                `SELECT metric_code, AVG(metric_value) AS avg_value, AVG(target_value) AS avg_target, AVG(weight) AS avg_weight
                 FROM manager_kpi_daily_facts
                 WHERE manager_id = ? AND day_key LIKE ?
                 GROUP BY metric_code`,
                [String(managerId), `${periodKey}%`]
            );

            const metricMap = new Map();
            for (const row of dailyRows || []) {
                metricMap.set(String(row.metric_code), {
                    actual: Number(row.avg_value || 0),
                    target: Number(row.avg_target || METRIC_CONFIG[row.metric_code]?.target || 0),
                    weight: Number(row.avg_weight || METRIC_CONFIG[row.metric_code]?.weight || 0)
                });
            }

            let totalWeight = 0;
            let weightedTotal = 0;
            const bucketScores = {
                conversion: { weighted: 0, weight: 0 },
                sla: { weighted: 0, weight: 0 },
                reliability: { weighted: 0, weight: 0 },
                quality: { weighted: 0, weight: 0 }
            };
            const snapshotPayload = {};

            for (const [metricCode, cfg] of Object.entries(METRIC_CONFIG)) {
                const values = metricMap.get(metricCode) || {
                    actual: 0,
                    target: Number(cfg.target || 0),
                    weight: Number(cfg.weight || 0)
                };

                const ratio = completionRatio(metricCode, values.actual, values.target);
                const weighted = ratio * values.weight;
                totalWeight += values.weight;
                weightedTotal += weighted;

                const bucket = bucketScores[cfg.bucket] || null;
                if (bucket) {
                    bucket.weight += values.weight;
                    bucket.weighted += weighted;
                }

                snapshotPayload[metricCode] = {
                    actual: values.actual,
                    target: values.target,
                    ratio,
                    weighted
                };

                await this.db.query(
                    `INSERT INTO manager_kpi_snapshots
                     (id, manager_id, period_key, metric_code, actual_value, target_value, completion_ratio, captured_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [makeId('MKS'), String(managerId), String(periodKey), metricCode, values.actual, values.target, ratio]
                );
            }

            const scorePct = totalWeight > 0 ? (weightedTotal / totalWeight) * 100 : 0;
            const conversionScore = bucketScores.conversion.weight > 0 ? (bucketScores.conversion.weighted / bucketScores.conversion.weight) * 100 : 0;
            const slaScore = bucketScores.sla.weight > 0 ? (bucketScores.sla.weighted / bucketScores.sla.weight) * 100 : 0;
            const reliabilityScore = bucketScores.reliability.weight > 0 ? (bucketScores.reliability.weighted / bucketScores.reliability.weight) * 100 : 0;
            const qualityScore = bucketScores.quality.weight > 0 ? (bucketScores.quality.weighted / bucketScores.quality.weight) * 100 : 0;
            const multiplier = payoutMultiplier(scorePct);

            await this.db.query(
                `INSERT INTO manager_kpi_period_scorecards
                 (id, manager_id, period_type, period_key, score_total, conversion_score, sla_score, reliability_score, quality_score, payout_multiplier, metrics_payload, created_at, updated_at)
                 VALUES (?, ?, 'month', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT(manager_id, period_type, period_key) DO UPDATE SET
                    score_total = excluded.score_total,
                    conversion_score = excluded.conversion_score,
                    sla_score = excluded.sla_score,
                    reliability_score = excluded.reliability_score,
                    quality_score = excluded.quality_score,
                    payout_multiplier = excluded.payout_multiplier,
                    metrics_payload = excluded.metrics_payload,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    makeId('MKP'),
                    String(managerId),
                    String(periodKey),
                    scorePct,
                    conversionScore,
                    slaScore,
                    reliabilityScore,
                    qualityScore,
                    multiplier,
                    JSON.stringify(snapshotPayload)
                ]
            );
        }

        return { periodKey, managerCount: managerIds.length };
    }

    async recomputeRecent(days = 31) {
        const horizon = Math.max(1, Math.min(Number(days || 31), 365));
        const now = new Date();
        const monthKeys = new Set();

        for (let i = 0; i < horizon; i += 1) {
            const day = new Date(now.getTime() - i * DAY_MS);
            const dayKey = dayKeyFromDate(day);
            monthKeys.add(monthKeyFromDay(dayKey));
            await this.recomputeDaily(dayKey);
        }

        for (const periodKey of monthKeys) {
            await this.recomputePeriod(periodKey);
        }

        return { days: horizon, periods: Array.from(monthKeys) };
    }

    async getScorecard(managerId, periodKey = null) {
        const targetPeriod = periodKey || monthKeyFromDay(dayKeyFromDate());
        const [scoreRows, dailyRows] = await Promise.all([
            this.db.query(
                `SELECT *
                 FROM manager_kpi_period_scorecards
                 WHERE manager_id = ? AND period_type = 'month' AND period_key = ?
                 LIMIT 1`,
                [String(managerId), String(targetPeriod)]
            ),
            this.db.query(
                `SELECT day_key, metric_code, metric_value, target_value, weight, weighted_score, captured_at
                 FROM manager_kpi_daily_facts
                 WHERE manager_id = ? AND day_key LIKE ?
                 ORDER BY day_key DESC, metric_code ASC`,
                [String(managerId), `${targetPeriod}%`]
            )
        ]);

        return {
            periodKey: targetPeriod,
            scorecard: scoreRows?.[0] || null,
            dailyFacts: dailyRows || []
        };
    }
}

module.exports = {
    ManagerKpiService,
    METRIC_CONFIG,
    dayKeyFromDate,
    monthKeyFromDay
};
