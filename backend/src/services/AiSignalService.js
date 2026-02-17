class AiSignalService {
    constructor({ db }) {
        this.db = db || null;
    }

    _canUseDb() {
        return Boolean(this.db && typeof this.db.query === 'function');
    }

    _id(prefix) {
        const safePrefix = String(prefix || 'ID').toUpperCase();
        return `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    _nowIso() {
        return new Date().toISOString();
    }

    _safeJson(value) {
        if (value == null) return null;
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch {
            return null;
        }
    }

    _normalizeSeverity(value) {
        const v = String(value || '').trim().toLowerCase();
        if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low' || v === 'info') return v;
        return 'medium';
    }

    _decisionToSignalStatus(decision) {
        const d = String(decision || '').trim().toLowerCase();
        if (d === 'approve') return 'in_progress';
        if (d === 'reject') return 'rejected';
        if (d === 'reassign') return 'in_progress';
        if (d === 'snooze') return 'snoozed';
        if (d === 'resolve') return 'resolved';
        return 'open';
    }

    _normalizeStatus(value) {
        const v = String(value || '').trim().toLowerCase();
        if (['open', 'in_progress', 'snoozed', 'rejected', 'resolved'].includes(v)) return v;
        return 'open';
    }

    _normalizeDecision(value) {
        const v = String(value || '').trim().toLowerCase();
        if (['approve', 'reject', 'reassign', 'snooze', 'resolve'].includes(v)) return v;
        return null;
    }

    async listSignals({ status = null, severity = null, limit = 50, offset = 0 } = {}) {
        if (!this._canUseDb()) return [];

        const where = [];
        const params = [];

        if (status) {
            const statuses = String(status)
                .split(',')
                .map((item) => this._normalizeStatus(item))
                .filter(Boolean);
            if (statuses.length) {
                where.push(`status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }
        }

        if (severity) {
            const severities = String(severity)
                .split(',')
                .map((item) => this._normalizeSeverity(item))
                .filter(Boolean);
            if (severities.length) {
                where.push(`severity IN (${severities.map(() => '?').join(',')})`);
                params.push(...severities);
            }
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
        const safeOffset = Math.max(0, Number(offset) || 0);

        return this.db.query(
            `SELECT *
             FROM ai_signals
             ${whereSql}
             ORDER BY
               CASE severity
                 WHEN 'critical' THEN 4
                 WHEN 'high' THEN 3
                 WHEN 'medium' THEN 2
                 WHEN 'low' THEN 1
                 ELSE 0
               END DESC,
               COALESCE(last_seen_at, created_at) DESC,
               created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, safeLimit, safeOffset]
        );
    }

    async getSignalDecisions(signalId, limit = 40) {
        if (!this._canUseDb()) return [];
        const safeLimit = Math.max(1, Math.min(200, Number(limit) || 40));
        return this.db.query(
            `SELECT *
             FROM ai_decisions
             WHERE signal_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [String(signalId), safeLimit]
        );
    }

    async createOrTouchSignal(input = {}) {
        if (!this._canUseDb()) {
            return { success: false, reason: 'db_unavailable' };
        }

        const signalType = String(input.signal_type || input.type || 'generic').trim().toLowerCase();
        const severity = this._normalizeSeverity(input.severity);
        const entityType = input.entity_type ? String(input.entity_type).trim().toLowerCase() : null;
        const entityId = input.entity_id != null ? String(input.entity_id) : null;
        const dedupeKey = String(
            input.dedupe_key ||
            `${signalType}:${entityType || 'na'}:${entityId || 'na'}:${severity}`
        );

        const existingRows = await this.db.query(
            `SELECT id, status
             FROM ai_signals
             WHERE dedupe_key = ?
               AND status IN ('open', 'in_progress', 'snoozed')
             ORDER BY created_at DESC
             LIMIT 1`,
            [dedupeKey]
        );

        const nowIso = this._nowIso();
        const payloadJson = this._safeJson(input.payload);

        if (Array.isArray(existingRows) && existingRows.length) {
            const existing = existingRows[0];
            await this.db.query(
                `UPDATE ai_signals
                 SET severity = ?,
                     title = COALESCE(?, title),
                     insight = COALESCE(?, insight),
                     target = COALESCE(?, target),
                     payload = COALESCE(?, payload),
                     priority_score = COALESCE(?, priority_score),
                     last_seen_at = ?,
                     updated_at = ?
                 WHERE id = ?`,
                [
                    severity,
                    input.title ? String(input.title) : null,
                    input.insight ? String(input.insight) : null,
                    input.target ? String(input.target) : null,
                    payloadJson,
                    input.priority_score != null ? Number(input.priority_score) : null,
                    nowIso,
                    nowIso,
                    existing.id
                ]
            );
            return { success: true, signal_id: existing.id, touched: true };
        }

        const id = this._id('AIS');
        await this.db.query(
            `INSERT INTO ai_signals (
                id, signal_type, source, severity, status, owner_circle,
                entity_type, entity_id, title, insight, target, payload,
                dedupe_key, assigned_to, priority_score,
                first_seen_at, last_seen_at, sla_due_at, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                signalType,
                String(input.source || 'system'),
                severity,
                this._normalizeStatus(input.status || 'open'),
                String(input.owner_circle || 'sales_ops'),
                entityType,
                entityId,
                String(input.title || signalType),
                input.insight ? String(input.insight) : null,
                input.target ? String(input.target) : null,
                payloadJson,
                dedupeKey,
                input.assigned_to ? String(input.assigned_to) : null,
                input.priority_score != null ? Number(input.priority_score) : 0,
                nowIso,
                nowIso,
                input.sla_due_at ? String(input.sla_due_at) : null,
                nowIso,
                nowIso
            ]
        );

        return { success: true, signal_id: id, created: true };
    }

    async decideSignal(signalId, input = {}) {
        if (!this._canUseDb()) {
            return { success: false, reason: 'db_unavailable' };
        }

        const signalIdSafe = String(signalId || '').trim();
        if (!signalIdSafe) {
            return { success: false, reason: 'invalid_signal_id' };
        }

        const decision = this._normalizeDecision(input.decision);
        if (!decision) {
            return { success: false, reason: 'invalid_decision' };
        }

        const rows = await this.db.query('SELECT * FROM ai_signals WHERE id = ? LIMIT 1', [signalIdSafe]);
        const signal = Array.isArray(rows) ? rows[0] : null;
        if (!signal) {
            return { success: false, reason: 'signal_not_found' };
        }

        const nowIso = this._nowIso();
        const signalStatus = this._decisionToSignalStatus(decision);
        const assigneeId = input.assignee_id ? String(input.assignee_id) : null;
        const snoozeUntil = input.snooze_until ? String(input.snooze_until) : null;

        await this.db.query(
            `UPDATE ai_signals
             SET status = ?,
                 assigned_to = COALESCE(?, assigned_to),
                 sla_due_at = CASE WHEN ? = 'snooze' THEN COALESCE(?, sla_due_at) ELSE sla_due_at END,
                 resolved_at = CASE WHEN ? = 'resolve' THEN ? ELSE resolved_at END,
                 updated_at = ?
             WHERE id = ?`,
            [
                signalStatus,
                assigneeId,
                decision,
                snoozeUntil,
                decision,
                nowIso,
                nowIso,
                signalIdSafe
            ]
        );

        const decisionId = this._id('AID');
        await this.db.query(
            `INSERT INTO ai_decisions (id, signal_id, decision, note, actor_id, payload, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                decisionId,
                signalIdSafe,
                decision,
                input.note ? String(input.note) : null,
                input.actor_id ? String(input.actor_id) : null,
                this._safeJson(input.payload),
                nowIso
            ]
        );

        if (decision === 'reassign' && assigneeId) {
            const assignmentId = this._id('AIA');
            await this.db.query(
                `INSERT INTO ai_assignments (id, signal_id, assignee_id, assigned_by, status, due_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
                [
                    assignmentId,
                    signalIdSafe,
                    assigneeId,
                    input.actor_id ? String(input.actor_id) : null,
                    input.due_at ? String(input.due_at) : null,
                    nowIso,
                    nowIso
                ]
            );
        }

        return {
            success: true,
            signal_id: signalIdSafe,
            decision_id: decisionId,
            signal_status: signalStatus
        };
    }

    async recordSlaBreach({
        entity_type = 'order',
        entity_id,
        severity = 'high',
        title,
        insight,
        sla_due_at = null,
        payload = null
    } = {}) {
        if (!entity_id) return { success: false, reason: 'entity_id_required' };

        const signal = await this.createOrTouchSignal({
            signal_type: 'sla_breach',
            source: 'ai_rop',
            severity,
            owner_circle: 'sales_ops',
            entity_type,
            entity_id,
            title: title || 'SLA breach detected',
            insight: insight || 'Order exceeded SLA and requires manager action.',
            target: '/admin#action-center',
            payload,
            dedupe_key: `sla_breach:${entity_type}:${entity_id}`,
            sla_due_at
        });

        if (!signal.success) return signal;

        const openViolation = await this.db.query(
            `SELECT id FROM ai_sla_violations
             WHERE entity_type = ? AND entity_id = ? AND status = 'open'
             ORDER BY created_at DESC
             LIMIT 1`,
            [String(entity_type), String(entity_id)]
        );

        if (!Array.isArray(openViolation) || openViolation.length === 0) {
            await this.db.query(
                `INSERT INTO ai_sla_violations (
                    id, signal_id, entity_type, entity_id, severity, expected_by,
                    breached_at, status, payload, created_at, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
                [
                    this._id('AISLA'),
                    signal.signal_id,
                    String(entity_type),
                    String(entity_id),
                    this._normalizeSeverity(severity),
                    sla_due_at ? String(sla_due_at) : null,
                    this._nowIso(),
                    this._safeJson(payload),
                    this._nowIso(),
                    this._nowIso()
                ]
            );
        }

        return signal;
    }

    async recordComplianceBlock({
        entity_type = 'order',
        entity_id,
        severity = 'critical',
        title,
        insight,
        payload = null
    } = {}) {
        if (!entity_id) return { success: false, reason: 'entity_id_required' };

        return this.createOrTouchSignal({
            signal_type: 'compliance_block',
            source: 'ai_rop',
            severity,
            owner_circle: 'sales_ops',
            entity_type,
            entity_id,
            title: title || 'Compliance block',
            insight: insight || 'Order blocked by compliance policy.',
            target: '/admin#action-center',
            payload,
            dedupe_key: `compliance_block:${entity_type}:${entity_id}`
        });
    }
}

module.exports = { AiSignalService };
