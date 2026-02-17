const { v4: uuidv4 } = require('uuid');
const { ORDER_STATUS, normalizeOrderStatus } = require('../domain/orderLifecycle');

function safeJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

class CrmSyncService {
    constructor({ supabase, db }) {
        this.supabase = supabase || null;
        this.db = db || null;
    }

    _canRun() {
        return Boolean(this.supabase && this.db && typeof this.db.query === 'function');
    }

    _isMissingColumnError(error) {
        const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
        return text.includes('column') && (text.includes('does not exist') || text.includes('could not find'));
    }

    _normalizePreferredChannel(raw, fallback = 'whatsapp') {
        const value = String(raw || '').trim().toLowerCase();
        if (!value) return fallback;
        if (value === 'email') return 'email';
        if (value === 'telegram' || value.startsWith('telegram:')) return 'telegram';
        if (value === 'phone' || value === 'call' || value === 'whatsapp' || value === 'sms') return 'whatsapp';
        return fallback;
    }

    _safeToString(value) {
        if (value == null) return null;
        const str = String(value).trim();
        return str || null;
    }

    _safeNumber(value, fallback = null) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return n;
    }

    _asJsonString(value) {
        if (value == null) return null;
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch {
            return null;
        }
    }

    _extractBookingPrice(orderRow) {
        const snapshot = safeJson(orderRow?.bike_snapshot, {});
        const bookingMeta = snapshot?.booking_meta || {};
        const financials = snapshot?.financials || bookingMeta?.financials || {};
        const byColumns = Number(orderRow?.booking_amount_rub || orderRow?.booking_price || 0);
        const bySnapshot = Number(financials?.booking_amount_rub || bookingMeta?.booking_amount_rub || 0);
        const totalRub = Number(orderRow?.total_price_rub || financials?.total_price_rub || 0);
        if (Number.isFinite(byColumns) && byColumns > 0) return byColumns;
        if (Number.isFinite(bySnapshot) && bySnapshot > 0) return bySnapshot;
        if (Number.isFinite(totalRub) && totalRub > 0) return Math.ceil(totalRub * 0.02);
        return null;
    }

    _getTableConfigs({ includeEvents = true } = {}) {
        const configs = [
            {
                name: 'customers',
                selectCandidates: [
                    'id,full_name,phone,email,preferred_channel,contact_value,country,city,created_at,updated_at',
                    'id,full_name,phone,email,preferred_channel,country,city,created_at,updated_at',
                    'id,full_name,phone,email,preferred_channel,country,created_at'
                ],
                orderColumnCandidates: ['updated_at', 'created_at'],
                upsertLocal: (row) => this._upsertCustomer(row)
            },
            {
                name: 'leads',
                selectCandidates: [
                    'id,source,customer_id,bike_url,bike_snapshot,customer_comment,estimated_budget_eur,status,experience,usage,terrain,features,preferred_contact,contact_method,contact_value,created_at,updated_at',
                    'id,source,customer_id,bike_url,bike_snapshot,status,contact_method,contact_value,created_at,updated_at',
                    'id,source,customer_id,bike_url,bike_snapshot,status,created_at'
                ],
                orderColumnCandidates: ['updated_at', 'created_at'],
                upsertLocal: (row) => this._upsertLead(row)
            },
            {
                name: 'orders',
                selectCandidates: [
                    'id,old_uuid_id,order_code,customer_id,lead_id,bike_id,bike_name,bike_url,bike_snapshot,listing_price_eur,initial_quality,final_price_eur,commission_eur,total_price_rub,booking_price,booking_amount_rub,booking_amount_eur,exchange_rate,delivery_method,status,assigned_manager,manager_notes,is_refundable,magic_link_token,reserve_paid_at,superseded_by_order_id,cancel_reason_code,cancel_reason_note,created_at,updated_at,closed_at',
                    'id,order_code,customer_id,lead_id,bike_id,bike_url,bike_snapshot,final_price_eur,commission_eur,total_price_rub,booking_amount_rub,exchange_rate,delivery_method,status,assigned_manager,is_refundable,created_at,updated_at',
                    'id,order_code,customer_id,lead_id,bike_id,bike_url,bike_snapshot,final_price_eur,commission_eur,status,assigned_manager,is_refundable,created_at'
                ],
                orderColumnCandidates: ['updated_at', 'created_at'],
                upsertLocal: (row) => this._upsertOrder(row)
            },
            {
                name: 'payments',
                selectCandidates: [
                    'id,order_id,direction,role,method,amount,currency,status,description,transaction_date,external_reference,related_payment_id,created_by,created_at,updated_at',
                    'id,order_id,direction,role,method,amount,currency,status,external_reference,related_payment_id,created_by,created_at'
                    ,'id,order_id,direction,role,method,amount,currency,status,external_reference,related_payment_id,created_at'
                ],
                orderColumnCandidates: ['updated_at', 'created_at'],
                upsertLocal: (row) => this._upsertPayment(row)
            },
            {
                name: 'shipments',
                selectCandidates: [
                    'id,order_id,provider,carrier,tracking_number,delivery_status,estimated_delivery,estimated_delivery_date,warehouse_received,warehouse_photos_received,client_received,ruspost_status,ruspost_last_update,source_provider,created_by,created_at,updated_at',
                    'id,order_id,provider,tracking_number,estimated_delivery_date,warehouse_received,warehouse_photos_received,client_received,ruspost_status,ruspost_last_update,created_by,created_at',
                    'id,order_id,provider,tracking_number,estimated_delivery_date,warehouse_received,warehouse_photos_received,client_received,ruspost_status,ruspost_last_update,created_at'
                ],
                orderColumnCandidates: ['updated_at', 'created_at'],
                upsertLocal: (row) => this._upsertShipment(row)
            },
            {
                name: 'tasks',
                selectCandidates: [
                    'id,order_id,title,description,due_at,completed,status,priority,assigned_to,created_by,created_at,updated_at',
                    'id,order_id,title,description,due_at,completed,assigned_to,created_by,created_at',
                    'id,order_id,title,description,due_at,completed,assigned_to,created_at'
                ],
                orderColumnCandidates: ['updated_at', 'created_at'],
                upsertLocal: (row) => this._upsertTask(row)
            },
            {
                name: 'audit_log',
                selectCandidates: [
                    'id,actor_id,action,entity,entity_id,payload,source,severity,created_at',
                    'id,actor_id,action,entity,entity_id,payload,created_at'
                ],
                orderColumnCandidates: ['created_at'],
                upsertLocal: (row) => this._upsertAuditLog(row)
            },
            {
                name: 'documents',
                selectCandidates: [
                    'id,order_id,type,file_url,status,metadata,created_by,uploaded_at',
                    'id,order_id,type,file_url,created_by,uploaded_at',
                    'id,order_id,type,file_url,uploaded_at'
                ],
                orderColumnCandidates: ['uploaded_at', 'created_at'],
                upsertLocal: (row) => this._upsertDocument(row)
            }
        ];

        if (includeEvents) {
            configs.push({
                name: 'order_status_events',
                selectCandidates: [
                    'id,order_id,old_status,new_status,change_notes,changed_by,created_at',
                    'id,order_id,old_status,new_status,changed_by,created_at'
                ],
                orderColumnCandidates: ['created_at'],
                upsertLocal: (row) => this._upsertOrderStatusEvent(row)
            });
        }

        return configs;
    }

    async _readCheckpoint(tableName) {
        const rows = await this.db.query(
            'SELECT table_name, last_remote_updated_at, last_remote_id FROM crm_sync_state WHERE table_name = ? LIMIT 1',
            [tableName]
        );
        return rows?.[0] || null;
    }

    async _writeCheckpoint(tableName, checkpoint = {}) {
        await this.db.query(
            `INSERT INTO crm_sync_state (table_name, last_remote_updated_at, last_remote_id, full_synced_at, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(table_name) DO UPDATE SET
                last_remote_updated_at = excluded.last_remote_updated_at,
                last_remote_id = excluded.last_remote_id,
                full_synced_at = COALESCE(excluded.full_synced_at, crm_sync_state.full_synced_at),
                updated_at = CURRENT_TIMESTAMP`,
            [
                tableName,
                checkpoint.last_remote_updated_at || null,
                checkpoint.last_remote_id || null,
                checkpoint.full_synced_at || null
            ]
        );
    }

    _buildIncrementalFilter(rows, { checkpointUpdatedAt, checkpointId, orderColumn }) {
        if (!checkpointUpdatedAt) return rows;
        return (rows || []).filter((row) => {
            const rowTs = String(row?.[orderColumn] || row?.created_at || '');
            const rowId = String(row?.id || '');
            if (!rowTs) return true;
            if (rowTs > checkpointUpdatedAt) return true;
            if (rowTs < checkpointUpdatedAt) return false;
            if (!checkpointId) return true;
            return rowId > checkpointId;
        });
    }

    async _fetchPage({ tableName, select, orderColumn, from, to, checkpointUpdatedAt }) {
        const buildQuery = (withIdOrder) => {
            let query = this.supabase
                .from(tableName)
                .select(select)
                .range(from, to);

            if (orderColumn) {
                query = query.order(orderColumn, { ascending: true });
            }
            if (withIdOrder) {
                query = query.order('id', { ascending: true });
            }
            if (checkpointUpdatedAt && orderColumn) {
                query = query.gte(orderColumn, checkpointUpdatedAt);
            }
            return query;
        };

        let result = await buildQuery(true);
        if (result.error && this._isMissingColumnError(result.error)) {
            const text = `${result.error?.message || ''} ${result.error?.details || ''}`.toLowerCase();
            if (text.includes('id')) {
                result = await buildQuery(false);
            }
        }

        if (result.error) throw result.error;
        return Array.isArray(result.data) ? result.data : [];
    }

    async _fetchTableRows(config, { mode = 'incremental', pageSize = 500, maxPages = 60 } = {}) {
        const checkpoint = mode === 'incremental' ? await this._readCheckpoint(config.name) : null;
        const checkpointUpdatedAt = checkpoint?.last_remote_updated_at || null;
        const checkpointId = checkpoint?.last_remote_id || null;
        const orderColumnCandidates = [...(config.orderColumnCandidates || []), null];
        let chosenSelect = null;
        let chosenOrderColumn = null;

        for (const orderColumn of orderColumnCandidates) {
            for (const candidate of config.selectCandidates) {
                try {
                    await this._fetchPage({
                        tableName: config.name,
                        select: candidate,
                        orderColumn,
                        from: 0,
                        to: 0,
                        checkpointUpdatedAt: mode === 'incremental' ? checkpointUpdatedAt : null
                    });
                    chosenSelect = candidate;
                    chosenOrderColumn = orderColumn;
                    break;
                } catch (error) {
                    if (!this._isMissingColumnError(error)) throw error;
                }
            }
            if (chosenSelect) break;
        }
        if (!chosenSelect) {
            throw new Error(`Sync failed for ${config.name}: no compatible select projection`);
        }

        const rows = [];
        for (let page = 0; page < maxPages; page += 1) {
            const from = page * pageSize;
            const to = from + pageSize - 1;
            const chunk = await this._fetchPage({
                tableName: config.name,
                select: chosenSelect,
                orderColumn: chosenOrderColumn,
                from,
                to,
                checkpointUpdatedAt: mode === 'incremental' ? checkpointUpdatedAt : null
            });
            if (!chunk.length) break;
            rows.push(...chunk);
            if (chunk.length < pageSize) break;
        }

        if (mode !== 'incremental') {
            return { rows, orderColumn: chosenOrderColumn };
        }

        return {
            rows: this._buildIncrementalFilter(rows, { checkpointUpdatedAt, checkpointId, orderColumn: chosenOrderColumn }),
            orderColumn: chosenOrderColumn
        };
    }

    async _upsertCustomer(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        await this.db.query(
            `INSERT INTO customers (id, full_name, phone, email, preferred_channel, contact_value, country, city, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
             ON CONFLICT(id) DO UPDATE SET
                full_name = COALESCE(excluded.full_name, customers.full_name),
                phone = COALESCE(excluded.phone, customers.phone),
                email = COALESCE(excluded.email, customers.email),
                preferred_channel = COALESCE(excluded.preferred_channel, customers.preferred_channel),
                contact_value = COALESCE(excluded.contact_value, customers.contact_value),
                country = COALESCE(excluded.country, customers.country),
                city = COALESCE(excluded.city, customers.city),
                updated_at = COALESCE(excluded.updated_at, customers.updated_at)`,
            [
                id,
                row.full_name || row.name || null,
                row.phone || null,
                row.email || null,
                this._normalizePreferredChannel(row.preferred_channel || null, null),
                row.contact_value || row.phone || row.email || null,
                row.country || null,
                row.city || null,
                row.created_at || null,
                row.updated_at || null
            ]
        );
        return id;
    }

    async _upsertLead(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        await this.db.query(
            `INSERT INTO leads (
                id, source, customer_id, bike_url, bike_snapshot, customer_comment, estimated_budget_eur, status,
                experience, usage, terrain, features, preferred_contact, contact_method, contact_value, created_at, updated_at
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
             ON CONFLICT(id) DO UPDATE SET
                source = COALESCE(excluded.source, leads.source),
                customer_id = COALESCE(excluded.customer_id, leads.customer_id),
                bike_url = COALESCE(excluded.bike_url, leads.bike_url),
                bike_snapshot = COALESCE(excluded.bike_snapshot, leads.bike_snapshot),
                customer_comment = COALESCE(excluded.customer_comment, leads.customer_comment),
                estimated_budget_eur = COALESCE(excluded.estimated_budget_eur, leads.estimated_budget_eur),
                status = COALESCE(excluded.status, leads.status),
                experience = COALESCE(excluded.experience, leads.experience),
                usage = COALESCE(excluded.usage, leads.usage),
                terrain = COALESCE(excluded.terrain, leads.terrain),
                features = COALESCE(excluded.features, leads.features),
                preferred_contact = COALESCE(excluded.preferred_contact, leads.preferred_contact),
                contact_method = COALESCE(excluded.contact_method, leads.contact_method),
                contact_value = COALESCE(excluded.contact_value, leads.contact_value),
                updated_at = COALESCE(excluded.updated_at, leads.updated_at)`,
            [
                id,
                row.source || 'website_booking',
                this._safeToString(row.customer_id),
                row.bike_url || null,
                this._asJsonString(row.bike_snapshot),
                row.customer_comment || null,
                this._safeNumber(row.estimated_budget_eur),
                row.status || 'new',
                row.experience || null,
                row.usage || null,
                row.terrain || null,
                this._asJsonString(row.features) || row.features || null,
                row.preferred_contact || null,
                row.contact_method || null,
                row.contact_value || null,
                row.created_at || null,
                row.updated_at || null
            ]
        );
        return id;
    }

    async _upsertOrder(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        const snapshot = safeJson(row.bike_snapshot, row.bike_snapshot);
        const status = normalizeOrderStatus(row.status) || ORDER_STATUS.BOOKED;
        const bookingPrice = this._extractBookingPrice(row);
        const reservePaidAt = row.reserve_paid_at || safeJson(snapshot, {})?.booking_meta?.reservation_paid_at || null;
        const reserveEnabled = reservePaidAt ? 1 : Number(row.reserve_enabled || 0);

        const sql = `INSERT INTO orders (
                id, old_uuid_id, order_code, customer_id, lead_id, bike_id, bike_name, bike_url, bike_snapshot,
                listing_price_eur, initial_quality, final_price_eur, commission_eur, total_price_rub, booking_price,
                booking_amount_rub, booking_amount_eur, exchange_rate, delivery_method, status, assigned_manager,
                manager_notes, is_refundable, magic_link_token, reserve_enabled, reserve_paid_at, superseded_by_order_id,
                cancel_reason_code, cancel_reason_note, created_at, updated_at, closed_at
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP), ?)
             ON CONFLICT(id) DO UPDATE SET
                old_uuid_id = COALESCE(excluded.old_uuid_id, orders.old_uuid_id),
                order_code = COALESCE(excluded.order_code, orders.order_code),
                customer_id = COALESCE(excluded.customer_id, orders.customer_id),
                lead_id = COALESCE(excluded.lead_id, orders.lead_id),
                bike_id = COALESCE(excluded.bike_id, orders.bike_id),
                bike_name = COALESCE(excluded.bike_name, orders.bike_name),
                bike_url = COALESCE(excluded.bike_url, orders.bike_url),
                bike_snapshot = COALESCE(excluded.bike_snapshot, orders.bike_snapshot),
                listing_price_eur = COALESCE(excluded.listing_price_eur, orders.listing_price_eur),
                initial_quality = COALESCE(excluded.initial_quality, orders.initial_quality),
                final_price_eur = COALESCE(excluded.final_price_eur, orders.final_price_eur),
                commission_eur = COALESCE(excluded.commission_eur, orders.commission_eur),
                total_price_rub = COALESCE(excluded.total_price_rub, orders.total_price_rub),
                booking_price = COALESCE(excluded.booking_price, orders.booking_price),
                booking_amount_rub = COALESCE(excluded.booking_amount_rub, orders.booking_amount_rub),
                booking_amount_eur = COALESCE(excluded.booking_amount_eur, orders.booking_amount_eur),
                exchange_rate = COALESCE(excluded.exchange_rate, orders.exchange_rate),
                delivery_method = COALESCE(excluded.delivery_method, orders.delivery_method),
                status = COALESCE(excluded.status, orders.status),
                assigned_manager = COALESCE(excluded.assigned_manager, orders.assigned_manager),
                manager_notes = COALESCE(excluded.manager_notes, orders.manager_notes),
                is_refundable = COALESCE(excluded.is_refundable, orders.is_refundable),
                magic_link_token = COALESCE(excluded.magic_link_token, orders.magic_link_token),
                reserve_enabled = COALESCE(excluded.reserve_enabled, orders.reserve_enabled),
                reserve_paid_at = COALESCE(excluded.reserve_paid_at, orders.reserve_paid_at),
                superseded_by_order_id = COALESCE(excluded.superseded_by_order_id, orders.superseded_by_order_id),
                cancel_reason_code = COALESCE(excluded.cancel_reason_code, orders.cancel_reason_code),
                cancel_reason_note = COALESCE(excluded.cancel_reason_note, orders.cancel_reason_note),
                updated_at = COALESCE(excluded.updated_at, orders.updated_at),
                closed_at = COALESCE(excluded.closed_at, orders.closed_at)`;

        const values = [
            id,
            row.old_uuid_id || null,
            row.order_code || null,
            this._safeToString(row.customer_id),
            this._safeToString(row.lead_id),
            this._safeNumber(row.bike_id),
            row.bike_name || null,
            row.bike_url || null,
            this._asJsonString(snapshot),
            this._safeNumber(row.listing_price_eur),
            row.initial_quality || null,
            this._safeNumber(row.final_price_eur),
            this._safeNumber(row.commission_eur, 0),
            this._safeNumber(row.total_price_rub),
            this._safeNumber(row.booking_price ?? bookingPrice),
            this._safeNumber(row.booking_amount_rub ?? bookingPrice),
            this._safeNumber(row.booking_amount_eur),
            this._safeNumber(row.exchange_rate),
            row.delivery_method || null,
            status,
            this._safeToString(row.assigned_manager),
            row.manager_notes || null,
            Number(row.is_refundable ?? 1),
            row.magic_link_token || null,
            reserveEnabled,
            reservePaidAt,
            this._safeToString(row.superseded_by_order_id),
            row.cancel_reason_code || null,
            row.cancel_reason_note || null,
            row.created_at || null,
            row.updated_at || row.created_at || null,
            row.closed_at || null
        ];

        try {
            await this.db.query(sql, values);
        } catch (error) {
            const message = String(error?.message || error || '').toLowerCase();
            if (!message.includes('foreign key constraint failed')) throw error;
            const retryValues = [...values];
            retryValues[3] = null; // customer_id
            retryValues[4] = null; // lead_id
            retryValues[5] = null; // bike_id
            await this.db.query(sql, retryValues);
        }
        return id;
    }

    async _upsertOrderStatusEvent(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        await this.db.query(
            `INSERT OR IGNORE INTO order_status_events (id, order_id, old_status, new_status, change_notes, changed_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
            [
                id,
                this._safeToString(row.order_id),
                row.old_status || null,
                row.new_status || null,
                row.change_notes || null,
                this._safeToString(row.changed_by),
                row.created_at || null
            ]
        );
        return id;
    }

    async _upsertPayment(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        const sql = `INSERT INTO payments (
                id, order_id, direction, role, method, amount, currency, status, description, transaction_date,
                external_reference, related_payment_id, created_by, created_at, updated_at
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
             ON CONFLICT(id) DO UPDATE SET
                order_id = COALESCE(excluded.order_id, payments.order_id),
                direction = COALESCE(excluded.direction, payments.direction),
                role = COALESCE(excluded.role, payments.role),
                method = COALESCE(excluded.method, payments.method),
                amount = COALESCE(excluded.amount, payments.amount),
                currency = COALESCE(excluded.currency, payments.currency),
                status = COALESCE(excluded.status, payments.status),
                description = COALESCE(excluded.description, payments.description),
                transaction_date = COALESCE(excluded.transaction_date, payments.transaction_date),
                external_reference = COALESCE(excluded.external_reference, payments.external_reference),
                related_payment_id = COALESCE(excluded.related_payment_id, payments.related_payment_id),
                created_by = COALESCE(excluded.created_by, payments.created_by),
                updated_at = COALESCE(excluded.updated_at, payments.updated_at)`;

        const values = [
            id,
            this._safeToString(row.order_id),
            row.direction || 'incoming',
            row.role || 'unknown',
            row.method || 'unknown',
            this._safeNumber(row.amount, 0),
            row.currency || 'EUR',
            row.status || 'planned',
            row.description || null,
            row.transaction_date || null,
            row.external_reference || null,
            this._safeToString(row.related_payment_id),
            this._safeToString(row.created_by),
            row.created_at || null,
            row.updated_at || row.created_at || null
        ];

        try {
            await this.db.query(sql, values);
        } catch (error) {
            const message = String(error?.message || error || '').toLowerCase();
            if (!message.includes('foreign key constraint failed')) throw error;
            const retryValues = [...values];
            retryValues[1] = null; // order_id
            retryValues[11] = null; // related_payment_id
            await this.db.query(sql, retryValues);
        }
        return id;
    }

    async _upsertShipment(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        await this.db.query(
            `INSERT INTO shipments (
                id, order_id, provider, carrier, tracking_number, delivery_status, estimated_delivery, estimated_delivery_date,
                warehouse_received, warehouse_photos_received, client_received, ruspost_status, ruspost_last_update, source_provider,
                created_by, created_at, updated_at
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
             ON CONFLICT(id) DO UPDATE SET
                order_id = COALESCE(excluded.order_id, shipments.order_id),
                provider = COALESCE(excluded.provider, shipments.provider),
                carrier = COALESCE(excluded.carrier, shipments.carrier),
                tracking_number = COALESCE(excluded.tracking_number, shipments.tracking_number),
                delivery_status = COALESCE(excluded.delivery_status, shipments.delivery_status),
                estimated_delivery = COALESCE(excluded.estimated_delivery, shipments.estimated_delivery),
                estimated_delivery_date = COALESCE(excluded.estimated_delivery_date, shipments.estimated_delivery_date),
                warehouse_received = COALESCE(excluded.warehouse_received, shipments.warehouse_received),
                warehouse_photos_received = COALESCE(excluded.warehouse_photos_received, shipments.warehouse_photos_received),
                client_received = COALESCE(excluded.client_received, shipments.client_received),
                ruspost_status = COALESCE(excluded.ruspost_status, shipments.ruspost_status),
                ruspost_last_update = COALESCE(excluded.ruspost_last_update, shipments.ruspost_last_update),
                source_provider = COALESCE(excluded.source_provider, shipments.source_provider),
                created_by = COALESCE(excluded.created_by, shipments.created_by),
                updated_at = COALESCE(excluded.updated_at, shipments.updated_at)`,
            [
                id,
                this._safeToString(row.order_id),
                row.provider || null,
                row.carrier || null,
                row.tracking_number || null,
                row.delivery_status || null,
                row.estimated_delivery || null,
                row.estimated_delivery_date || null,
                Number(row.warehouse_received || 0),
                Number(row.warehouse_photos_received || 0),
                Number(row.client_received || 0),
                this._asJsonString(row.ruspost_status) || row.ruspost_status || null,
                row.ruspost_last_update || null,
                row.source_provider || null,
                this._safeToString(row.created_by),
                row.created_at || null,
                row.updated_at || row.created_at || null
            ]
        );
        return id;
    }

    async _upsertTask(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        const sql = `INSERT INTO tasks (
                id, order_id, title, description, due_at, completed, status, priority, assigned_to, created_by, created_at, updated_at
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
             ON CONFLICT(id) DO UPDATE SET
                order_id = COALESCE(excluded.order_id, tasks.order_id),
                title = COALESCE(excluded.title, tasks.title),
                description = COALESCE(excluded.description, tasks.description),
                due_at = COALESCE(excluded.due_at, tasks.due_at),
                completed = COALESCE(excluded.completed, tasks.completed),
                status = COALESCE(excluded.status, tasks.status),
                priority = COALESCE(excluded.priority, tasks.priority),
                assigned_to = COALESCE(excluded.assigned_to, tasks.assigned_to),
                created_by = COALESCE(excluded.created_by, tasks.created_by),
                updated_at = COALESCE(excluded.updated_at, tasks.updated_at)`;

        const values = [
            id,
            this._safeToString(row.order_id),
            row.title || 'Task',
            row.description || null,
            row.due_at || null,
            Number(row.completed || 0),
            row.status || (Number(row.completed || 0) ? 'completed' : 'pending'),
            row.priority || 'normal',
            this._safeToString(row.assigned_to),
            this._safeToString(row.created_by),
            row.created_at || null,
            row.updated_at || row.created_at || null
        ];

        try {
            await this.db.query(sql, values);
        } catch (error) {
            const message = String(error?.message || error || '').toLowerCase();
            if (!message.includes('foreign key constraint failed')) throw error;
            const retryValues = [...values];
            retryValues[1] = null; // order_id
            await this.db.query(sql, retryValues);
        }
        return id;
    }

    async _upsertAuditLog(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        await this.db.query(
            `INSERT OR IGNORE INTO audit_log (id, actor_id, action, entity, entity_id, payload, source, severity, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
            [
                id,
                this._safeToString(row.actor_id),
                row.action || 'unknown_action',
                row.entity || 'unknown_entity',
                this._safeToString(row.entity_id),
                this._asJsonString(row.payload) || row.payload || null,
                row.source || null,
                row.severity || 'info',
                row.created_at || null
            ]
        );
        return id;
    }

    async _upsertDocument(row = {}) {
        const id = this._safeToString(row.id) || uuidv4();
        await this.db.query(
            `INSERT INTO documents (id, order_id, type, file_url, status, metadata, created_by, uploaded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
             ON CONFLICT(id) DO UPDATE SET
                order_id = COALESCE(excluded.order_id, documents.order_id),
                type = COALESCE(excluded.type, documents.type),
                file_url = COALESCE(excluded.file_url, documents.file_url),
                status = COALESCE(excluded.status, documents.status),
                metadata = COALESCE(excluded.metadata, documents.metadata),
                created_by = COALESCE(excluded.created_by, documents.created_by),
                uploaded_at = COALESCE(excluded.uploaded_at, documents.uploaded_at)`,
            [
                id,
                this._safeToString(row.order_id),
                row.type || 'document',
                row.file_url || null,
                row.status || 'uploaded',
                this._asJsonString(row.metadata) || row.metadata || null,
                this._safeToString(row.created_by),
                row.uploaded_at || row.created_at || null
            ]
        );
        return id;
    }

    _computeLastCursor(rows, orderColumn = 'updated_at') {
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const sorted = [...rows].sort((a, b) => {
            const ta = String(a?.[orderColumn] || a?.created_at || '');
            const tb = String(b?.[orderColumn] || b?.created_at || '');
            if (ta < tb) return -1;
            if (ta > tb) return 1;
            const ia = String(a?.id || '');
            const ib = String(b?.id || '');
            if (ia < ib) return -1;
            if (ia > ib) return 1;
            return 0;
        });
        const last = sorted[sorted.length - 1];
        return {
            last_remote_updated_at: last?.[orderColumn] || last?.created_at || null,
            last_remote_id: String(last?.id || '')
        };
    }

    async _syncSingleTable(config, syncOptions = {}) {
        const { mode = 'incremental', pageSize = 500, maxPages = 60 } = syncOptions;
        try {
            const fetched = await this._fetchTableRows(config, { mode, pageSize, maxPages });
            const rows = fetched.rows || [];

            let upserted = 0;
            for (const row of rows) {
                await config.upsertLocal(row);
                upserted += 1;
            }

            if (rows.length > 0) {
                const cursor = this._computeLastCursor(rows, fetched.orderColumn || 'updated_at');
                await this._writeCheckpoint(config.name, cursor);
            } else if (mode === 'full') {
                await this._writeCheckpoint(config.name, { full_synced_at: new Date().toISOString() });
            }

            return { table: config.name, success: true, synced: upserted };
        } catch (error) {
            return {
                table: config.name,
                success: false,
                synced: 0,
                error: error?.message || String(error)
            };
        }
    }

    async syncFromSupabaseToLocal({
        includeEvents = true,
        mode = 'incremental',
        pageSize = 500,
        maxPages = 60
    } = {}) {
        if (!this._canRun()) {
            return {
                success: false,
                reason: 'sync_unavailable',
                synced: {}
            };
        }

        const normalizedMode = String(mode || 'incremental').toLowerCase() === 'full'
            ? 'full'
            : 'incremental';

        const tableConfigs = this._getTableConfigs({ includeEvents });
        const perTable = [];
        let hasFailures = false;
        const synced = {};

        for (const config of tableConfigs) {
            const result = await this._syncSingleTable(config, {
                mode: normalizedMode,
                pageSize,
                maxPages
            });
            perTable.push(result);
            synced[config.name] = result.synced || 0;
            if (!result.success) hasFailures = true;
        }

        return {
            success: !hasFailures,
            mode: normalizedMode,
            synced,
            tables: perTable,
            synced_at: new Date().toISOString()
        };
    }
}

module.exports = { CrmSyncService };
