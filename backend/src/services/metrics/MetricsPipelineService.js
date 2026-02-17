const crypto = require('crypto');
const {
    EVENT_TYPE_MAP,
    EVENT_PROFILE_WEIGHTS,
    DEFAULT_EVENT_LIMIT
} = require('./constants');
const { FUNNEL_CONTRACT_REGISTRY } = require('./funnelContractRegistry');

class MetricsPipelineService {
    constructor(db, options = {}) {
        this.db = db;
        this.defaultEventLimit = options.defaultEventLimit || DEFAULT_EVENT_LIMIT;
        this.onBikeMetricsUpdated = typeof options.onBikeMetricsUpdated === 'function'
            ? options.onBikeMetricsUpdated
            : null;
        this.metricEventsSchemaCache = null;
    }

    normalizeEventType(rawType) {
        const key = String(rawType || '').trim().toLowerCase();
        return EVENT_TYPE_MAP[key] || (key || 'unknown');
    }

    sanitizeText(raw, maxLen = 256) {
        if (raw == null) return null;
        const value = String(raw).trim();
        if (!value) return null;
        return value.slice(0, maxLen);
    }

    sanitizeEmail(raw) {
        const value = this.sanitizeText(raw, 320);
        if (!value) return null;
        const normalized = value.toLowerCase();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
    }

    sanitizePhone(raw) {
        const value = this.sanitizeText(raw, 40);
        if (!value) return null;
        const cleaned = value.replace(/[^0-9+]/g, '');
        if (cleaned.length < 7) return null;
        return cleaned.slice(0, 24);
    }

    hashIdentity(raw) {
        const value = this.sanitizeText(raw, 400);
        if (!value) return null;
        return crypto.createHash('sha256').update(value).digest('hex').slice(0, 40);
    }

    async getMetricEventsSchema() {
        if (this.metricEventsSchemaCache) return this.metricEventsSchemaCache;

        const rows = await this.db.query('PRAGMA table_info(metric_events)');
        const byName = new Map((rows || []).map((row) => [String(row.name || '').toLowerCase(), row]));
        const has = (name) => byName.has(String(name).toLowerCase());
        const bikeInfo = byName.get('bike_id');

        this.metricEventsSchemaCache = {
            hasType: has('type'),
            hasEventType: has('event_type'),
            hasValue: has('value'),
            hasMetadata: has('metadata'),
            hasTs: has('ts'),
            hasCreatedAt: has('created_at'),
            hasSessionId: has('session_id'),
            hasReferrer: has('referrer'),
            hasSourcePath: has('source_path'),
            hasDwellMs: has('dwell_ms'),
            hasEventId: has('event_id'),
            hasUserId: has('user_id'),
            hasPersonKey: has('person_key'),
            requiresBikeId: Number(bikeInfo?.notnull || 0) === 1
        };
        return this.metricEventsSchemaCache;
    }

    sanitizeEvent(raw = {}) {
        const bikeId = Number.parseInt(raw.bikeId ?? raw.bike_id, 10);
        const hasBikeId = Number.isInteger(bikeId) && bikeId > 0;

        const normalizedType = this.normalizeEventType(raw.type);
        const value = Number.isFinite(Number(raw.value)) ? Number(raw.value) : 1;
        const dwellMs = Number.isFinite(Number(raw.ms)) ? Math.max(0, Number(raw.ms)) : null;
        const eventId = this.sanitizeText(raw.event_id ?? raw.eventId, 128);

        return {
            bikeId: hasBikeId ? bikeId : null,
            eventType: normalizedType,
            rawType: String(raw.type || ''),
            value,
            metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
            dwellMs,
            timestamp: Number.isFinite(Number(raw.timestamp)) ? Number(raw.timestamp) : Date.now(),
            sessionId: raw.session_id ? String(raw.session_id) : (raw.sessionId ? String(raw.sessionId) : null),
            sourcePath: raw.source_path ? String(raw.source_path) : (raw.sourcePath ? String(raw.sourcePath) : null),
            referrer: raw.referrer ? String(raw.referrer) : null,
            eventId
        };
    }

    hasContractValue(event, context, dottedKey) {
        const key = String(dottedKey || '').trim();
        if (!key) return false;
        const source = key.startsWith('context.') ? (context || {}) : (event || {});
        const lookup = key.startsWith('context.') ? key.slice('context.'.length) : key;
        const value = this.readObjectPath(source, lookup);
        if (value == null) return false;
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'boolean') return true;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return Boolean(value);
    }

    validateFunnelContractBatch(events = [], context = {}) {
        const contracts = FUNNEL_CONTRACT_REGISTRY?.eventContracts || {};
        const requiredTypes = new Set(Object.keys(contracts));
        const counters = new Map();

        for (const event of events) {
            const eventType = String(event?.eventType || '');
            if (!requiredTypes.has(eventType)) continue;
            const contract = contracts[eventType];
            const requiredGroups = Array.isArray(contract?.requiredGroups) ? contract.requiredGroups : [];
            if (!counters.has(eventType)) {
                counters.set(eventType, {
                    eventType,
                    stage: String(contract?.stage || 'unknown'),
                    total: 0,
                    violations: 0,
                    missingGroups: []
                });
            }
            const bucket = counters.get(eventType);
            bucket.total += 1;

            requiredGroups.forEach((group, index) => {
                const variants = Array.isArray(group) ? group : [];
                const ok = variants.some((path) => this.hasContractValue(event, context, path));
                if (!ok) {
                    bucket.violations += 1;
                    bucket.missingGroups.push({
                        index,
                        alternatives: variants
                    });
                }
            });
        }

        const byEvent = [...counters.values()].map((row) => ({
            ...row,
            coveragePct: row.total > 0
                ? Math.max(0, Math.min(100, Math.round(((row.total - row.violations) / row.total) * 10000) / 100))
                : 100
        }));

        return {
            version: FUNNEL_CONTRACT_REGISTRY?.version || 'unknown',
            criticalPath: Array.isArray(FUNNEL_CONTRACT_REGISTRY?.criticalPath) ? FUNNEL_CONTRACT_REGISTRY.criticalPath : [],
            checkedEvents: byEvent.reduce((sum, row) => sum + Number(row.total || 0), 0),
            violationsTotal: byEvent.reduce((sum, row) => sum + Number(row.violations || 0), 0),
            byEvent
        };
    }

    readObjectPath(obj, dottedKey) {
        if (!obj || typeof obj !== 'object') return null;
        const path = String(dottedKey || '').split('.').filter(Boolean);
        if (path.length === 0) return null;
        let cursor = obj;
        for (const chunk of path) {
            if (!cursor || typeof cursor !== 'object' || !(chunk in cursor)) return null;
            cursor = cursor[chunk];
        }
        return cursor;
    }

    pickAttributionValue(event, context, keys = []) {
        const metadata = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
        const contextAttribution = context?.attribution && typeof context.attribution === 'object'
            ? context.attribution
            : {};
        for (const key of keys) {
            const fromMeta = this.sanitizeText(this.readObjectPath(metadata, key), 256);
            if (fromMeta) return fromMeta;
            const fromContext = this.sanitizeText(contextAttribution[key], 256);
            if (fromContext) return fromContext;
        }
        return null;
    }

    pickIdentityValue(events = [], context = {}, keys = [], maxLen = 256) {
        for (const event of events) {
            const metadata = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
            for (const key of keys) {
                const fromMeta = this.sanitizeText(this.readObjectPath(metadata, key), maxLen);
                if (fromMeta) return fromMeta;
            }
        }
        for (const key of keys) {
            const fromCtx = this.sanitizeText(this.readObjectPath(context, key), maxLen);
            if (fromCtx) return fromCtx;
        }
        return null;
    }

    normalizeIdentityContext(context = {}, events = []) {
        const sessionId = this.sanitizeText(context.sessionId || events.find((e) => e?.sessionId)?.sessionId, 128);
        const userId = Number.isInteger(Number(context.userId)) && Number(context.userId) > 0
            ? Number(context.userId)
            : null;

        const crmLeadId = this.pickIdentityValue(events, context, [
            'crmLeadId',
            'crm_lead_id',
            'leadId',
            'lead_id',
            'metadata.crm_lead_id',
            'metadata.lead_id',
            'attribution.crm_lead_id'
        ], 128);

        const emailHash = this.pickIdentityValue(events, context, [
            'customerEmailHash',
            'customer_email_hash',
            'metadata.customer_email_hash'
        ], 128);

        const phoneHash = this.pickIdentityValue(events, context, [
            'customerPhoneHash',
            'customer_phone_hash',
            'metadata.customer_phone_hash'
        ], 128);

        const rawEmail = this.pickIdentityValue(events, context, [
            'customerEmail',
            'customer_email',
            'email',
            'metadata.customer_email',
            'metadata.email'
        ], 320);

        const rawPhone = this.pickIdentityValue(events, context, [
            'customerPhone',
            'customer_phone',
            'phone',
            'metadata.customer_phone',
            'metadata.phone'
        ], 64);

        const normalizedEmail = this.sanitizeEmail(rawEmail);
        const normalizedPhone = this.sanitizePhone(rawPhone);

        return {
            sessionId,
            userId,
            crmLeadId: crmLeadId || null,
            customerEmailHash: emailHash || (normalizedEmail ? this.hashIdentity(normalizedEmail) : null),
            customerPhoneHash: phoneHash || (normalizedPhone ? this.hashIdentity(normalizedPhone) : null)
        };
    }

    buildIdentityTokens(identity = {}) {
        const tokens = [];
        if (identity.sessionId) tokens.push({ type: 'session', value: identity.sessionId });
        if (identity.userId) tokens.push({ type: 'user', value: String(identity.userId) });
        if (identity.crmLeadId) tokens.push({ type: 'crm_lead', value: identity.crmLeadId });
        if (identity.customerEmailHash) tokens.push({ type: 'email_hash', value: identity.customerEmailHash });
        if (identity.customerPhoneHash) tokens.push({ type: 'phone_hash', value: identity.customerPhoneHash });
        return tokens;
    }

    resolvePreferredPersonKey(identity = {}, existingKeys = []) {
        const preferred = [];
        if (identity.userId) preferred.push(`user:${identity.userId}`);
        if (identity.crmLeadId) preferred.push(`lead:${identity.crmLeadId}`);
        if (identity.customerEmailHash) preferred.push(`email:${identity.customerEmailHash.slice(0, 24)}`);
        if (identity.customerPhoneHash) preferred.push(`phone:${identity.customerPhoneHash.slice(0, 24)}`);
        if (identity.sessionId) preferred.push(`session:${identity.sessionId}`);

        for (const key of preferred) {
            if (existingKeys.includes(key)) return key;
        }

        if (preferred.length > 0) return preferred[0];
        if (existingKeys.length > 0) return existingKeys.sort((a, b) => String(a).localeCompare(String(b)))[0];
        return `anon:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    }

    async loadIdentityNodes(tokens = []) {
        if (!Array.isArray(tokens) || tokens.length === 0) return [];
        const clauses = tokens.map(() => '(identity_type = ? AND identity_value = ?)').join(' OR ');
        const params = [];
        for (const token of tokens) {
            params.push(token.type, token.value);
        }
        return this.db.query(
            `SELECT identity_type, identity_value, person_key, user_id, session_id, crm_lead_id
             FROM metrics_identity_nodes
             WHERE ${clauses}`,
            params
        );
    }

    async resolvePersonKey(identity = {}) {
        const tokens = this.buildIdentityTokens(identity);
        if (tokens.length === 0) return { personKey: null, ...identity };
        const rows = await this.loadIdentityNodes(tokens);
        const existingKeys = [...new Set(rows.map((row) => String(row.person_key || '')).filter(Boolean))];
        const personKey = this.resolvePreferredPersonKey(identity, existingKeys);
        return { personKey, ...identity };
    }

    async mergeIdentityPersonKeys(personKey, existingKeys = []) {
        const toMerge = [...new Set(existingKeys)].filter((key) => key && key !== personKey);
        if (toMerge.length === 0) return;
        const placeholders = toMerge.map(() => '?').join(',');

        await this.db.query(
            `UPDATE metrics_identity_nodes
             SET person_key = ?, updated_at = datetime('now')
             WHERE person_key IN (${placeholders})`,
            [personKey, ...toMerge]
        );

        try {
            await this.db.query(
                `UPDATE metrics_session_facts
                 SET person_key = ?, updated_at = datetime('now')
                 WHERE person_key IN (${placeholders})`,
                [personKey, ...toMerge]
            );
        } catch {
            // Older schema may not have person_key yet.
        }

        try {
            await this.db.query(
                `UPDATE metrics_feature_store
                 SET person_key = ?, updated_at = datetime('now')
                 WHERE person_key IN (${placeholders})`,
                [personKey, ...toMerge]
            );
        } catch {
            // Feature store may not exist in legacy DB snapshots.
        }
    }

    async stitchIdentity(identity = {}) {
        const tokens = this.buildIdentityTokens(identity);
        if (tokens.length === 0) return { personKey: null, ...identity };

        const rows = await this.loadIdentityNodes(tokens);
        const existingKeys = [...new Set(rows.map((row) => String(row.person_key || '')).filter(Boolean))];
        const personKey = this.resolvePreferredPersonKey(identity, existingKeys);

        await this.mergeIdentityPersonKeys(personKey, existingKeys);

        for (const token of tokens) {
            await this.db.query(
                `INSERT INTO metrics_identity_nodes (
                    identity_type,
                    identity_value,
                    person_key,
                    user_id,
                    session_id,
                    crm_lead_id,
                    first_seen_at,
                    last_seen_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
                ON CONFLICT(identity_type, identity_value) DO UPDATE SET
                    person_key = excluded.person_key,
                    user_id = COALESCE(excluded.user_id, metrics_identity_nodes.user_id),
                    session_id = COALESCE(excluded.session_id, metrics_identity_nodes.session_id),
                    crm_lead_id = COALESCE(excluded.crm_lead_id, metrics_identity_nodes.crm_lead_id),
                    last_seen_at = datetime('now'),
                    updated_at = datetime('now')`,
                [
                    token.type,
                    token.value,
                    personKey,
                    identity.userId || null,
                    identity.sessionId || null,
                    identity.crmLeadId || null
                ]
            );
        }

        return {
            ...identity,
            personKey
        };
    }

    buildSessionFactRows(events = [], context = {}) {
        const grouped = new Map();
        const fallbackSessionId = this.sanitizeText(context.sessionId, 128);

        const touch = (sessionId) => {
            if (!grouped.has(sessionId)) {
                grouped.set(sessionId, {
                    sessionId,
                    personKey: this.sanitizeText(context.personKey, 160),
                    crmLeadId: this.sanitizeText(context.crmLeadId, 128),
                    customerEmailHash: this.sanitizeText(context.customerEmailHash, 128),
                    customerPhoneHash: this.sanitizeText(context.customerPhoneHash, 128),
                    eventCount: 0,
                    pageViews: 0,
                    firstClicks: 0,
                    catalogViews: 0,
                    productViews: 0,
                    addToCart: 0,
                    checkoutStarts: 0,
                    checkoutSteps: 0,
                    checkoutValidationErrors: 0,
                    checkoutSubmitAttempts: 0,
                    checkoutSubmitSuccess: 0,
                    checkoutSubmitFailed: 0,
                    formsSeen: 0,
                    formsFirstInput: 0,
                    formSubmitAttempts: 0,
                    formValidationErrors: 0,
                    bookingStarts: 0,
                    bookingSuccess: 0,
                    orders: 0,
                    dwellMsSum: 0,
                    firstSourcePath: null,
                    lastSourcePath: null,
                    entryReferrer: null,
                    utmSource: null,
                    utmMedium: null,
                    utmCampaign: null,
                    clickId: null,
                    landingPath: null
                });
            }
            return grouped.get(sessionId);
        };

        for (const event of events) {
            const sessionId = this.sanitizeText(event.sessionId, 128) || fallbackSessionId;
            if (!sessionId) continue;

            const row = touch(sessionId);
            row.eventCount += 1;
            row.dwellMsSum += Number(event.dwellMs || 0);

            if (!row.crmLeadId) {
                row.crmLeadId = this.pickIdentityValue([event], context, ['crmLeadId', 'crm_lead_id', 'metadata.crm_lead_id'], 128);
            }
            if (!row.customerEmailHash) {
                row.customerEmailHash = this.pickIdentityValue([event], context, ['customerEmailHash', 'customer_email_hash', 'metadata.customer_email_hash'], 128);
            }
            if (!row.customerPhoneHash) {
                row.customerPhoneHash = this.pickIdentityValue([event], context, ['customerPhoneHash', 'customer_phone_hash', 'metadata.customer_phone_hash'], 128);
            }

            const sourcePath = this.sanitizeText(event.sourcePath || context.sourcePath, 256);
            const referrer = this.sanitizeText(event.referrer || context.referrer, 256);

            if (!row.firstSourcePath && sourcePath) row.firstSourcePath = sourcePath;
            if (sourcePath) row.lastSourcePath = sourcePath;
            if (!row.entryReferrer && referrer) row.entryReferrer = referrer;

            if (!row.utmSource) {
                row.utmSource = this.pickAttributionValue(event, context, ['utm_source', 'attribution.utm_source']);
            }
            if (!row.utmMedium) {
                row.utmMedium = this.pickAttributionValue(event, context, ['utm_medium', 'attribution.utm_medium']);
            }
            if (!row.utmCampaign) {
                row.utmCampaign = this.pickAttributionValue(event, context, ['utm_campaign', 'attribution.utm_campaign']);
            }
            if (!row.clickId) {
                row.clickId = this.pickAttributionValue(event, context, ['click_id', 'attribution.click_id']);
            }
            if (!row.landingPath) {
                row.landingPath = this.pickAttributionValue(event, context, ['landing_path', 'attribution.landing_path']);
            }

            switch (event.eventType) {
                case 'page_view':
                    row.pageViews += 1;
                    break;
                case 'first_click':
                    row.firstClicks += 1;
                    break;
                case 'catalog_view':
                    row.catalogViews += 1;
                    break;
                case 'product_view':
                case 'detail_open':
                    row.productViews += 1;
                    break;
                case 'add_to_cart':
                    row.addToCart += 1;
                    break;
                case 'checkout_start':
                    row.checkoutStarts += 1;
                    break;
                case 'checkout_step':
                    row.checkoutSteps += 1;
                    break;
                case 'checkout_validation_error':
                case 'checkout_field_error':
                    row.checkoutValidationErrors += 1;
                    break;
                case 'checkout_submit_attempt':
                    row.checkoutSubmitAttempts += 1;
                    break;
                case 'checkout_submit_success':
                    row.checkoutSubmitSuccess += 1;
                    break;
                case 'checkout_submit_failed':
                case 'checkout_abandon':
                    row.checkoutSubmitFailed += 1;
                    break;
                case 'form_seen':
                    row.formsSeen += 1;
                    break;
                case 'form_first_input':
                    row.formsFirstInput += 1;
                    break;
                case 'form_submit_attempt':
                    row.formSubmitAttempts += 1;
                    break;
                case 'form_validation_error':
                    row.formValidationErrors += 1;
                    break;
                case 'booking_start':
                    row.bookingStarts += 1;
                    break;
                case 'booking_success':
                    row.bookingSuccess += 1;
                    break;
                case 'order':
                    row.orders += 1;
                    break;
                default:
                    break;
            }
        }

        return [...grouped.values()];
    }

    async upsertSessionFacts(events = [], context = {}) {
        const rows = this.buildSessionFactRows(events, context);
        if (rows.length === 0) return;

        const userId = context.userId || null;
        const isBot = context.isBot ? 1 : 0;

        for (const row of rows) {
            await this.db.query(
                `INSERT INTO metrics_session_facts (
                    session_id,
                    person_key,
                    user_id,
                    crm_lead_id,
                    customer_email_hash,
                    customer_phone_hash,
                    first_seen_at,
                    last_seen_at,
                    event_count,
                    page_views,
                    first_clicks,
                    catalog_views,
                    product_views,
                    add_to_cart,
                    checkout_starts,
                    checkout_steps,
                    checkout_validation_errors,
                    checkout_submit_attempts,
                    checkout_submit_success,
                    checkout_submit_failed,
                    forms_seen,
                    forms_first_input,
                    form_submit_attempts,
                    form_validation_errors,
                    booking_starts,
                    booking_success,
                    orders,
                    dwell_ms_sum,
                    first_source_path,
                    last_source_path,
                    entry_referrer,
                    utm_source,
                    utm_medium,
                    utm_campaign,
                    click_id,
                    landing_path,
                    is_bot,
                    updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'),
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
                )
                ON CONFLICT(session_id) DO UPDATE SET
                    person_key = COALESCE(metrics_session_facts.person_key, excluded.person_key),
                    user_id = COALESCE(metrics_session_facts.user_id, excluded.user_id),
                    crm_lead_id = COALESCE(metrics_session_facts.crm_lead_id, excluded.crm_lead_id),
                    customer_email_hash = COALESCE(metrics_session_facts.customer_email_hash, excluded.customer_email_hash),
                    customer_phone_hash = COALESCE(metrics_session_facts.customer_phone_hash, excluded.customer_phone_hash),
                    last_seen_at = datetime('now'),
                    event_count = metrics_session_facts.event_count + excluded.event_count,
                    page_views = metrics_session_facts.page_views + excluded.page_views,
                    first_clicks = metrics_session_facts.first_clicks + excluded.first_clicks,
                    catalog_views = metrics_session_facts.catalog_views + excluded.catalog_views,
                    product_views = metrics_session_facts.product_views + excluded.product_views,
                    add_to_cart = metrics_session_facts.add_to_cart + excluded.add_to_cart,
                    checkout_starts = metrics_session_facts.checkout_starts + excluded.checkout_starts,
                    checkout_steps = metrics_session_facts.checkout_steps + excluded.checkout_steps,
                    checkout_validation_errors = metrics_session_facts.checkout_validation_errors + excluded.checkout_validation_errors,
                    checkout_submit_attempts = metrics_session_facts.checkout_submit_attempts + excluded.checkout_submit_attempts,
                    checkout_submit_success = metrics_session_facts.checkout_submit_success + excluded.checkout_submit_success,
                    checkout_submit_failed = metrics_session_facts.checkout_submit_failed + excluded.checkout_submit_failed,
                    forms_seen = metrics_session_facts.forms_seen + excluded.forms_seen,
                    forms_first_input = metrics_session_facts.forms_first_input + excluded.forms_first_input,
                    form_submit_attempts = metrics_session_facts.form_submit_attempts + excluded.form_submit_attempts,
                    form_validation_errors = metrics_session_facts.form_validation_errors + excluded.form_validation_errors,
                    booking_starts = metrics_session_facts.booking_starts + excluded.booking_starts,
                    booking_success = metrics_session_facts.booking_success + excluded.booking_success,
                    orders = metrics_session_facts.orders + excluded.orders,
                    dwell_ms_sum = metrics_session_facts.dwell_ms_sum + excluded.dwell_ms_sum,
                    first_source_path = COALESCE(metrics_session_facts.first_source_path, excluded.first_source_path),
                    last_source_path = COALESCE(excluded.last_source_path, metrics_session_facts.last_source_path),
                    entry_referrer = COALESCE(metrics_session_facts.entry_referrer, excluded.entry_referrer),
                    utm_source = COALESCE(metrics_session_facts.utm_source, excluded.utm_source),
                    utm_medium = COALESCE(metrics_session_facts.utm_medium, excluded.utm_medium),
                    utm_campaign = COALESCE(metrics_session_facts.utm_campaign, excluded.utm_campaign),
                    click_id = COALESCE(metrics_session_facts.click_id, excluded.click_id),
                    landing_path = COALESCE(metrics_session_facts.landing_path, excluded.landing_path),
                    is_bot = CASE WHEN metrics_session_facts.is_bot = 1 OR excluded.is_bot = 1 THEN 1 ELSE 0 END,
                    updated_at = datetime('now')`,
                [
                    row.sessionId,
                    row.personKey,
                    userId,
                    row.crmLeadId,
                    row.customerEmailHash,
                    row.customerPhoneHash,
                    row.eventCount,
                    row.pageViews,
                    row.firstClicks,
                    row.catalogViews,
                    row.productViews,
                    row.addToCart,
                    row.checkoutStarts,
                    row.checkoutSteps,
                    row.checkoutValidationErrors,
                    row.checkoutSubmitAttempts,
                    row.checkoutSubmitSuccess,
                    row.checkoutSubmitFailed,
                    row.formsSeen,
                    row.formsFirstInput,
                    row.formSubmitAttempts,
                    row.formValidationErrors,
                    row.bookingStarts,
                    row.bookingSuccess,
                    row.orders,
                    row.dwellMsSum,
                    row.firstSourcePath,
                    row.lastSourcePath,
                    row.entryReferrer,
                    row.utmSource,
                    row.utmMedium,
                    row.utmCampaign,
                    row.clickId,
                    row.landingPath,
                    isBot
                ]
            );
        }
    }

    async findExistingEventIds(eventIds = []) {
        if (!Array.isArray(eventIds) || eventIds.length === 0) return new Set();
        const placeholders = eventIds.map(() => '?').join(',');
        const rows = await this.db.query(
            `SELECT event_id FROM metric_events WHERE event_id IN (${placeholders})`,
            eventIds
        );
        const existing = new Set();
        for (const row of rows) {
            const eventId = this.sanitizeText(row?.event_id, 128);
            if (eventId) existing.add(eventId);
        }
        return existing;
    }

    async filterDuplicateEvents(events = []) {
        const inBatchSeen = new Set();
        const deduped = [];
        const withEventIds = [];
        let duplicateDropped = 0;

        for (const event of events) {
            const eventId = this.sanitizeText(event?.eventId, 128);
            if (!eventId) {
                deduped.push(event);
                continue;
            }

            if (inBatchSeen.has(eventId)) {
                duplicateDropped += 1;
                continue;
            }

            inBatchSeen.add(eventId);
            withEventIds.push(eventId);
            deduped.push({ ...event, eventId });
        }

        const existing = await this.findExistingEventIds(withEventIds);
        if (existing.size === 0) {
            return { events: deduped, duplicateDropped };
        }

        const filtered = [];
        for (const event of deduped) {
            if (event.eventId && existing.has(event.eventId)) {
                duplicateDropped += 1;
                continue;
            }
            filtered.push(event);
        }

        return { events: filtered, duplicateDropped };
    }

    aggregateBikeMetrics(events) {
        const perBike = new Map();

        const touch = (bikeId) => {
            if (!perBike.has(bikeId)) {
                perBike.set(bikeId, {
                    impressions: 0,
                    detail_clicks: 0,
                    hovers: 0,
                    gallery_swipes: 0,
                    favorites: 0,
                    add_to_cart: 0,
                    shares: 0,
                    scroll_stops: 0,
                    dwell_time_ms: 0,
                    orders: 0,
                    bounces: 0
                });
            }
            return perBike.get(bikeId);
        };

        for (const event of events) {
            if (!event.bikeId) continue;
            const m = touch(event.bikeId);
            switch (event.eventType) {
                case 'impression':
                    m.impressions += 1;
                    break;
                case 'detail_open':
                    m.detail_clicks += 1;
                    break;
                case 'hover':
                    m.hovers += 1;
                    break;
                case 'gallery_swipe':
                    m.gallery_swipes += 1;
                    break;
                case 'favorite':
                    m.favorites += 1;
                    break;
                case 'add_to_cart':
                    m.add_to_cart += 1;
                    break;
                case 'share':
                    m.shares += 1;
                    break;
                case 'scroll_stop':
                    m.scroll_stops += 1;
                    break;
                case 'dwell':
                    m.dwell_time_ms += Number(event.dwellMs || 0);
                    break;
                case 'order':
                    m.orders += 1;
                    break;
                case 'bounce':
                    m.bounces += 1;
                    break;
                default:
                    break;
            }
        }

        return perBike;
    }

    async persistRawEvents(events, context) {
        const userId = context.userId || null;
        const attribution = context.attribution && typeof context.attribution === 'object'
            ? context.attribution
            : {};
        const schema = await this.getMetricEventsSchema();

        for (const event of events) {
            const metadata = {
                ...event.metadata,
                raw_type: event.rawType || null,
                source: context.source,
                is_bot: Boolean(context.isBot),
                attribution,
                person_key: context.personKey || null,
                crm_lead_id: context.crmLeadId || null,
                customer_email_hash: context.customerEmailHash || null,
                customer_phone_hash: context.customerPhoneHash || null
            };
            const compatBikeId = Number.isInteger(Number(event.bikeId)) && Number(event.bikeId) > 0
                ? Number(event.bikeId)
                : (schema.requiresBikeId ? 0 : null);

            const columns = ['bike_id'];
            const placeholders = ['?'];
            const params = [compatBikeId];

            if (schema.hasType) {
                columns.push('type');
                placeholders.push('?');
                params.push(event.eventType);
            }
            if (schema.hasEventType) {
                columns.push('event_type');
                placeholders.push('?');
                params.push(event.eventType);
            }
            if (schema.hasValue) {
                columns.push('value');
                placeholders.push('?');
                params.push(event.value);
            }
            if (schema.hasMetadata) {
                columns.push('metadata');
                placeholders.push('?');
                params.push(JSON.stringify(metadata));
            }
            if (schema.hasTs) {
                columns.push('ts');
                placeholders.push("datetime('now')");
            }
            if (schema.hasCreatedAt) {
                columns.push('created_at');
                placeholders.push("datetime('now')");
            }
            if (schema.hasSessionId) {
                columns.push('session_id');
                placeholders.push('?');
                params.push(event.sessionId || context.sessionId);
            }
            if (schema.hasReferrer) {
                columns.push('referrer');
                placeholders.push('?');
                params.push(event.referrer || context.referrer);
            }
            if (schema.hasSourcePath) {
                columns.push('source_path');
                placeholders.push('?');
                params.push(event.sourcePath || context.sourcePath);
            }
            if (schema.hasDwellMs) {
                columns.push('dwell_ms');
                placeholders.push('?');
                params.push(event.dwellMs);
            }
            if (schema.hasEventId) {
                columns.push('event_id');
                placeholders.push('?');
                params.push(event.eventId);
            }
            if (schema.hasUserId) {
                columns.push('user_id');
                placeholders.push('?');
                params.push(userId);
            }
            if (schema.hasPersonKey) {
                columns.push('person_key');
                placeholders.push('?');
                params.push(context.personKey || null);
            }

            await this.db.query(
                `INSERT INTO metric_events (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
                params
            );
        }
    }

    async persistBikeMetrics(perBike) {
        for (const [bikeId, m] of perBike.entries()) {
            const detailClicksDelta = m.detail_clicks || 0;
            const dwellDelta = m.dwell_time_ms || 0;

            await this.db.query(
                `INSERT INTO bike_behavior_metrics (
                    bike_id,
                    impressions,
                    detail_clicks,
                    hovers,
                    gallery_swipes,
                    favorites,
                    add_to_cart,
                    shares,
                    scroll_stops,
                    dwell_time_ms,
                    orders,
                    bounces,
                    avg_dwell_ms,
                    period_start,
                    period_end
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(bike_id) DO UPDATE SET
                    impressions = bike_behavior_metrics.impressions + excluded.impressions,
                    detail_clicks = bike_behavior_metrics.detail_clicks + excluded.detail_clicks,
                    hovers = bike_behavior_metrics.hovers + excluded.hovers,
                    gallery_swipes = bike_behavior_metrics.gallery_swipes + excluded.gallery_swipes,
                    favorites = bike_behavior_metrics.favorites + excluded.favorites,
                    add_to_cart = bike_behavior_metrics.add_to_cart + excluded.add_to_cart,
                    shares = bike_behavior_metrics.shares + excluded.shares,
                    scroll_stops = bike_behavior_metrics.scroll_stops + excluded.scroll_stops,
                    dwell_time_ms = bike_behavior_metrics.dwell_time_ms + excluded.dwell_time_ms,
                    orders = bike_behavior_metrics.orders + excluded.orders,
                    bounces = bike_behavior_metrics.bounces + excluded.bounces,
                    avg_dwell_ms = CASE
                        WHEN (bike_behavior_metrics.detail_clicks + excluded.detail_clicks) > 0
                            THEN CAST((bike_behavior_metrics.dwell_time_ms + excluded.dwell_time_ms) / (bike_behavior_metrics.detail_clicks + excluded.detail_clicks) AS INTEGER)
                        ELSE bike_behavior_metrics.avg_dwell_ms
                    END,
                    period_end = datetime('now')`,
                [
                    bikeId,
                    m.impressions,
                    detailClicksDelta,
                    m.hovers,
                    m.gallery_swipes,
                    m.favorites,
                    m.add_to_cart,
                    m.shares,
                    m.scroll_stops,
                    dwellDelta,
                    m.orders,
                    m.bounces,
                    detailClicksDelta > 0 ? Math.round(dwellDelta / detailClicksDelta) : 0
                ]
            );

            if (this.onBikeMetricsUpdated) {
                try {
                    await this.onBikeMetricsUpdated(bikeId);
                } catch (_) {
                    // Ranking refresh is best effort.
                }
            }
        }
    }

    async getBikeSnapshotMap(events) {
        const ids = [...new Set(events.map((e) => e.bikeId).filter(Boolean))];
        if (ids.length === 0) return new Map();

        const placeholders = ids.map(() => '?').join(',');
        const rows = await this.db.query(
            `SELECT id, brand, discipline, category, price
             FROM bikes
             WHERE id IN (${placeholders})`,
            ids
        );

        const map = new Map();
        for (const row of rows) {
            map.set(Number(row.id), row);
        }
        return map;
    }

    resolveProfileKey(userId, sessionId, personKey = null) {
        if (personKey) return `person:${personKey}`;
        if (userId) return `user:${userId}`;
        if (sessionId) return `session:${sessionId}`;
        return null;
    }

    async loadExistingProfiles(profileKeys) {
        if (profileKeys.length === 0) return new Map();
        const placeholders = profileKeys.map(() => '?').join(',');
        const rows = await this.db.query(
            `SELECT * FROM user_interest_profiles WHERE profile_key IN (${placeholders})`,
            profileKeys
        );

        const profiles = new Map();
        for (const row of rows) {
            profiles.set(String(row.profile_key), {
                ...row,
                disciplines: row.disciplines_json ? JSON.parse(row.disciplines_json) : {},
                brands: row.brands_json ? JSON.parse(row.brands_json) : {}
            });
        }
        return profiles;
    }

    scaleMap(mapObj = {}, factor = 1) {
        const out = {};
        for (const [key, value] of Object.entries(mapObj || {})) {
            const scaled = Number(value || 0) * factor;
            if (scaled > 0.0001) out[key] = Math.round(scaled * 1000) / 1000;
        }
        return out;
    }

    applyRecencyDecay(profile) {
        if (!profile) return;
        const lastEvent = profile.last_event_at || profile.lastEventAt || profile.updated_at || null;
        if (!lastEvent) return;

        const lastTs = new Date(String(lastEvent)).getTime();
        if (!Number.isFinite(lastTs) || lastTs <= 0) return;

        const ageHours = Math.max(0, (Date.now() - lastTs) / (60 * 60 * 1000));
        if (ageHours < 1) return;

        const halfLifeHours = 24 * 7;
        const factor = Math.pow(0.5, ageHours / halfLifeHours);
        if (!Number.isFinite(factor) || factor >= 0.999) return;

        profile.disciplines = this.scaleMap(profile.disciplines, factor);
        profile.brands = this.scaleMap(profile.brands, factor);
        profile.price_sum = Number(profile.price_sum || 0) * factor;
        profile.price_weight = Number(profile.price_weight || 0) * factor;
        profile.intent_score = Number(profile.intent_score || 0) * factor;
    }

    async upsertProfiles(updates) {
        for (const profile of updates.values()) {
            const weightedPrice = profile.price_weight > 0
                ? profile.price_sum / profile.price_weight
                : 0;

            await this.db.query(
                `INSERT INTO user_interest_profiles (
                    profile_key,
                    user_id,
                    session_id,
                    disciplines_json,
                    brands_json,
                    price_sum,
                    price_weight,
                    weighted_price,
                    intent_score,
                    last_event_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(profile_key) DO UPDATE SET
                    user_id = COALESCE(excluded.user_id, user_interest_profiles.user_id),
                    session_id = COALESCE(excluded.session_id, user_interest_profiles.session_id),
                    disciplines_json = excluded.disciplines_json,
                    brands_json = excluded.brands_json,
                    price_sum = excluded.price_sum,
                    price_weight = excluded.price_weight,
                    weighted_price = excluded.weighted_price,
                    intent_score = excluded.intent_score,
                    last_event_at = datetime('now'),
                    updated_at = datetime('now')`,
                [
                    profile.profile_key,
                    profile.user_id,
                    profile.session_id,
                    JSON.stringify(profile.disciplines),
                    JSON.stringify(profile.brands),
                    profile.price_sum,
                    profile.price_weight,
                    weightedPrice,
                    profile.intent_score
                ]
            );
        }
    }

    normalizeEmbedding(mapObj = {}, topN = 12) {
        const entries = Object.entries(mapObj || {})
            .map(([key, value]) => [String(key), Number(value || 0)])
            .filter(([, value]) => Number.isFinite(value) && value > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN);

        const sum = entries.reduce((acc, [, value]) => acc + value, 0);
        if (sum <= 0) return {};

        const out = {};
        for (const [key, value] of entries) {
            out[key] = Math.round((value / sum) * 10000) / 10000;
        }
        return out;
    }

    resolveBudgetCluster(weightedPrice) {
        const value = Number(weightedPrice || 0);
        if (value <= 0) return 'unknown';
        if (value < 1000) return 'budget';
        if (value < 2200) return 'value';
        if (value < 4000) return 'mid';
        if (value < 5500) return 'premium';
        return 'ultra';
    }

    async upsertFeatureStore(profile, context) {
        const personKey = this.sanitizeText(context.personKey, 160);
        if (!personKey) return;

        const weightedPrice = Number(profile.price_weight || 0) > 0
            ? Number(profile.price_sum || 0) / Number(profile.price_weight || 1)
            : Number(profile.weighted_price || 0);

        const disciplineEmbedding = this.normalizeEmbedding(profile.disciplines || {});
        const brandEmbedding = this.normalizeEmbedding(profile.brands || {});
        const categoryEmbedding = { ...disciplineEmbedding };
        const budgetCluster = this.resolveBudgetCluster(weightedPrice);

        const recencyHalfLifeDays = 7;
        const recencyDecay = Math.max(0.05, Math.min(1, Math.pow(0.5, 1 / recencyHalfLifeDays)));

        await this.db.query(
            `INSERT INTO metrics_feature_store (
                person_key,
                profile_key,
                user_id,
                session_id,
                crm_lead_id,
                budget_cluster,
                weighted_price,
                intent_score,
                recency_half_life_days,
                recency_decay,
                discipline_embedding_json,
                brand_embedding_json,
                category_embedding_json,
                last_event_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(person_key) DO UPDATE SET
                profile_key = COALESCE(excluded.profile_key, metrics_feature_store.profile_key),
                user_id = COALESCE(excluded.user_id, metrics_feature_store.user_id),
                session_id = COALESCE(excluded.session_id, metrics_feature_store.session_id),
                crm_lead_id = COALESCE(excluded.crm_lead_id, metrics_feature_store.crm_lead_id),
                budget_cluster = excluded.budget_cluster,
                weighted_price = excluded.weighted_price,
                intent_score = excluded.intent_score,
                recency_half_life_days = excluded.recency_half_life_days,
                recency_decay = excluded.recency_decay,
                discipline_embedding_json = excluded.discipline_embedding_json,
                brand_embedding_json = excluded.brand_embedding_json,
                category_embedding_json = excluded.category_embedding_json,
                last_event_at = excluded.last_event_at,
                updated_at = datetime('now')`,
            [
                personKey,
                profile.profile_key,
                context.userId || null,
                context.sessionId || null,
                context.crmLeadId || null,
                budgetCluster,
                weightedPrice,
                Number(profile.intent_score || 0),
                recencyHalfLifeDays,
                recencyDecay,
                JSON.stringify(disciplineEmbedding),
                JSON.stringify(brandEmbedding),
                JSON.stringify(categoryEmbedding)
            ]
        );
    }

    async updateInterestProfiles(events, context) {
        const bikeMap = await this.getBikeSnapshotMap(events);
        const derivedSessionId = context.sessionId || events.find((e) => e.sessionId)?.sessionId || null;
        const profileKey = this.resolveProfileKey(context.userId, derivedSessionId, context.personKey || null);
        if (!profileKey) return null;

        const existing = await this.loadExistingProfiles([profileKey]);
        const profile = existing.get(profileKey) || {
            profile_key: profileKey,
            user_id: context.userId || null,
            session_id: derivedSessionId || null,
            disciplines: {},
            brands: {},
            price_sum: 0,
            price_weight: 0,
            intent_score: 0,
            last_event_at: null
        };

        this.applyRecencyDecay(profile);

        if (!profile.session_id && derivedSessionId) {
            profile.session_id = derivedSessionId;
        }

        for (const event of events) {
            const weight = EVENT_PROFILE_WEIGHTS[event.eventType] || 0;
            if (!weight) continue;

            const bike = event.bikeId ? bikeMap.get(event.bikeId) : null;
            const discipline = bike ? String(bike.discipline || bike.category || '').trim() : '';
            const brand = bike ? String(bike.brand || '').trim() : '';
            const price = bike && Number.isFinite(Number(bike.price)) ? Number(bike.price) : null;

            if (discipline) {
                profile.disciplines[discipline] = Number(profile.disciplines[discipline] || 0) + weight;
            }

            if (brand) {
                profile.brands[brand] = Number(profile.brands[brand] || 0) + (weight * 0.8);
            }

            if (price && weight > 0) {
                profile.price_sum += price * weight;
                profile.price_weight += weight;
            }

            profile.intent_score += weight;
        }

        await this.upsertProfiles(new Map([[profileKey, profile]]));
        await this.upsertFeatureStore(profile, {
            ...context,
            sessionId: derivedSessionId,
            profileKey
        });

        return {
            profileKey,
            profile
        };
    }

    async ingestEvents(rawEvents = [], context = {}) {
        if (!Array.isArray(rawEvents)) {
            return { accepted: 0, dropped: 0, reason: 'invalid_payload' };
        }

        if (context.isBot) {
            return { accepted: 0, dropped: rawEvents.length, reason: 'bot_filtered' };
        }

        const eventLimit = Number.isInteger(Number(context.eventLimit))
            ? Number(context.eventLimit)
            : this.defaultEventLimit;

        const normalized = rawEvents
            .slice(0, Math.max(1, eventLimit))
            .map((raw) => this.sanitizeEvent(raw));

        const dropped = Math.max(0, rawEvents.length - normalized.length);
        const { events: accepted, duplicateDropped } = await this.filterDuplicateEvents(normalized);

        if (accepted.length === 0) {
            return { accepted: 0, dropped: dropped + duplicateDropped, duplicateDropped, reason: 'empty_batch' };
        }

        const identityBase = this.normalizeIdentityContext(context, accepted);
        const identity = await this.stitchIdentity(identityBase);
        const enrichedContext = {
            ...context,
            ...identity,
            userId: identity.userId || context.userId || null,
            sessionId: identity.sessionId || context.sessionId || null,
            crmLeadId: identity.crmLeadId || null,
            customerEmailHash: identity.customerEmailHash || null,
            customerPhoneHash: identity.customerPhoneHash || null,
            personKey: identity.personKey || null
        };

        const funnelContract = this.validateFunnelContractBatch(accepted, enrichedContext);
        if (Number(funnelContract.violationsTotal || 0) > 0) {
            const compact = (funnelContract.byEvent || [])
                .filter((row) => Number(row.violations || 0) > 0)
                .map((row) => `${row.eventType}:${row.violations}`)
                .join(', ');
            try {
                await this.db.query(
                    'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
                    ['warning', 'metrics_funnel_contract', `Contract violations detected: ${compact}`.slice(0, 500)]
                );
            } catch {
                // Logging must never block ingestion.
            }
        }

        await this.persistRawEvents(accepted, enrichedContext);
        const perBike = this.aggregateBikeMetrics(accepted);
        await this.persistBikeMetrics(perBike);
        await this.updateInterestProfiles(accepted, enrichedContext);
        await this.upsertSessionFacts(accepted, enrichedContext);

        return {
            accepted: accepted.length,
            dropped: dropped + duplicateDropped,
            duplicateDropped,
            bikeUpdates: perBike.size,
            personKey: enrichedContext.personKey || null,
            funnelContract
        };
    }

    async trackSearch(payload = {}, context = {}) {
        const query = payload.query != null ? String(payload.query).trim() : '';
        const category = payload.category != null ? String(payload.category).trim() : '';
        const brand = payload.brand != null ? String(payload.brand).trim() : '';
        const minPrice = Number.isFinite(Number(payload.minPrice)) ? Number(payload.minPrice) : null;
        const maxPrice = Number.isFinite(Number(payload.maxPrice)) ? Number(payload.maxPrice) : null;

        if (!query && !category && !brand) {
            return { accepted: false, reason: 'empty_search' };
        }

        await this.db.query(
            `INSERT INTO search_events (
                session_id,
                user_id,
                query,
                category,
                brand,
                min_price,
                max_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                context.sessionId || null,
                context.userId || null,
                query || null,
                category || null,
                brand || null,
                minPrice,
                maxPrice
            ]
        );

        return { accepted: true };
    }

    async getProfile({ userId = null, sessionId = null, crmLeadId = null } = {}) {
        const identity = await this.resolvePersonKey(this.normalizeIdentityContext({ userId, sessionId, crmLeadId }, []));
        const personKey = identity.personKey || null;

        const priorityKeys = [
            this.resolveProfileKey(userId, sessionId, personKey),
            userId ? `user:${userId}` : null,
            sessionId ? `session:${sessionId}` : null
        ].filter(Boolean);

        if (priorityKeys.length === 0) return null;

        const placeholders = priorityKeys.map(() => '?').join(',');
        const rows = await this.db.query(
            `SELECT * FROM user_interest_profiles WHERE profile_key IN (${placeholders})`,
            priorityKeys
        );

        const rowByKey = new Map(rows.map((row) => [String(row.profile_key), row]));
        const selected = priorityKeys.map((key) => rowByKey.get(key)).find(Boolean) || null;
        if (!selected) return null;

        let featureStore = null;
        if (personKey) {
            try {
                const fsRows = await this.db.query(
                    `SELECT * FROM metrics_feature_store WHERE person_key = ? LIMIT 1`,
                    [personKey]
                );
                const fsRow = fsRows[0];
                if (fsRow) {
                    featureStore = {
                        personKey: fsRow.person_key,
                        profileKey: fsRow.profile_key,
                        userId: fsRow.user_id,
                        sessionId: fsRow.session_id,
                        crmLeadId: fsRow.crm_lead_id,
                        budgetCluster: fsRow.budget_cluster,
                        weightedPrice: Number(fsRow.weighted_price || 0),
                        intentScore: Number(fsRow.intent_score || 0),
                        recencyHalfLifeDays: Number(fsRow.recency_half_life_days || 7),
                        recencyDecay: Number(fsRow.recency_decay || 1),
                        disciplineEmbedding: fsRow.discipline_embedding_json ? JSON.parse(fsRow.discipline_embedding_json) : {},
                        brandEmbedding: fsRow.brand_embedding_json ? JSON.parse(fsRow.brand_embedding_json) : {},
                        categoryEmbedding: fsRow.category_embedding_json ? JSON.parse(fsRow.category_embedding_json) : {},
                        lastEventAt: fsRow.last_event_at || null,
                        updatedAt: fsRow.updated_at || null
                    };
                }
            } catch {
                featureStore = null;
            }
        }

        return {
            profileKey: selected.profile_key,
            personKey,
            userId: selected.user_id,
            sessionId: selected.session_id,
            disciplines: selected.disciplines_json ? JSON.parse(selected.disciplines_json) : {},
            brands: selected.brands_json ? JSON.parse(selected.brands_json) : {},
            priceSensitivity: {
                sum: Number(selected.price_sum || 0),
                count: Number(selected.price_weight || 0),
                weightedAverage: Number(selected.weighted_price || 0)
            },
            intentScore: Number(selected.intent_score || 0),
            insight: selected.insight_text || null,
            insightModel: selected.insight_model || null,
            insightUpdatedAt: selected.insight_updated_at || null,
            lastEventAt: selected.last_event_at || null,
            featureStore
        };
    }
}

module.exports = {
    MetricsPipelineService
};
