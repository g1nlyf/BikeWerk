const {
    ORDER_STATUS,
    TERMINAL_ORDER_STATUSES,
    normalizeOrderStatus
} = require('../domain/orderLifecycle');

class AiRopAutopilotService {
    constructor({ supabase, db, crmSyncService = null, aiSignalService = null }) {
        this.supabase = supabase || null;
        this.db = db || null;
        this.crmSyncService = crmSyncService || null;
        this.aiSignalService = aiSignalService || null;
        this.intervalHandle = null;
        this.isRunning = false;
        this.lastRunAt = null;
        this.lastSummary = null;
        this.escalationCooldownMs = Math.max(15 * 60 * 1000, Number(process.env.AI_ROP_ESCALATION_COOLDOWN_MS || 2 * 60 * 60 * 1000));
        this.escalationMark = new Map();
    }

    _canRun() {
        return Boolean(this.supabase || this.db);
    }

    _nowIso() {
        return new Date().toISOString();
    }

    _safeJson(value, fallback = null) {
        if (value == null) return fallback;
        if (typeof value === 'object') return value;
        if (typeof value !== 'string') return fallback;
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    _extractBikePriceEur(order) {
        const snapshot = this._safeJson(order?.bike_snapshot, {});
        const bookingMeta = snapshot?.booking_meta || {};
        const financials = snapshot?.financials || bookingMeta?.financials || {};
        const direct = Number(order?.listing_price_eur || order?.bike_price_eur || order?.bike_price || 0);
        const bySnapshot = Number(
            snapshot?.listing_price_eur ||
            snapshot?.price_eur ||
            snapshot?.price ||
            financials?.bike_price_eur ||
            0
        );
        if (Number.isFinite(direct) && direct > 0) return direct;
        if (Number.isFinite(bySnapshot) && bySnapshot > 0) return bySnapshot;
        return null;
    }

    _ageHours(createdAt) {
        const ts = new Date(createdAt || '').getTime();
        if (!Number.isFinite(ts) || ts <= 0) return 0;
        return (Date.now() - ts) / (1000 * 60 * 60);
    }

    _normalizeManagerId(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        const lower = raw.toLowerCase();
        if (lower === 'unassigned' || lower === 'null' || lower === 'undefined' || lower === 'none') {
            return null;
        }
        return raw;
    }

    _normalizeManagerPool(rows = []) {
        const normalized = [];
        const seen = new Set();

        for (const row of rows || []) {
            const id = this._normalizeManagerId(row?.id);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            normalized.push({
                ...row,
                id,
                role: String(row?.role || '').trim().toLowerCase()
            });
        }

        const managersOnly = normalized.filter((row) => row.role === 'manager');
        return managersOnly.length > 0 ? managersOnly : normalized;
    }

    async _loadManagers() {
        if (!this.supabase && this.db && typeof this.db.query === 'function') {
            const localSelectVariants = [
                `SELECT CAST(id AS TEXT) AS id, role, is_active, name
                 FROM users
                 WHERE role IN ('manager', 'admin')`,
                `SELECT CAST(id AS TEXT) AS id, role, active, name
                 FROM users
                 WHERE role IN ('manager', 'admin')`,
                `SELECT CAST(id AS TEXT) AS id, role, name
                 FROM users
                 WHERE role IN ('manager', 'admin')`
            ];

            let rows = [];
            let lastError = null;
            for (const sql of localSelectVariants) {
                try {
                    rows = await this.db.query(sql);
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    const msg = String(error?.message || '').toLowerCase();
                    if (!msg.includes('no such column')) throw error;
                }
            }
            if (lastError) throw lastError;

            const filtered = (rows || []).filter((manager) => {
                if (manager.is_active === false || Number(manager.is_active) === 0) return false;
                if (manager.active === false || Number(manager.active) === 0) return false;
                return Boolean(manager.id);
            });
            return this._normalizeManagerPool(filtered);
        }

        const selectVariants = [
            'id, role, active, is_active, name',
            'id, role, active, name',
            'id, role, is_active, name',
            'id, role, name'
        ];
        let response = null;
        let lastError = null;

        for (const columns of selectVariants) {
            response = await this.supabase.from('users').select(columns).in('role', ['manager', 'admin']);
            if (!response.error) break;

            lastError = response.error;
            const msg = String(response.error.message || '').toLowerCase();
            const isColumnDrift = msg.includes('column') || msg.includes('does not exist') || msg.includes('active');
            if (!isColumnDrift) break;
        }

        if (!response || response.error) throw (response?.error || lastError);
        const raw = Array.isArray(response.data) ? response.data : [];
        const filtered = raw.filter((manager) => {
            if (manager.active === false) return false;
            if (manager.is_active === false || Number(manager.is_active) === 0) return false;
            return Boolean(manager.id);
        });
        return this._normalizeManagerPool(filtered);
    }

    async _insertStatusEvent(orderId, oldStatus, newStatus) {
        if (!this.supabase && this.db && typeof this.db.query === 'function') {
            try {
                await this.db.query(
                    `INSERT INTO order_status_events (id, order_id, old_status, new_status, changed_by, created_at)
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [`OSE-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, String(orderId), oldStatus || null, newStatus, null]
                );
            } catch (error) {
                console.warn('[AI-ROP] local status event insert warning:', error?.message || error);
            }
            return;
        }

        try {
            await this.supabase.from('order_status_events').insert({
                order_id: orderId,
                old_status: oldStatus || null,
                new_status: newStatus,
                changed_by: null,
                created_at: this._nowIso()
            });
        } catch (error) {
            console.warn('[AI-ROP] status event insert warning:', error?.message || error);
        }
    }

    async _insertAuditSignal({ action, order, payload }) {
        if (!this.supabase && this.db && typeof this.db.query === 'function') {
            try {
                await this.db.query(
                    `INSERT INTO audit_log (id, actor_id, action, entity, entity_id, payload, source, severity, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [
                        `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                        null,
                        action,
                        'orders',
                        String(order.id),
                        JSON.stringify({
                            order_code: order.order_code || null,
                            status: order.status || null,
                            ...(payload || {})
                        }),
                        'ai_rop',
                        'info'
                    ]
                );
            } catch (error) {
                console.warn('[AI-ROP] local audit signal warning:', error?.message || error);
            }
            return;
        }

        try {
            await this.supabase.from('audit_log').insert({
                actor_id: null,
                action,
                entity: 'orders',
                entity_id: order.id,
                payload: {
                    order_code: order.order_code || null,
                    status: order.status || null,
                    ...(payload || {})
                },
                created_at: this._nowIso()
            });
        } catch (error) {
            console.warn('[AI-ROP] audit signal warning:', error?.message || error);
        }
    }

    async _recordSlaSignal(order, oldStatus, ageHours, slaHours, assignedManagerId) {
        if (!this.aiSignalService || typeof this.aiSignalService.recordSlaBreach !== 'function') return;
        try {
            await this.aiSignalService.recordSlaBreach({
                entity_type: 'order',
                entity_id: order?.id,
                severity: 'high',
                title: `SLA breach: ${oldStatus}`,
                insight: `Order ${order?.order_code || order?.id} exceeded SLA (${Number(ageHours || 0).toFixed(1)}h > ${slaHours}h).`,
                payload: {
                    status: oldStatus,
                    age_hours: Number(ageHours.toFixed(1)),
                    sla_hours: slaHours,
                    assigned_manager: assignedManagerId || null
                }
            });
        } catch (error) {
            console.warn('[AI-ROP] SLA signal warning:', error?.message || error);
        }
    }

    async _recordComplianceSignal(order, bikePriceEur, reasonCode) {
        if (!this.aiSignalService || typeof this.aiSignalService.recordComplianceBlock !== 'function') return;
        try {
            await this.aiSignalService.recordComplianceBlock({
                entity_type: 'order',
                entity_id: order?.id,
                severity: 'critical',
                title: 'Compliance price block',
                insight: `Order ${order?.order_code || order?.id} cancelled by policy (${reasonCode}).`,
                payload: {
                    bike_price_eur: bikePriceEur,
                    reason: reasonCode
                }
            });
        } catch (error) {
            console.warn('[AI-ROP] compliance signal warning:', error?.message || error);
        }
    }

    _pickManager(loadMap, managers) {
        let candidate = null;
        let candidateLoad = Number.POSITIVE_INFINITY;
        for (const manager of managers) {
            const load = Number(loadMap.get(manager.id) || 0);
            if (load < candidateLoad) {
                candidate = manager;
                candidateLoad = load;
            }
        }
        return candidate;
    }

    async runOnce({ trigger = 'manual', syncLocal = false } = {}) {
        if (!this._canRun()) {
            return {
                success: false,
                reason: 'autopilot_unavailable',
                trigger
            };
        }
        if (this.isRunning) {
            return {
                success: false,
                reason: 'already_running',
                trigger
            };
        }

        this.isRunning = true;
        const summary = {
            success: true,
            trigger,
            assigned: 0,
            reassigned_from_invalid_manager: 0,
            moved_to_seller_check: 0,
            sla_alerts: 0,
            blocked_out_of_policy: 0,
            sync: null,
            started_at: this._nowIso(),
            finished_at: null
        };

        try {
            const managers = await this._loadManagers();
            if (managers.length === 0) {
                summary.success = false;
                summary.reason = 'no_managers_available';
                return summary;
            }

            const terminalStatuses = [...TERMINAL_ORDER_STATUSES, 'refunded', 'paid_out'];

            let activeOrders = [];
            let candidateOrders = [];

            if (this.supabase) {
                const [{ data: activeData, error: activeError }, { data: candidateData, error: candidateError }] = await Promise.all([
                    this.supabase.from('orders').select('id, assigned_manager, status').not('status', 'in', `("${terminalStatuses.join('","')}")`),
                    this.supabase
                        .from('orders')
                        .select('id, order_code, status, assigned_manager, created_at, bike_snapshot, listing_price_eur')
                        .not('status', 'in', `("${terminalStatuses.join('","')}")`)
                        .order('created_at', { ascending: true })
                ]);
                if (activeError) throw activeError;
                if (candidateError) throw candidateError;
                activeOrders = activeData || [];
                candidateOrders = candidateData || [];
            } else {
                const placeholders = terminalStatuses.map(() => '?').join(',');
                activeOrders = await this.db.query(
                    `SELECT id, assigned_manager, status
                     FROM orders
                     WHERE status NOT IN (${placeholders})`,
                    terminalStatuses
                );
                candidateOrders = await this.db.query(
                    `SELECT id, order_code, status, assigned_manager, created_at, bike_snapshot, listing_price_eur
                     FROM orders
                     WHERE status NOT IN (${placeholders})
                     ORDER BY datetime(created_at) ASC`,
                    terminalStatuses
                );
            }

            const managerIdSet = new Set(managers.map((manager) => manager.id));
            const loadMap = new Map();
            for (const manager of managers) loadMap.set(manager.id, 0);
            for (const order of activeOrders || []) {
                const managerId = this._normalizeManagerId(order.assigned_manager);
                if (managerId && loadMap.has(managerId)) {
                    loadMap.set(managerId, Number(loadMap.get(managerId) || 0) + 1);
                }
            }

            const nowMs = Date.now();
            const staleSlaByStatus = {
                [ORDER_STATUS.BOOKED]: 12,
                [ORDER_STATUS.RESERVE_PAYMENT_PENDING]: 24,
                [ORDER_STATUS.SELLER_CHECK_IN_PROGRESS]: 48,
                [ORDER_STATUS.CHECK_READY]: 24,
                [ORDER_STATUS.AWAITING_CLIENT_DECISION]: 24,
                [ORDER_STATUS.FULL_PAYMENT_PENDING]: 24
            };

            for (const order of candidateOrders || []) {
                const oldStatus = normalizeOrderStatus(order.status) || String(order.status || '').toLowerCase();

                const bikePriceEur = this._extractBikePriceEur(order);
                if (bikePriceEur && (bikePriceEur > 5000 || bikePriceEur < 500) && oldStatus !== ORDER_STATUS.CANCELLED && oldStatus !== ORDER_STATUS.CLOSED) {
                    let cancelError = null;
                    if (this.supabase) {
                        const response = await this.supabase
                            .from('orders')
                            .update({ status: ORDER_STATUS.CANCELLED })
                            .eq('id', order.id);
                        cancelError = response.error || null;
                    } else {
                        try {
                            await this.db.query(
                                `UPDATE orders
                                 SET status = ?, cancel_reason_code = ?, updated_at = CURRENT_TIMESTAMP
                                 WHERE id = ?`,
                                [ORDER_STATUS.CANCELLED, bikePriceEur > 5000 ? 'compliance_eur_5000_limit' : 'minimum_price_eur_500', String(order.id)]
                            );
                        } catch (error) {
                            cancelError = error;
                        }
                    }
                    if (!cancelError) {
                        const reasonCode = bikePriceEur > 5000 ? 'compliance_eur_5000_limit' : 'minimum_price_eur_500';
                        await this._insertStatusEvent(order.id, order.status, ORDER_STATUS.CANCELLED);
                        await this._insertAuditSignal({
                            action: 'ai_rop_block_out_of_policy',
                            order,
                            payload: {
                                bike_price_eur: bikePriceEur,
                                reason: reasonCode
                            }
                        });
                        await this._recordComplianceSignal(order, bikePriceEur, reasonCode);
                        summary.blocked_out_of_policy += 1;
                        continue;
                    }
                }

                let assignedManagerId = this._normalizeManagerId(order.assigned_manager);
                if (assignedManagerId && !managerIdSet.has(assignedManagerId)) {
                    assignedManagerId = null;
                    summary.reassigned_from_invalid_manager += 1;
                }
                if (!assignedManagerId) {
                    const manager = this._pickManager(loadMap, managers);
                    if (manager?.id) {
                        const desiredStatus = (oldStatus === ORDER_STATUS.BOOKED) ? ORDER_STATUS.SELLER_CHECK_IN_PROGRESS : oldStatus;
                        const patchPayload = { assigned_manager: manager.id };
                        if (desiredStatus !== oldStatus) patchPayload.status = desiredStatus;

                        let assignError = null;
                        if (this.supabase) {
                            const response = await this.supabase
                                .from('orders')
                                .update(patchPayload)
                                .eq('id', order.id);
                            assignError = response.error || null;
                        } else {
                            const setParts = [];
                            const params = [];
                            if (patchPayload.assigned_manager != null) {
                                setParts.push('assigned_manager = ?');
                                params.push(String(patchPayload.assigned_manager));
                            }
                            if (patchPayload.status != null) {
                                setParts.push('status = ?');
                                params.push(String(patchPayload.status));
                            }
                            setParts.push('updated_at = CURRENT_TIMESTAMP');
                            try {
                                await this.db.query(
                                    `UPDATE orders SET ${setParts.join(', ')} WHERE id = ?`,
                                    [...params, String(order.id)]
                                );
                            } catch (error) {
                                assignError = error;
                            }
                        }

                        if (!assignError) {
                            assignedManagerId = manager.id;
                            summary.assigned += 1;
                            if (desiredStatus !== oldStatus) {
                                await this._insertStatusEvent(order.id, order.status, desiredStatus);
                                summary.moved_to_seller_check += 1;
                            }
                            loadMap.set(manager.id, Number(loadMap.get(manager.id) || 0) + 1);
                            await this._insertAuditSignal({
                                action: 'ai_rop_auto_assign',
                                order,
                                payload: { manager_id: manager.id, new_status: desiredStatus }
                            });
                        }
                    }
                } else if (oldStatus === ORDER_STATUS.BOOKED) {
                    let moveError = null;
                    if (this.supabase) {
                        const response = await this.supabase
                            .from('orders')
                            .update({ status: ORDER_STATUS.SELLER_CHECK_IN_PROGRESS })
                            .eq('id', order.id);
                        moveError = response.error || null;
                    } else {
                        try {
                            await this.db.query(
                                `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                                [ORDER_STATUS.SELLER_CHECK_IN_PROGRESS, String(order.id)]
                            );
                        } catch (error) {
                            moveError = error;
                        }
                    }
                    if (!moveError) {
                        await this._insertStatusEvent(order.id, order.status, ORDER_STATUS.SELLER_CHECK_IN_PROGRESS);
                        summary.moved_to_seller_check += 1;
                    }
                }

                const slaHours = staleSlaByStatus[oldStatus];
                if (!slaHours) continue;
                const ageHours = this._ageHours(order.created_at);
                if (ageHours <= slaHours) continue;

                const markerKey = `${order.id}:${oldStatus}`;
                const lastTs = Number(this.escalationMark.get(markerKey) || 0);
                if (lastTs > 0 && (nowMs - lastTs) < this.escalationCooldownMs) continue;

                this.escalationMark.set(markerKey, nowMs);
                summary.sla_alerts += 1;
                await this._insertAuditSignal({
                    action: 'ai_rop_sla_breach',
                    order,
                    payload: {
                        status: oldStatus,
                        age_hours: Number(ageHours.toFixed(1)),
                        sla_hours: slaHours,
                        assigned_manager: assignedManagerId
                    }
                });
                await this._recordSlaSignal(order, oldStatus, ageHours, slaHours, assignedManagerId);
            }

            if (syncLocal && this.crmSyncService && typeof this.crmSyncService.syncFromSupabaseToLocal === 'function') {
                summary.sync = await this.crmSyncService.syncFromSupabaseToLocal();
            }

            return summary;
        } finally {
            this.lastRunAt = this._nowIso();
            this.lastSummary = { ...summary, finished_at: this._nowIso() };
            this.isRunning = false;
        }
    }

    start() {
        if (this.intervalHandle || !this._canRun()) return false;
        const intervalMinutes = Math.max(1, Number(process.env.AI_ROP_INTERVAL_MINUTES || 3));
        const intervalMs = intervalMinutes * 60 * 1000;

        this.runOnce({ trigger: 'startup', syncLocal: String(process.env.AI_ROP_SYNC_LOCAL_ON_STARTUP || '1') === '1' })
            .catch((error) => console.error('[AI-ROP] startup run failed:', error?.message || error));

        this.intervalHandle = setInterval(() => {
            this.runOnce({
                trigger: 'interval',
                syncLocal: String(process.env.AI_ROP_SYNC_LOCAL_EACH_RUN || '0') === '1'
            }).catch((error) => console.error('[AI-ROP] interval run failed:', error?.message || error));
        }, intervalMs);

        return true;
    }

    stop() {
        if (!this.intervalHandle) return false;
        clearInterval(this.intervalHandle);
        this.intervalHandle = null;
        return true;
    }

    getStatus() {
        return {
            running: Boolean(this.intervalHandle),
            in_progress: this.isRunning,
            last_run_at: this.lastRunAt,
            last_summary: this.lastSummary
        };
    }
}

module.exports = { AiRopAutopilotService };
