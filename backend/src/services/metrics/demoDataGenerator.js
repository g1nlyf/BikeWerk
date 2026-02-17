const crypto = require('crypto');

function createRng(seedInput) {
    let seed = Number(seedInput);
    if (!Number.isFinite(seed) || seed <= 0) {
        seed = Date.now();
    }
    let state = Math.floor(seed) % 2147483647;
    if (state <= 0) state += 2147483646;
    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
}

function toSqliteDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function pickWeighted(rng, items, weightKey = 'weight') {
    const list = Array.isArray(items) ? items : [];
    const total = list.reduce((sum, item) => sum + Math.max(0, Number(item?.[weightKey] || 0)), 0);
    if (total <= 0 || list.length === 0) return list[0] || null;
    const target = rng() * total;
    let cursor = 0;
    for (const item of list) {
        cursor += Math.max(0, Number(item?.[weightKey] || 0));
        if (target <= cursor) return item;
    }
    return list[list.length - 1] || null;
}

function pickOne(rng, list) {
    const values = Array.isArray(list) ? list : [];
    if (values.length === 0) return null;
    const idx = Math.max(0, Math.min(values.length - 1, Math.floor(rng() * values.length)));
    return values[idx];
}

function hash40(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 40);
}

function budgetCluster(price) {
    const p = Number(price || 0);
    if (p <= 0) return 'unknown';
    if (p < 1500) return 'budget';
    if (p < 2600) return 'mid';
    if (p < 4200) return 'high';
    return 'premium';
}

function ratioPct(n, d) {
    const num = Number(n || 0);
    const den = Number(d || 0);
    if (!den) return 0;
    return Math.round((num / den) * 10000) / 100;
}

function addMapValue(map, key, delta) {
    if (!key) return;
    const current = Number(map[key] || 0);
    const next = current + Number(delta || 0);
    map[key] = Math.round(next * 1000) / 1000;
}

function buildAttribution(channel, landingPath) {
    const source = String(channel?.utmSource || channel?.source || 'direct');
    const medium = String(channel?.utmMedium || channel?.medium || 'none');
    const campaign = String(channel?.utmCampaign || channel?.campaign || 'none');
    const clickId = channel?.clickId ? String(channel.clickId) : null;
    const attribution = {
        utm_source: source,
        utm_medium: medium,
        utm_campaign: campaign,
        landing_path: String(landingPath || '/'),
        click_id: clickId
    };
    return attribution;
}

function emptySessionFact({ sessionId, personKey, userId, crmLeadId, emailHash, phoneHash, landingPath, sourcePath, referrer, attribution }) {
    return {
        session_id: sessionId,
        person_key: personKey,
        user_id: userId,
        crm_lead_id: crmLeadId,
        customer_email_hash: emailHash,
        customer_phone_hash: phoneHash,
        first_seen_at: null,
        last_seen_at: null,
        event_count: 0,
        page_views: 0,
        first_clicks: 0,
        catalog_views: 0,
        product_views: 0,
        add_to_cart: 0,
        checkout_starts: 0,
        checkout_steps: 0,
        checkout_validation_errors: 0,
        checkout_submit_attempts: 0,
        checkout_submit_success: 0,
        checkout_submit_failed: 0,
        forms_seen: 0,
        forms_first_input: 0,
        form_submit_attempts: 0,
        form_validation_errors: 0,
        booking_starts: 0,
        booking_success: 0,
        orders: 0,
        dwell_ms_sum: 0,
        first_source_path: sourcePath || null,
        last_source_path: sourcePath || null,
        entry_referrer: referrer || null,
        utm_source: attribution?.utm_source || null,
        utm_medium: attribution?.utm_medium || null,
        utm_campaign: attribution?.utm_campaign || null,
        click_id: attribution?.click_id || null,
        landing_path: landingPath || '/',
        is_bot: 0,
        updated_at: null
    };
}

function applyEventToSessionFact(fact, event) {
    if (!fact || !event) return;
    fact.event_count += 1;
    if (!fact.first_seen_at || String(event.created_at) < String(fact.first_seen_at)) {
        fact.first_seen_at = event.created_at;
    }
    if (!fact.last_seen_at || String(event.created_at) > String(fact.last_seen_at)) {
        fact.last_seen_at = event.created_at;
    }
    if (!fact.first_source_path && event.source_path) {
        fact.first_source_path = event.source_path;
    }
    if (event.source_path) {
        fact.last_source_path = event.source_path;
    }
    if (!fact.entry_referrer && event.referrer) {
        fact.entry_referrer = event.referrer;
    }

    const meta = event.metadata || {};
    if (!fact.utm_source && meta.utm_source) fact.utm_source = String(meta.utm_source);
    if (!fact.utm_medium && meta.utm_medium) fact.utm_medium = String(meta.utm_medium);
    if (!fact.utm_campaign && meta.utm_campaign) fact.utm_campaign = String(meta.utm_campaign);
    if (!fact.click_id && meta.click_id) fact.click_id = String(meta.click_id);
    if (!fact.landing_path && meta.landing_path) fact.landing_path = String(meta.landing_path);

    switch (String(event.event_type || '')) {
        case 'page_view':
            fact.page_views += 1;
            break;
        case 'first_click':
            fact.first_clicks += 1;
            break;
        case 'catalog_view':
            fact.catalog_views += 1;
            break;
        case 'product_view':
        case 'detail_open':
            fact.product_views += 1;
            break;
        case 'add_to_cart':
            fact.add_to_cart += 1;
            break;
        case 'checkout_start':
            fact.checkout_starts += 1;
            break;
        case 'checkout_step':
            fact.checkout_steps += 1;
            break;
        case 'checkout_validation_error':
        case 'checkout_field_error':
            fact.checkout_validation_errors += 1;
            break;
        case 'checkout_submit_attempt':
            fact.checkout_submit_attempts += 1;
            break;
        case 'checkout_submit_success':
            fact.checkout_submit_success += 1;
            break;
        case 'checkout_submit_failed':
        case 'checkout_abandon':
            fact.checkout_submit_failed += 1;
            break;
        case 'form_seen':
            fact.forms_seen += 1;
            break;
        case 'form_first_input':
            fact.forms_first_input += 1;
            break;
        case 'form_submit_attempt':
            fact.form_submit_attempts += 1;
            break;
        case 'form_validation_error':
            fact.form_validation_errors += 1;
            break;
        case 'booking_start':
            fact.booking_starts += 1;
            break;
        case 'booking_success':
            fact.booking_success += 1;
            break;
        case 'order':
            fact.orders += 1;
            break;
        case 'dwell':
            fact.dwell_ms_sum += Number(event.dwell_ms || 0);
            break;
        default:
            break;
    }

    fact.updated_at = fact.last_seen_at || fact.updated_at;
}

function buildDayCandidates(daysBack) {
    const weightsByWeekday = {
        0: 1.18,
        1: 0.95,
        2: 1.03,
        3: 1.08,
        4: 1.0,
        5: 0.9,
        6: 1.14
    };
    const list = [];
    for (let offset = 0; offset < daysBack; offset++) {
        const date = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
        date.setHours(0, 0, 0, 0);
        const weekday = date.getDay();
        list.push({ date, weight: Number(weightsByWeekday[weekday] || 1) });
    }
    return list;
}

function randomHour(rng) {
    const buckets = [
        { from: 0, to: 6, weight: 0.08 },
        { from: 7, to: 11, weight: 0.24 },
        { from: 12, to: 17, weight: 0.33 },
        { from: 18, to: 22, weight: 0.30 },
        { from: 23, to: 23, weight: 0.05 }
    ];
    const bucket = pickWeighted(rng, buckets, 'weight') || buckets[2];
    const span = Math.max(1, bucket.to - bucket.from + 1);
    return bucket.from + Math.floor(rng() * span);
}

async function ensureDemoUsers(db, count = 60) {
    for (let i = 1; i <= count; i++) {
        const email = `demo.metrics.user.${i}@example.local`;
        await db.query(
            `INSERT OR IGNORE INTO users (name, email, password, role, created_at)
             VALUES (?, ?, ?, 'user', datetime('now'))`,
            [`Demo Metrics User ${i}`, email, 'demo_seed_hash']
        );
    }
    const rows = await db.query(
        `SELECT id FROM users WHERE email LIKE 'demo.metrics.user.%@example.local' ORDER BY id ASC LIMIT ?`,
        [count]
    );
    return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
}

async function ensureDemoReferralLinks(db) {
    const links = [
        { slug: 'demo-anna', channelName: 'Creator Anna', codeWord: 'anna', creatorTag: 'anna', targetPath: '/', utmSource: 'creator_anna', utmMedium: 'referral', utmCampaign: 'ref_demo_anna', utmContent: 'anna' },
        { slug: 'demo-marc', channelName: 'Creator Marc', codeWord: 'marc', creatorTag: 'marc', targetPath: '/catalog', utmSource: 'creator_marc', utmMedium: 'referral', utmCampaign: 'ref_demo_marc', utmContent: 'marc' },
        { slug: 'demo-bikeclub', channelName: 'Bike Club', codeWord: 'bikeclub', creatorTag: 'bikeclub', targetPath: '/catalog?discipline=road', utmSource: 'bikeclub', utmMedium: 'referral', utmCampaign: 'ref_demo_bikeclub', utmContent: 'club' },
        { slug: 'demo-yt', channelName: 'YouTube Review', codeWord: 'yt', creatorTag: 'yt', targetPath: '/catalog?discipline=mtb', utmSource: 'youtube_creator', utmMedium: 'referral', utmCampaign: 'ref_demo_yt', utmContent: 'review' }
    ];

    for (const link of links) {
        await db.query(
            `INSERT INTO referral_links (
                slug, channel_name, code_word, creator_tag, target_path,
                utm_source, utm_medium, utm_campaign, utm_content,
                is_active, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
            ON CONFLICT(slug) DO UPDATE SET
                channel_name = excluded.channel_name,
                code_word = excluded.code_word,
                creator_tag = excluded.creator_tag,
                target_path = excluded.target_path,
                utm_source = excluded.utm_source,
                utm_medium = excluded.utm_medium,
                utm_campaign = excluded.utm_campaign,
                utm_content = excluded.utm_content,
                is_active = 1,
                updated_at = datetime('now')`,
            [
                link.slug,
                link.channelName,
                link.codeWord,
                link.creatorTag,
                link.targetPath,
                link.utmSource,
                link.utmMedium,
                link.utmCampaign,
                link.utmContent,
                'demo_seed'
            ]
        );
    }

    const rows = await db.query(
        `SELECT id, slug, channel_name, target_path, utm_source, utm_medium, utm_campaign, utm_content, creator_tag
         FROM referral_links
         WHERE slug IN (${links.map(() => '?').join(',')})`,
        links.map((link) => link.slug)
    );

    const bySlug = new Map();
    for (const row of rows) {
        bySlug.set(String(row.slug), {
            id: Number(row.id),
            slug: String(row.slug),
            channelName: String(row.channel_name || ''),
            targetPath: String(row.target_path || '/'),
            utmSource: String(row.utm_source || 'creator'),
            utmMedium: String(row.utm_medium || 'referral'),
            utmCampaign: String(row.utm_campaign || ''),
            utmContent: row.utm_content ? String(row.utm_content) : null,
            creatorTag: row.creator_tag ? String(row.creator_tag) : null
        });
    }
    return bySlug;
}

async function cleanupOldDemoRows(db) {
    await db.query("DELETE FROM metric_events WHERE session_id LIKE 'demo_s_%' OR event_id LIKE 'demo_evt_%'");
    await db.query("DELETE FROM metrics_session_facts WHERE session_id LIKE 'demo_s_%' OR person_key LIKE 'demo_person_%'");
    await db.query("DELETE FROM metrics_identity_nodes WHERE person_key LIKE 'demo_person_%' OR identity_value LIKE 'demo_%' OR identity_value LIKE 'LEAD-DEMO-%'");
    await db.query("DELETE FROM metrics_feature_store WHERE person_key LIKE 'demo_person_%'");
    await db.query("DELETE FROM user_interest_profiles WHERE profile_key LIKE 'person:demo_person_%'");
    await db.query("DELETE FROM referral_visits WHERE session_hint LIKE 'demo_s_%' OR slug LIKE 'demo-%'");
}

function makeSessionTimeline(rng, dayCandidates) {
    const dayPick = pickWeighted(rng, dayCandidates, 'weight') || dayCandidates[0];
    const base = new Date(dayPick.date);
    base.setHours(randomHour(rng), Math.floor(rng() * 60), Math.floor(rng() * 60), 0);
    return base.getTime();
}

function buildChannelPool(referralLinks) {
    return [
        { key: 'direct', source: 'direct', medium: 'none', campaign: 'direct', trafficWeight: 26, quality: 0.95 },
        { key: 'google_cpc', source: 'google', medium: 'cpc', campaign: 'search_brand', trafficWeight: 19, quality: 1.08 },
        { key: 'meta_ads', source: 'meta', medium: 'paid_social', campaign: 'lookalike', trafficWeight: 14, quality: 0.82 },
        { key: 'seo_blog', source: 'google', medium: 'organic', campaign: 'seo_content', trafficWeight: 17, quality: 0.9 },
        { key: 'email', source: 'newsletter', medium: 'email', campaign: 'weekly_drop', trafficWeight: 8, quality: 1.12 },
        { key: 'creator_anna', source: 'creator_anna', medium: 'referral', campaign: 'ref_demo_anna', clickId: 'demo-anna', trafficWeight: 5, quality: 1.2, referral: referralLinks.get('demo-anna') || null },
        { key: 'creator_marc', source: 'creator_marc', medium: 'referral', campaign: 'ref_demo_marc', clickId: 'demo-marc', trafficWeight: 4, quality: 1.16, referral: referralLinks.get('demo-marc') || null },
        { key: 'bikeclub', source: 'bikeclub', medium: 'referral', campaign: 'ref_demo_bikeclub', clickId: 'demo-bikeclub', trafficWeight: 4, quality: 1.14, referral: referralLinks.get('demo-bikeclub') || null },
        { key: 'youtube_creator', source: 'youtube_creator', medium: 'referral', campaign: 'ref_demo_yt', clickId: 'demo-yt', trafficWeight: 3, quality: 1.1, referral: referralLinks.get('demo-yt') || null }
    ];
}

function chooseLandingPath(rng, channel) {
    const defaults = [
        { value: '/', weight: 30 },
        { value: '/catalog', weight: 34 },
        { value: '/catalog?discipline=road', weight: 16 },
        { value: '/catalog?discipline=mtb', weight: 14 },
        { value: '/how-it-works', weight: 6 }
    ];

    if (channel?.medium === 'referral' && channel?.referral?.targetPath) {
        return String(channel.referral.targetPath);
    }
    return String((pickWeighted(rng, defaults, 'weight') || defaults[0]).value);
}

function buildFieldErrorMeta(rng) {
    const fields = [
        { field: 'phone', reason: 'pattern_mismatch' },
        { field: 'email', reason: 'invalid_format' },
        { field: 'city', reason: 'required' },
        { field: 'payment_method', reason: 'not_selected' }
    ];
    return pickOne(rng, fields) || fields[0];
}

function buildSessionEvents({
    rng,
    sessionIndex,
    sessionId,
    personKey,
    userId,
    crmLeadId,
    emailHash,
    phoneHash,
    channel,
    bikes,
    startTs,
    landingPath,
    referrer
}) {
    const attribution = buildAttribution({
        utmSource: channel.source,
        utmMedium: channel.medium,
        utmCampaign: channel.campaign,
        clickId: channel.clickId || null
    }, landingPath);

    const events = [];
    const sessionFact = emptySessionFact({
        sessionId,
        personKey,
        userId,
        crmLeadId,
        emailHash,
        phoneHash,
        landingPath,
        sourcePath: landingPath,
        referrer,
        attribution
    });

    let eventIdx = 0;
    const nextTime = (baseStepMs = 20000) => startTs + (eventIdx++) * (Math.max(900, baseStepMs + Math.floor(rng() * 14000)));

    const addEvent = (eventType, payload = {}) => {
        const metadata = {
            ...attribution,
            attribution: {
                utm_source: attribution.utm_source,
                utm_medium: attribution.utm_medium,
                utm_campaign: attribution.utm_campaign,
                click_id: attribution.click_id,
                landing_path: attribution.landing_path
            },
            ...(payload.metadata || {})
        };
        const row = {
            bike_id: payload.bikeId != null ? Number(payload.bikeId) : null,
            event_type: String(eventType),
            value: Number(payload.value || 1),
            metadata,
            created_at: toSqliteDate(payload.ts || nextTime(payload.stepMs || 18000)),
            session_id: sessionId,
            referrer: payload.referrer === undefined ? referrer : payload.referrer,
            source_path: payload.sourcePath || landingPath,
            event_id: `demo_evt_${sessionIndex}_${eventIdx}_${Math.floor(rng() * 1000000)}`,
            dwell_ms: payload.dwellMs != null ? Math.max(0, Number(payload.dwellMs)) : null,
            user_id: userId,
            person_key: personKey
        };
        events.push(row);
        applyEventToSessionFact(sessionFact, row);
        return row;
    };

    const bike = pickOne(rng, bikes) || null;
    const bikeId = bike ? Number(bike.id) : null;
    const quality = Math.max(0.65, Math.min(1.3, Number(channel.quality || 1)));

    addEvent('page_view', { sourcePath: landingPath, stepMs: 5000 });

    const didFirstClick = rng() < (0.73 * quality + 0.08);
    if (didFirstClick) addEvent('first_click', { sourcePath: landingPath });

    const didCatalog = didFirstClick && (rng() < (0.85 * quality));
    if (didCatalog) addEvent('catalog_view', { sourcePath: '/catalog' });

    const impressions = didCatalog ? (2 + Math.floor(rng() * 6)) : (rng() < 0.25 ? 1 : 0);
    for (let i = 0; i < impressions; i++) {
        const impBike = pickOne(rng, bikes) || bike;
        addEvent('impression', {
            bikeId: impBike ? Number(impBike.id) : bikeId,
            sourcePath: '/catalog',
            stepMs: 4000,
            metadata: { stage: 'catalog' }
        });
    }

    const didProduct = didCatalog && rng() < (0.59 * quality + 0.04);
    if (didProduct) {
        const productPath = bikeId ? `/product/${bikeId}` : '/product/demo';
        addEvent('product_view', { bikeId, sourcePath: productPath, metadata: { stage: 'product' } });
        addEvent('detail_open', { bikeId, sourcePath: productPath, metadata: { stage: 'product' } });
        addEvent('dwell', { bikeId, sourcePath: productPath, dwellMs: 15000 + Math.floor(rng() * 60000), metadata: { stage: 'product' } });
    }

    const didAtc = didProduct && rng() < (0.34 * quality);
    if (didAtc) {
        addEvent('add_to_cart', {
            bikeId,
            sourcePath: bikeId ? `/product/${bikeId}` : '/catalog',
            metadata: { stage: 'product' }
        });
    }

    const didCheckoutStart = didAtc && rng() < (0.72 * quality);
    if (didCheckoutStart) {
        addEvent('checkout_start', { sourcePath: '/guest-order', metadata: { stage: 'checkout' } });
        addEvent('form_seen', { sourcePath: '/guest-order', metadata: { stage: 'checkout', formId: 'booking_v2' } });
        addEvent('form_first_input', { sourcePath: '/guest-order', metadata: { stage: 'checkout', formId: 'booking_v2' } });
        addEvent('checkout_step', { sourcePath: '/guest-order', metadata: { stage: 'checkout', step: 'contact' } });
    }

    const submitAttempts = didCheckoutStart ? (1 + (rng() < 0.19 ? 1 : 0)) : 0;
    let submitSuccess = false;
    for (let attempt = 1; attempt <= submitAttempts; attempt++) {
        addEvent('form_submit_attempt', { sourcePath: '/guest-order', metadata: { stage: 'checkout', attempt_no: attempt } });
        addEvent('checkout_submit_attempt', { sourcePath: '/guest-order', metadata: { stage: 'checkout', attempt_no: attempt } });

        const shouldError = rng() < (attempt === 1 ? (0.28 - Math.min(0.12, quality * 0.08)) : 0.12);
        if (shouldError) {
            const errorMeta = buildFieldErrorMeta(rng);
            addEvent('form_validation_error', {
                sourcePath: '/guest-order',
                metadata: { stage: 'checkout', field: errorMeta.field, reason: errorMeta.reason, attempt_no: attempt }
            });
            addEvent('checkout_field_error', {
                sourcePath: '/guest-order',
                metadata: { stage: 'checkout', field: errorMeta.field, reason: errorMeta.reason, attempt_no: attempt }
            });
            addEvent('checkout_submit_failed', {
                sourcePath: '/guest-order',
                metadata: { stage: 'checkout', reason: errorMeta.reason, attempt_no: attempt }
            });
            continue;
        }

        const isSuccess = rng() < (0.78 * quality + 0.08);
        if (isSuccess) {
            submitSuccess = true;
            addEvent('checkout_submit_success', {
                sourcePath: '/guest-order',
                metadata: { stage: 'checkout', attempt_no: attempt }
            });
            break;
        }

        addEvent('checkout_submit_failed', {
            sourcePath: '/guest-order',
            metadata: { stage: 'checkout', reason: 'gateway_timeout', attempt_no: attempt }
        });
    }

    if (didCheckoutStart && !submitSuccess) {
        addEvent('checkout_abandon', {
            sourcePath: '/guest-order',
            metadata: { stage: 'checkout', reason: 'friction_or_timeout' }
        });
    }

    const didBooking = submitSuccess && rng() < (0.9 * quality);
    if (didBooking) {
        addEvent('booking_start', { sourcePath: '/booking-checkout/flow', metadata: { stage: 'booking' } });
        addEvent('booking_success', { sourcePath: '/booking-checkout/flow', bikeId, metadata: { stage: 'booking' } });
    }

    const didOrder = didBooking && rng() < (0.86 * quality);
    if (didOrder) {
        addEvent('order', { sourcePath: '/booking-checkout/flow', bikeId, metadata: { stage: 'booking' } });
    }

    const webVitalSampleCount = 1 + Math.floor(rng() * 3);
    const vitalNames = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
    for (let i = 0; i < webVitalSampleCount; i++) {
        const metric = pickOne(rng, vitalNames) || 'LCP';
        const value = metric === 'CLS'
            ? Math.round((0.02 + rng() * 0.18) * 1000) / 1000
            : Math.round(600 + rng() * 2600);
        addEvent('web_vital', {
            sourcePath: didProduct ? (bikeId ? `/product/${bikeId}` : '/product/demo') : '/catalog',
            metadata: { name: metric, value, stage: didCheckoutStart ? 'checkout' : (didProduct ? 'product' : 'catalog') },
            stepMs: 5000
        });
    }

    const latencyEvents = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < latencyEvents; i++) {
        const stage = didCheckoutStart ? (rng() < 0.5 ? 'checkout' : 'catalog') : (didProduct ? 'product' : 'catalog');
        const status = rng() < 0.06 ? 500 : 200;
        const duration = Math.round((status >= 500 ? 700 : 180) + rng() * (status >= 500 ? 1800 : 620));
        const endpoint = stage === 'checkout' ? '/api/v1/booking' : (stage === 'product' ? '/api/catalog/bike' : '/api/catalog/bikes');
        addEvent('api_latency', {
            sourcePath: stage === 'checkout' ? '/guest-order' : '/catalog',
            metadata: {
                path: endpoint,
                method: status >= 500 && rng() < 0.4 ? 'POST' : 'GET',
                status,
                duration_ms: duration,
                network_error: status >= 500 && rng() < 0.3 ? 1 : 0,
                stage
            },
            stepMs: 3000
        });
    }

    return {
        events,
        sessionFact,
        selectedBike: bike,
        conversion: {
            didFirstClick,
            didCatalog,
            didProduct,
            didAtc,
            didCheckoutStart,
            submitSuccess,
            didBooking,
            didOrder
        }
    };
}

async function insertMetricEvents(db, events = []) {
    for (const row of events) {
        await db.query(
            `INSERT INTO metric_events (
                bike_id, event_type, value, metadata, created_at,
                session_id, referrer, source_path, event_id, dwell_ms, user_id, person_key
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                row.bike_id,
                row.event_type,
                row.value,
                JSON.stringify(row.metadata || {}),
                row.created_at,
                row.session_id,
                row.referrer,
                row.source_path,
                row.event_id,
                row.dwell_ms,
                row.user_id,
                row.person_key
            ]
        );
    }
}

async function upsertSessionFact(db, fact) {
    await db.query(
        `INSERT INTO metrics_session_facts (
            session_id, person_key, user_id, crm_lead_id, customer_email_hash, customer_phone_hash,
            first_seen_at, last_seen_at, event_count, page_views, first_clicks, catalog_views, product_views,
            add_to_cart, checkout_starts, checkout_steps, checkout_validation_errors, checkout_submit_attempts,
            checkout_submit_success, checkout_submit_failed, forms_seen, forms_first_input, form_submit_attempts,
            form_validation_errors, booking_starts, booking_success, orders, dwell_ms_sum,
            first_source_path, last_source_path, entry_referrer, utm_source, utm_medium, utm_campaign,
            click_id, landing_path, is_bot, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            person_key = excluded.person_key,
            user_id = COALESCE(metrics_session_facts.user_id, excluded.user_id),
            crm_lead_id = COALESCE(metrics_session_facts.crm_lead_id, excluded.crm_lead_id),
            customer_email_hash = COALESCE(metrics_session_facts.customer_email_hash, excluded.customer_email_hash),
            customer_phone_hash = COALESCE(metrics_session_facts.customer_phone_hash, excluded.customer_phone_hash),
            first_seen_at = excluded.first_seen_at,
            last_seen_at = excluded.last_seen_at,
            event_count = excluded.event_count,
            page_views = excluded.page_views,
            first_clicks = excluded.first_clicks,
            catalog_views = excluded.catalog_views,
            product_views = excluded.product_views,
            add_to_cart = excluded.add_to_cart,
            checkout_starts = excluded.checkout_starts,
            checkout_steps = excluded.checkout_steps,
            checkout_validation_errors = excluded.checkout_validation_errors,
            checkout_submit_attempts = excluded.checkout_submit_attempts,
            checkout_submit_success = excluded.checkout_submit_success,
            checkout_submit_failed = excluded.checkout_submit_failed,
            forms_seen = excluded.forms_seen,
            forms_first_input = excluded.forms_first_input,
            form_submit_attempts = excluded.form_submit_attempts,
            form_validation_errors = excluded.form_validation_errors,
            booking_starts = excluded.booking_starts,
            booking_success = excluded.booking_success,
            orders = excluded.orders,
            dwell_ms_sum = excluded.dwell_ms_sum,
            first_source_path = excluded.first_source_path,
            last_source_path = excluded.last_source_path,
            entry_referrer = excluded.entry_referrer,
            utm_source = excluded.utm_source,
            utm_medium = excluded.utm_medium,
            utm_campaign = excluded.utm_campaign,
            click_id = excluded.click_id,
            landing_path = excluded.landing_path,
            is_bot = excluded.is_bot,
            updated_at = excluded.updated_at`,
        [
            fact.session_id,
            fact.person_key,
            fact.user_id,
            fact.crm_lead_id,
            fact.customer_email_hash,
            fact.customer_phone_hash,
            fact.first_seen_at,
            fact.last_seen_at,
            fact.event_count,
            fact.page_views,
            fact.first_clicks,
            fact.catalog_views,
            fact.product_views,
            fact.add_to_cart,
            fact.checkout_starts,
            fact.checkout_steps,
            fact.checkout_validation_errors,
            fact.checkout_submit_attempts,
            fact.checkout_submit_success,
            fact.checkout_submit_failed,
            fact.forms_seen,
            fact.forms_first_input,
            fact.form_submit_attempts,
            fact.form_validation_errors,
            fact.booking_starts,
            fact.booking_success,
            fact.orders,
            fact.dwell_ms_sum,
            fact.first_source_path,
            fact.last_source_path,
            fact.entry_referrer,
            fact.utm_source,
            fact.utm_medium,
            fact.utm_campaign,
            fact.click_id,
            fact.landing_path,
            fact.is_bot,
            fact.updated_at || fact.last_seen_at
        ]
    );
}

async function upsertIdentityNode(db, payload) {
    await db.query(
        `INSERT INTO metrics_identity_nodes (
            identity_type, identity_value, person_key,
            user_id, session_id, crm_lead_id,
            first_seen_at, last_seen_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(identity_type, identity_value) DO UPDATE SET
            person_key = excluded.person_key,
            user_id = COALESCE(metrics_identity_nodes.user_id, excluded.user_id),
            session_id = COALESCE(metrics_identity_nodes.session_id, excluded.session_id),
            crm_lead_id = COALESCE(metrics_identity_nodes.crm_lead_id, excluded.crm_lead_id),
            last_seen_at = excluded.last_seen_at,
            updated_at = excluded.updated_at`,
        [
            payload.identityType,
            payload.identityValue,
            payload.personKey,
            payload.userId,
            payload.sessionId,
            payload.crmLeadId,
            payload.firstSeenAt,
            payload.lastSeenAt,
            payload.updatedAt
        ]
    );
}

async function upsertProfileStores(db, profileMap) {
    const entries = [...profileMap.entries()];
    for (const [personKey, profile] of entries) {
        const weightedPrice = profile.priceWeight > 0 ? (profile.priceSum / profile.priceWeight) : 0;
        const budget = budgetCluster(weightedPrice);
        const intentScore = Math.round(Number(profile.intentScore || 0) * 100) / 100;
        const updatedAt = profile.lastSeenAt || toSqliteDate(Date.now());
        const disciplineEmbedding = JSON.stringify(profile.disciplines || {});
        const brandEmbedding = JSON.stringify(profile.brands || {});
        const categoryEmbedding = JSON.stringify(profile.categories || {});

        await db.query(
            `INSERT INTO metrics_feature_store (
                person_key, profile_key, user_id, session_id, crm_lead_id,
                budget_cluster, weighted_price, intent_score,
                recency_half_life_days, recency_decay,
                discipline_embedding_json, brand_embedding_json, category_embedding_json,
                last_event_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 7, 1, ?, ?, ?, ?, ?)
            ON CONFLICT(person_key) DO UPDATE SET
                profile_key = excluded.profile_key,
                user_id = COALESCE(metrics_feature_store.user_id, excluded.user_id),
                session_id = excluded.session_id,
                crm_lead_id = COALESCE(metrics_feature_store.crm_lead_id, excluded.crm_lead_id),
                budget_cluster = excluded.budget_cluster,
                weighted_price = excluded.weighted_price,
                intent_score = excluded.intent_score,
                discipline_embedding_json = excluded.discipline_embedding_json,
                brand_embedding_json = excluded.brand_embedding_json,
                category_embedding_json = excluded.category_embedding_json,
                last_event_at = excluded.last_event_at,
                updated_at = excluded.updated_at`,
            [
                personKey,
                `person:${personKey}`,
                profile.userId || null,
                profile.lastSessionId || null,
                profile.crmLeadId || null,
                budget,
                Math.round(weightedPrice * 100) / 100,
                intentScore,
                disciplineEmbedding,
                brandEmbedding,
                categoryEmbedding,
                updatedAt,
                updatedAt
            ]
        );

        await db.query(
            `INSERT INTO user_interest_profiles (
                profile_key, user_id, session_id,
                disciplines_json, brands_json,
                price_sum, price_weight, weighted_price,
                intent_score, last_event_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_key) DO UPDATE SET
                user_id = COALESCE(user_interest_profiles.user_id, excluded.user_id),
                session_id = excluded.session_id,
                disciplines_json = excluded.disciplines_json,
                brands_json = excluded.brands_json,
                price_sum = excluded.price_sum,
                price_weight = excluded.price_weight,
                weighted_price = excluded.weighted_price,
                intent_score = excluded.intent_score,
                last_event_at = excluded.last_event_at,
                updated_at = excluded.updated_at`,
            [
                `person:${personKey}`,
                profile.userId || null,
                profile.lastSessionId || null,
                disciplineEmbedding,
                brandEmbedding,
                Math.round(profile.priceSum * 100) / 100,
                Math.round(profile.priceWeight * 100) / 100,
                Math.round(weightedPrice * 100) / 100,
                intentScore,
                updatedAt,
                updatedAt
            ]
        );
    }
}

async function generateDemoMetricsDataset(db, options = {}) {
    const sessionCount = Math.max(100, Math.min(5000, Number(options.sessionCount || options.sessions || 1000)));
    const daysBack = Math.max(14, Math.min(180, Number(options.daysBack || 35)));
    const seed = Number(options.seed || Date.now());
    const rng = createRng(seed);

    const [userIds, bikesRaw, referralLinks] = await Promise.all([
        ensureDemoUsers(db, 60),
        db.query('SELECT id, brand, model, discipline, category, price FROM bikes WHERE COALESCE(is_active, 1) = 1 ORDER BY id ASC LIMIT 300'),
        ensureDemoReferralLinks(db)
    ]);

    const bikes = (bikesRaw || []).map((row) => ({
        id: Number(row.id),
        brand: String(row.brand || 'unknown'),
        model: String(row.model || ''),
        discipline: String(row.discipline || row.category || 'other').toLowerCase(),
        category: String(row.category || row.discipline || 'other').toLowerCase(),
        price: Number(row.price || 0)
    })).filter((row) => Number.isFinite(row.id));

    const channels = buildChannelPool(referralLinks);
    const dayCandidates = buildDayCandidates(daysBack);
    const profileMap = new Map();

    const totals = {
        sessions: 0,
        events: 0,
        referralSessions: 0,
        productSessions: 0,
        addToCartSessions: 0,
        checkoutSessions: 0,
        bookingSessions: 0,
        orderSessions: 0,
        fieldErrors: 0
    };

    await cleanupOldDemoRows(db);

    await db.query('BEGIN');
    try {
        for (let i = 1; i <= sessionCount; i++) {
            const sessionId = `demo_s_${String(i).padStart(4, '0')}_${Math.floor(rng() * 1e6)}`;
            const personIndex = 1 + Math.floor((i * 0.72) + rng() * 120);
            const personKey = `demo_person_${personIndex}`;
            const userId = userIds.length > 0 && rng() < 0.34
                ? userIds[Math.floor(rng() * userIds.length)]
                : null;
            const crmLeadId = rng() < 0.48 ? `LEAD-DEMO-${String(personIndex).padStart(4, '0')}` : null;
            const emailHash = rng() < 0.55 ? hash40(`demo-user-${personIndex}@example.local`) : null;
            const phoneHash = rng() < 0.42 ? hash40(`+49176${String(personIndex).padStart(8, '0')}`) : null;

            const channel = pickWeighted(rng, channels, 'trafficWeight') || channels[0];
            const landingPath = chooseLandingPath(rng, channel);
            const referrer = channel.medium === 'referral'
                ? `https://instagram.com/${channel.source}`
                : (channel.medium === 'cpc' ? 'https://google.com' : 'https://example.com');
            const sessionStartTs = makeSessionTimeline(rng, dayCandidates);

            const build = buildSessionEvents({
                rng,
                sessionIndex: i,
                sessionId,
                personKey,
                userId,
                crmLeadId,
                emailHash,
                phoneHash,
                channel,
                bikes,
                startTs: sessionStartTs,
                landingPath,
                referrer
            });

            await insertMetricEvents(db, build.events);
            await upsertSessionFact(db, build.sessionFact);

            const firstSeenAt = build.sessionFact.first_seen_at || toSqliteDate(sessionStartTs);
            const lastSeenAt = build.sessionFact.last_seen_at || firstSeenAt;
            await upsertIdentityNode(db, {
                identityType: 'session',
                identityValue: sessionId,
                personKey,
                userId,
                sessionId,
                crmLeadId,
                firstSeenAt,
                lastSeenAt,
                updatedAt: lastSeenAt
            });
            if (crmLeadId) {
                await upsertIdentityNode(db, {
                    identityType: 'crm_lead',
                    identityValue: crmLeadId,
                    personKey,
                    userId,
                    sessionId,
                    crmLeadId,
                    firstSeenAt,
                    lastSeenAt,
                    updatedAt: lastSeenAt
                });
            }
            if (userId != null) {
                await upsertIdentityNode(db, {
                    identityType: 'user',
                    identityValue: String(userId),
                    personKey,
                    userId,
                    sessionId,
                    crmLeadId,
                    firstSeenAt,
                    lastSeenAt,
                    updatedAt: lastSeenAt
                });
            }
            if (emailHash) {
                await upsertIdentityNode(db, {
                    identityType: 'email_hash',
                    identityValue: emailHash,
                    personKey,
                    userId,
                    sessionId,
                    crmLeadId,
                    firstSeenAt,
                    lastSeenAt,
                    updatedAt: lastSeenAt
                });
            }
            if (phoneHash) {
                await upsertIdentityNode(db, {
                    identityType: 'phone_hash',
                    identityValue: phoneHash,
                    personKey,
                    userId,
                    sessionId,
                    crmLeadId,
                    firstSeenAt,
                    lastSeenAt,
                    updatedAt: lastSeenAt
                });
            }

            if (channel.medium === 'referral' && channel.referral?.id) {
                await db.query(
                    `INSERT INTO referral_visits (
                        referral_link_id, slug, session_hint, ip_hash, user_agent, referrer, target_path, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        channel.referral.id,
                        channel.referral.slug,
                        sessionId,
                        hash40(`10.0.${i % 254}.${Math.max(1, personIndex % 254)}`),
                        'Mozilla/5.0 (Demo Seed)',
                        referrer,
                        channel.referral.targetPath || landingPath,
                        firstSeenAt
                    ]
                );
            }

            let profile = profileMap.get(personKey);
            if (!profile) {
                profile = {
                    personKey,
                    userId,
                    crmLeadId,
                    disciplines: {},
                    brands: {},
                    categories: {},
                    priceSum: 0,
                    priceWeight: 0,
                    intentScore: 0,
                    lastSeenAt,
                    lastSessionId: sessionId
                };
                profileMap.set(personKey, profile);
            }
            if (!profile.userId && userId != null) profile.userId = userId;
            if (!profile.crmLeadId && crmLeadId) profile.crmLeadId = crmLeadId;
            profile.lastSeenAt = lastSeenAt;
            profile.lastSessionId = sessionId;

            const bike = build.selectedBike;
            if (bike) {
                const addWeight = build.conversion.didAtc ? 3.2 : (build.conversion.didProduct ? 1.6 : 0.6);
                addMapValue(profile.disciplines, String(bike.discipline || 'other'), addWeight);
                addMapValue(profile.brands, String(bike.brand || 'unknown'), addWeight * 0.9);
                addMapValue(profile.categories, String(bike.category || bike.discipline || 'other'), addWeight * 0.8);
                profile.priceSum += Number(bike.price || 0) * addWeight;
                profile.priceWeight += addWeight;
            }
            profile.intentScore +=
                Number(build.conversion.didFirstClick ? 6 : 0)
                + Number(build.conversion.didProduct ? 22 : 0)
                + Number(build.conversion.didAtc ? 34 : 0)
                + Number(build.conversion.didCheckoutStart ? 18 : 0)
                + Number(build.conversion.submitSuccess ? 28 : 0)
                + Number(build.conversion.didOrder ? 46 : 0);

            totals.sessions += 1;
            totals.events += build.events.length;
            if (channel.medium === 'referral') totals.referralSessions += 1;
            if (build.conversion.didProduct) totals.productSessions += 1;
            if (build.conversion.didAtc) totals.addToCartSessions += 1;
            if (build.conversion.didCheckoutStart) totals.checkoutSessions += 1;
            if (build.conversion.didBooking) totals.bookingSessions += 1;
            if (build.conversion.didOrder) totals.orderSessions += 1;
            totals.fieldErrors += Number(build.sessionFact.checkout_validation_errors || 0) + Number(build.sessionFact.form_validation_errors || 0);
        }

        await upsertProfileStores(db, profileMap);

        await db.query('COMMIT');
    } catch (error) {
        try { await db.query('ROLLBACK'); } catch { /* ignore */ }
        throw error;
    }

    return {
        success: true,
        seed,
        sessionsGenerated: totals.sessions,
        eventsInserted: totals.events,
        referralSessions: totals.referralSessions,
        conversion: {
            productPct: ratioPct(totals.productSessions, totals.sessions),
            addToCartPct: ratioPct(totals.addToCartSessions, totals.sessions),
            checkoutPct: ratioPct(totals.checkoutSessions, totals.sessions),
            bookingPct: ratioPct(totals.bookingSessions, totals.sessions),
            orderPct: ratioPct(totals.orderSessions, totals.sessions)
        },
        quality: {
            fieldErrors: totals.fieldErrors,
            profilesUpdated: profileMap.size
        }
    };
}

module.exports = {
    generateDemoMetricsDataset
};
