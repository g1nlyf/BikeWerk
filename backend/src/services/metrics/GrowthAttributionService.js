const crypto = require('crypto');

class GrowthAttributionService {
    constructor(db, options = {}) {
        this.db = db;
        this.baseUrl = String(options.baseUrl || process.env.PUBLIC_URL || 'http://localhost:5175').replace(/\/+$/, '');
    }

    sanitizeText(value, maxLen = 200) {
        if (value == null) return '';
        return String(value).trim().slice(0, maxLen);
    }

    sanitizeSlug(value, maxLen = 80) {
        const raw = this.sanitizeText(value, maxLen).toLowerCase();
        const slug = raw
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return slug.slice(0, maxLen);
    }

    sanitizePath(value) {
        const raw = this.sanitizeText(value, 400);
        if (!raw) return '/';
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
            try {
                const parsed = new URL(raw);
                return `${parsed.pathname || '/'}${parsed.search || ''}`;
            } catch {
                return '/';
            }
        }
        if (raw.startsWith('/')) return raw;
        return `/${raw}`;
    }

    normalizeWindowPreset(rawValue, fallback = 'daily') {
        const value = String(rawValue || '').trim().toLowerCase();
        if (value === 'hourly') return 'hourly';
        if (value === 'daily') return 'daily';
        if (value === 'weekly') return 'weekly';
        if (value === 'monthly') return 'monthly';
        if (value === 'all' || value === 'all_time' || value === 'all-time') return 'all';
        return fallback;
    }

    inferPresetFromWindowDays(windowDays, fallback = 'daily') {
        const days = Number(windowDays || 0);
        if (!Number.isFinite(days) || days <= 0) return fallback;
        if (days <= 2) return 'hourly';
        if (days <= 45) return 'daily';
        if (days <= 210) return 'weekly';
        if (days <= 900) return 'monthly';
        return 'all';
    }

    presetDefaultsDays(preset) {
        const safe = this.normalizeWindowPreset(preset, 'daily');
        const defaults = {
            hourly: 2,
            daily: 30,
            weekly: 182,
            monthly: 730,
            all: 3650
        };
        return Number(defaults[safe] || defaults.daily);
    }

    trendBucketForPreset(preset) {
        const safe = this.normalizeWindowPreset(preset, 'daily');
        if (safe === 'hourly') return 'hour';
        if (safe === 'daily') return 'day';
        if (safe === 'weekly') return 'week';
        return 'month';
    }

    trendBucketSql(bucket, fieldName = 'last_seen_at') {
        const field = String(fieldName || 'last_seen_at');
        const safeBucket = String(bucket || 'day');
        if (safeBucket === 'hour') return `strftime('%Y-%m-%d %H:00:00', ${field})`;
        if (safeBucket === 'week') return `strftime('%Y-W%W', ${field})`;
        if (safeBucket === 'month') return `strftime('%Y-%m', ${field})`;
        return `strftime('%Y-%m-%d', ${field})`;
    }

    resolveWindowConfig(options = {}, fallbackPreset = 'daily') {
        const explicitPreset = this.normalizeWindowPreset(options.windowPreset || options.preset, '');
        const hasWindowDays = Number.isFinite(Number(options.windowDays)) && Number(options.windowDays) > 0;
        const hasWindowHours = Number.isFinite(Number(options.windowHours)) && Number(options.windowHours) > 0;

        let preset = explicitPreset || fallbackPreset;
        if (!explicitPreset && hasWindowDays) {
            preset = this.inferPresetFromWindowDays(Number(options.windowDays), fallbackPreset);
        } else if (!explicitPreset && hasWindowHours) {
            preset = this.inferPresetFromWindowDays(Number(options.windowHours) / 24, fallbackPreset);
        }

        let windowDays = hasWindowDays
            ? Math.round(Number(options.windowDays))
            : (hasWindowHours
                ? Math.ceil(Number(options.windowHours) / 24)
                : this.presetDefaultsDays(preset));

        windowDays = Math.max(1, Math.min(3650, windowDays));
        const bucket = this.trendBucketForPreset(preset);
        const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

        return {
            preset: this.normalizeWindowPreset(preset, fallbackPreset),
            bucket,
            windowDays,
            sinceIso,
            isAllTime: this.normalizeWindowPreset(preset, fallbackPreset) === 'all'
        };
    }

    buildOverallTrend(points = [], valueKeys = []) {
        const rows = Array.isArray(points) ? points : [];
        if (rows.length < 2) {
            return {
                direction: 'flat',
                scorePct: 0,
                firstHalf: 0,
                secondHalf: 0,
                points: rows.length
            };
        }
        const keys = (Array.isArray(valueKeys) ? valueKeys : []).filter(Boolean);
        const pickValue = (row) => keys.reduce((sum, key) => sum + Number(row?.[key] || 0), 0);
        const mid = Math.floor(rows.length / 2);
        const firstRows = rows.slice(0, mid);
        const secondRows = rows.slice(mid);
        const firstHalf = firstRows.reduce((sum, row) => sum + pickValue(row), 0);
        const secondHalf = secondRows.reduce((sum, row) => sum + pickValue(row), 0);
        const base = Math.max(1, firstHalf);
        const rawPct = ((secondHalf - firstHalf) / base) * 100;
        const scorePct = Math.round(rawPct * 100) / 100;
        const direction = scorePct > 2 ? 'up' : (scorePct < -2 ? 'down' : 'flat');
        return {
            direction,
            scorePct,
            firstHalf: Math.round(firstHalf * 100) / 100,
            secondHalf: Math.round(secondHalf * 100) / 100,
            points: rows.length
        };
    }

    resolveBaseUrl(preferred = '') {
        const candidate = this.sanitizeText(preferred, 400);
        const fallback = this.baseUrl;
        if (!candidate) return fallback;
        try {
            const parsed = new URL(candidate);
            const protocol = String(parsed.protocol || '').toLowerCase();
            if (protocol !== 'http:' && protocol !== 'https:') return fallback;
            const host = String(parsed.hostname || '').toLowerCase();
            const isLocal = host === 'localhost' || host === '127.0.0.1';
            const isKnownProd = host === 'bikewerk.ru'
                || host.endsWith('.bikewerk.ru')
                || host === 'eubike.ru'
                || host.endsWith('.eubike.ru');
            if (!isLocal && !isKnownProd) return fallback;
            return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
        } catch {
            return fallback;
        }
    }

    ratioPct(n, d) {
        const num = Number(n || 0);
        const den = Number(d || 0);
        if (!den) return 0;
        return Math.round((num / den) * 10000) / 100;
    }

    async slugExists(slug) {
        const rows = await this.db.query('SELECT id FROM referral_links WHERE slug = ? LIMIT 1', [slug]);
        return rows.length > 0;
    }

    async generateUniqueSlug(seed) {
        const base = this.sanitizeSlug(seed || 'ref');
        if (!base) return `ref-${Date.now().toString(36)}`;
        if (!(await this.slugExists(base))) return base;

        for (let i = 0; i < 15; i++) {
            const suffix = crypto.randomBytes(2).toString('hex');
            const candidate = `${base}-${suffix}`.slice(0, 80);
            if (!(await this.slugExists(candidate))) return candidate;
        }

        return `${base}-${Date.now().toString(36)}`.slice(0, 80);
    }

    mapLinkRow(row = {}, baseUrl = this.baseUrl) {
        const slug = this.sanitizeText(row.slug, 120);
        const safeBaseUrl = this.resolveBaseUrl(baseUrl);
        return {
            id: Number(row.id || 0),
            slug,
            channelName: this.sanitizeText(row.channel_name, 200),
            codeWord: this.sanitizeText(row.code_word, 120),
            creatorTag: this.sanitizeText(row.creator_tag, 120),
            targetPath: this.sanitizePath(row.target_path || '/'),
            utmSource: this.sanitizeText(row.utm_source, 120) || 'creator',
            utmMedium: this.sanitizeText(row.utm_medium, 120) || 'referral',
            utmCampaign: this.sanitizeText(row.utm_campaign, 160) || `ref_${slug}`,
            utmContent: this.sanitizeText(row.utm_content, 160),
            isActive: Number(row.is_active || 0) === 1,
            notes: this.sanitizeText(row.notes, 500),
            createdBy: row.created_by != null ? Number(row.created_by) : null,
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
            maskedUrl: `${safeBaseUrl}/go/${encodeURIComponent(slug)}`
        };
    }

    async createReferralLink(payload = {}, actor = {}, options = {}) {
        const channelName = this.sanitizeText(payload.channelName || payload.channel_name, 160);
        if (!channelName) {
            return { success: false, error: 'channelName is required' };
        }
        const baseUrl = this.resolveBaseUrl(options.baseUrl);

        const codeWord = this.sanitizeText(payload.codeWord || payload.code_word, 120);
        const desiredSlug = this.sanitizeSlug(payload.slug || codeWord || channelName, 80);
        const slug = await this.generateUniqueSlug(desiredSlug || channelName);
        const targetPath = this.sanitizePath(payload.targetPath || payload.target_path || '/');
        const utmSource = this.sanitizeText(payload.utmSource || payload.utm_source, 100) || 'creator';
        const utmMedium = this.sanitizeText(payload.utmMedium || payload.utm_medium, 100) || 'referral';
        const utmCampaign = this.sanitizeText(payload.utmCampaign || payload.utm_campaign, 120) || `ref_${slug}`;
        const utmContent = this.sanitizeText(payload.utmContent || payload.utm_content, 120) || channelName;
        const creatorTag = this.sanitizeText(payload.creatorTag || payload.creator_tag, 120) || (codeWord || slug);
        const notes = this.sanitizeText(payload.notes, 500);
        const createdBy = Number.isFinite(Number(actor.userId)) ? Number(actor.userId) : null;

        await this.db.query(
            `INSERT INTO referral_links (
                slug, channel_name, code_word, creator_tag, target_path,
                utm_source, utm_medium, utm_campaign, utm_content,
                is_active, notes, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
            [
                slug,
                channelName,
                codeWord || null,
                creatorTag || null,
                targetPath,
                utmSource,
                utmMedium,
                utmCampaign,
                utmContent || null,
                notes || null,
                createdBy
            ]
        );

        const rows = await this.db.query('SELECT * FROM referral_links WHERE slug = ? LIMIT 1', [slug]);
        return {
            success: true,
            link: this.mapLinkRow(rows[0] || { slug, channel_name: channelName, target_path: targetPath }, baseUrl)
        };
    }

    async updateReferralLink(id, payload = {}, options = {}) {
        const linkId = Number(id);
        if (!Number.isFinite(linkId) || linkId <= 0) {
            return { success: false, error: 'Invalid referral id' };
        }
        const baseUrl = this.resolveBaseUrl(options.baseUrl);
        const rows = await this.db.query('SELECT * FROM referral_links WHERE id = ? LIMIT 1', [linkId]);
        if (rows.length === 0) return { success: false, error: 'Referral link not found' };
        const current = rows[0];

        const nextActive = payload.isActive == null ? Number(current.is_active || 0) : (payload.isActive ? 1 : 0);
        const nextTarget = payload.targetPath || payload.target_path
            ? this.sanitizePath(payload.targetPath || payload.target_path)
            : this.sanitizePath(current.target_path || '/');
        const notes = payload.notes != null ? this.sanitizeText(payload.notes, 500) : this.sanitizeText(current.notes, 500);

        await this.db.query(
            `UPDATE referral_links
             SET is_active = ?,
                 target_path = ?,
                 notes = ?,
                 updated_at = datetime('now')
             WHERE id = ?`,
            [nextActive, nextTarget, notes || null, linkId]
        );

        const updatedRows = await this.db.query('SELECT * FROM referral_links WHERE id = ? LIMIT 1', [linkId]);
        return {
            success: true,
            link: this.mapLinkRow(updatedRows[0], baseUrl)
        };
    }

    buildRedirectUrl(link, incomingQuery = {}) {
        const localPath = this.sanitizePath(link.targetPath || '/');
        const target = new URL(localPath, `${this.baseUrl}/`);
        const incoming = incomingQuery && typeof incomingQuery === 'object' ? incomingQuery : {};

        for (const [key, value] of Object.entries(incoming)) {
            if (key === 'utm_source' || key === 'utm_medium' || key === 'utm_campaign' || key === 'rid') continue;
            if (value == null) continue;
            const cleaned = this.sanitizeText(value, 200);
            if (cleaned) target.searchParams.set(key, cleaned);
        }

        target.searchParams.set('utm_source', link.utmSource || 'creator');
        target.searchParams.set('utm_medium', link.utmMedium || 'referral');
        target.searchParams.set('utm_campaign', link.utmCampaign || `ref_${link.slug}`);
        if (link.utmContent) target.searchParams.set('utm_content', link.utmContent);
        target.searchParams.set('rid', link.slug);
        if (link.creatorTag) target.searchParams.set('ref_code', link.creatorTag);

        return `${target.pathname}${target.search}`;
    }

    hashIp(ipRaw) {
        const ip = this.sanitizeText(ipRaw, 120);
        if (!ip) return null;
        return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
    }

    async getReferralLinkBySlug(slug) {
        const cleanSlug = this.sanitizeSlug(slug, 80);
        if (!cleanSlug) return null;
        const rows = await this.db.query(
            `SELECT * FROM referral_links
             WHERE slug = ?
             LIMIT 1`,
            [cleanSlug]
        );
        if (rows.length === 0) return null;
        return this.mapLinkRow(rows[0]);
    }

    async registerReferralVisit(link, req = {}) {
        const sessionHint = this.sanitizeText(
            (req.headers && (req.headers['x-session-id'] || req.headers['x-session'])) || req.query?.session || '',
            160
        );
        const userAgent = this.sanitizeText(req.headers?.['user-agent'] || '', 300);
        const referrer = this.sanitizeText(req.headers?.referer || req.headers?.referrer || '', 300);
        const ipRaw = this.sanitizeText(
            (req.headers?.['x-forwarded-for'] || '').split(',')[0] || req.ip || req.socket?.remoteAddress || '',
            120
        );
        const ipHash = this.hashIp(ipRaw);

        await this.db.query(
            `INSERT INTO referral_visits (
                referral_link_id, slug, session_hint, ip_hash, user_agent, referrer, target_path, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                link.id,
                link.slug,
                sessionHint || null,
                ipHash,
                userAgent || null,
                referrer || null,
                link.targetPath || '/'
            ]
        );
    }

    async resolveAndTrackRedirect(slug, req = {}) {
        const link = await this.getReferralLinkBySlug(slug);
        if (!link || !link.isActive) {
            return {
                success: false,
                status: 404,
                redirectPath: '/',
                reason: 'link_not_found'
            };
        }

        await this.registerReferralVisit(link, req);
        const redirectPath = this.buildRedirectUrl(link, req.query || {});
        return {
            success: true,
            status: 302,
            redirectPath,
            link
        };
    }

    async listReferralLinks(options = {}) {
        const windowCfg = this.resolveWindowConfig(options, 'daily');
        const windowDays = windowCfg.windowDays;
        const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
        const offset = Math.max(0, Number(options.offset || 0));
        const sinceIso = windowCfg.sinceIso;
        const baseUrl = this.resolveBaseUrl(options.baseUrl);

        const rows = await this.db.query(
            `SELECT *
             FROM referral_links
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const statsRows = await this.db.query(
            `SELECT
                rl.id as link_id,
                COUNT(rv.id) as visits,
                COUNT(DISTINCT COALESCE(rv.session_hint, rv.ip_hash, CAST(rv.id AS TEXT))) as unique_visits,
                SUM(CASE WHEN msf.session_id IS NOT NULL THEN 1 ELSE 0 END) as sessions,
                SUM(CASE WHEN msf.product_views > 0 THEN 1 ELSE 0 END) as product_sessions,
                SUM(CASE WHEN msf.add_to_cart > 0 THEN 1 ELSE 0 END) as atc_sessions,
                SUM(CASE WHEN msf.checkout_submit_attempts > 0 THEN 1 ELSE 0 END) as checkout_sessions,
                SUM(CASE WHEN msf.booking_success > 0 THEN 1 ELSE 0 END) as booking_sessions,
                SUM(CASE WHEN msf.orders > 0 THEN 1 ELSE 0 END) as order_sessions
             FROM referral_links rl
             LEFT JOIN referral_visits rv
                ON rv.referral_link_id = rl.id
               AND rv.created_at >= ?
             LEFT JOIN metrics_session_facts msf
                ON msf.last_seen_at >= ?
               AND (
                    msf.click_id = rl.slug
                    OR (
                        rl.utm_campaign IS NOT NULL
                        AND rl.utm_campaign <> ''
                        AND msf.utm_campaign = rl.utm_campaign
                    )
               )
             GROUP BY rl.id`,
            [sinceIso, sinceIso]
        );
        const statsById = new Map(statsRows.map((row) => [Number(row.link_id), row]));

        const links = rows.map((row) => {
            const link = this.mapLinkRow(row, baseUrl);
            const stat = statsById.get(link.id) || {};
            const visits = Number(stat.visits || 0);
            const uniqueVisits = Number(stat.unique_visits || 0);
            const sessions = Number(stat.sessions || 0);
            const products = Number(stat.product_sessions || 0);
            const atc = Number(stat.atc_sessions || 0);
            const checkout = Number(stat.checkout_sessions || 0);
            const booking = Number(stat.booking_sessions || 0);
            const orders = Number(stat.order_sessions || 0);

            return {
                ...link,
                stats: {
                    visits,
                    uniqueVisits,
                    sessions,
                    productSessions: products,
                    addToCartSessions: atc,
                    checkoutSessions: checkout,
                    bookingSessions: booking,
                    orderSessions: orders,
                    visitToSessionPct: this.ratioPct(sessions, uniqueVisits || visits),
                    productOpenPct: this.ratioPct(products, sessions),
                    checkoutPct: this.ratioPct(checkout, sessions),
                    bookingPct: this.ratioPct(booking, sessions),
                    orderPct: this.ratioPct(orders, sessions)
                }
            };
        });

        return {
            success: true,
            windowDays,
            windowPreset: windowCfg.preset,
            windowBucket: windowCfg.bucket,
            since: sinceIso,
            total: links.length,
            links
        };
    }

    async buildGrowthOverview(options = {}) {
        const windowCfg = this.resolveWindowConfig(options, 'daily');
        const windowDays = windowCfg.windowDays;
        const sinceIso = windowCfg.sinceIso;
        const trendBucketSql = this.trendBucketSql(windowCfg.bucket, 'last_seen_at');
        const referralTrendBucketSql = this.trendBucketSql(windowCfg.bucket, 'msf.last_seen_at');
        const baseUrl = this.resolveBaseUrl(options.baseUrl);
        const linkList = await this.listReferralLinks({
            windowDays,
            windowPreset: windowCfg.preset,
            limit: 500,
            offset: 0,
            baseUrl
        });

        const [summaryRows, referralSummaryRows, channelRows, trendRows, referralTrendRows, landingRows] = await Promise.all([
            this.db.query(
                `SELECT
                    COUNT(*) as sessions,
                    SUM(CASE WHEN product_views > 0 THEN 1 ELSE 0 END) as product_sessions,
                    SUM(CASE WHEN add_to_cart > 0 THEN 1 ELSE 0 END) as atc_sessions,
                    SUM(CASE WHEN checkout_submit_attempts > 0 THEN 1 ELSE 0 END) as checkout_sessions,
                    SUM(CASE WHEN booking_success > 0 THEN 1 ELSE 0 END) as booking_sessions,
                    SUM(CASE WHEN orders > 0 THEN 1 ELSE 0 END) as order_sessions
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    COUNT(*) as referral_sessions,
                    SUM(CASE WHEN product_views > 0 THEN 1 ELSE 0 END) as product_sessions,
                    SUM(CASE WHEN add_to_cart > 0 THEN 1 ELSE 0 END) as atc_sessions,
                    SUM(CASE WHEN checkout_submit_attempts > 0 THEN 1 ELSE 0 END) as checkout_sessions,
                    SUM(CASE WHEN booking_success > 0 THEN 1 ELSE 0 END) as booking_sessions,
                    SUM(CASE WHEN orders > 0 THEN 1 ELSE 0 END) as order_sessions
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?
                   AND (
                       LOWER(COALESCE(utm_medium, '')) = 'referral'
                       OR click_id IN (SELECT slug FROM referral_links)
                   )`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    COALESCE(NULLIF(utm_source, ''), 'direct') as source,
                    COALESCE(NULLIF(utm_medium, ''), 'none') as medium,
                    COUNT(*) as sessions,
                    SUM(CASE WHEN product_views > 0 THEN 1 ELSE 0 END) as product_sessions,
                    SUM(CASE WHEN checkout_submit_attempts > 0 THEN 1 ELSE 0 END) as checkout_sessions,
                    SUM(CASE WHEN orders > 0 THEN 1 ELSE 0 END) as order_sessions
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?
                 GROUP BY source, medium
                 ORDER BY sessions DESC
                 LIMIT 20`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    ${trendBucketSql} as bucket,
                    COUNT(*) as sessions,
                    SUM(CASE WHEN product_views > 0 THEN 1 ELSE 0 END) as product_sessions,
                    SUM(CASE WHEN checkout_submit_attempts > 0 THEN 1 ELSE 0 END) as checkout_sessions,
                    SUM(CASE WHEN orders > 0 THEN 1 ELSE 0 END) as order_sessions
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?
                 GROUP BY bucket
                 ORDER BY bucket ASC`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    ${referralTrendBucketSql} as bucket,
                    COUNT(*) as sessions,
                    SUM(CASE WHEN msf.orders > 0 THEN 1 ELSE 0 END) as order_sessions,
                    SUM(CASE WHEN msf.booking_success > 0 THEN 1 ELSE 0 END) as booking_sessions
                 FROM metrics_session_facts msf
                 WHERE msf.last_seen_at >= ?
                   AND (
                      LOWER(COALESCE(msf.utm_medium, '')) = 'referral'
                      OR msf.click_id IN (SELECT slug FROM referral_links)
                   )
                 GROUP BY bucket
                 ORDER BY bucket ASC`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    COALESCE(NULLIF(landing_path, ''), '/') as landing_path,
                    COUNT(*) as sessions,
                    SUM(CASE WHEN orders > 0 THEN 1 ELSE 0 END) as order_sessions
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?
                 GROUP BY landing_path
                 ORDER BY sessions DESC
                 LIMIT 15`,
                [sinceIso]
            )
        ]);

        const summary = summaryRows[0] || {};
        const refSummary = referralSummaryRows[0] || {};
        const sessions = Number(summary.sessions || 0);
        const orders = Number(summary.order_sessions || 0);
        const referralSessions = Number(refSummary.referral_sessions || 0);
        const referralOrders = Number(refSummary.order_sessions || 0);

        const topLinks = (linkList.links || [])
            .sort((a, b) => Number(b.stats?.orderSessions || 0) - Number(a.stats?.orderSessions || 0))
            .slice(0, 20);

        const channels = channelRows.map((row) => ({
            source: String(row.source || 'direct'),
            medium: String(row.medium || 'none'),
            sessions: Number(row.sessions || 0),
            productSessions: Number(row.product_sessions || 0),
            checkoutSessions: Number(row.checkout_sessions || 0),
            orderSessions: Number(row.order_sessions || 0),
            productPct: this.ratioPct(Number(row.product_sessions || 0), Number(row.sessions || 0)),
            checkoutPct: this.ratioPct(Number(row.checkout_sessions || 0), Number(row.sessions || 0)),
            orderPct: this.ratioPct(Number(row.order_sessions || 0), Number(row.sessions || 0))
        }));

        const referralTrendMap = new Map(
            referralTrendRows.map((row) => [String(row.bucket), row])
        );
        const trend = trendRows.map((row) => {
            const bucket = String(row.bucket);
            const referral = referralTrendMap.get(bucket) || {};
            return {
                day: bucket,
                bucket,
                sessions: Number(row.sessions || 0),
                orders: Number(row.order_sessions || 0),
                checkoutSessions: Number(row.checkout_sessions || 0),
                referralSessions: Number(referral.sessions || 0),
                referralOrders: Number(referral.order_sessions || 0)
            };
        });
        const trendMeta = this.buildOverallTrend(trend, ['sessions', 'orders']);

        return {
            success: true,
            windowDays,
            windowPreset: windowCfg.preset,
            windowBucket: windowCfg.bucket,
            isAllTime: windowCfg.isAllTime,
            since: sinceIso,
            summary: {
                sessions,
                orders,
                checkoutSessions: Number(summary.checkout_sessions || 0),
                bookingSessions: Number(summary.booking_sessions || 0),
                orderRatePct: this.ratioPct(orders, sessions),
                referralSessions,
                referralOrders,
                referralSharePct: this.ratioPct(referralSessions, sessions),
                referralOrderSharePct: this.ratioPct(referralOrders, orders)
            },
            channels,
            topReferralLinks: topLinks,
            trend,
            trendMeta,
            landings: landingRows.map((row) => ({
                landingPath: String(row.landing_path || '/'),
                sessions: Number(row.sessions || 0),
                orderSessions: Number(row.order_sessions || 0),
                orderPct: this.ratioPct(Number(row.order_sessions || 0), Number(row.sessions || 0))
            })),
            referralLinksTotal: Number(linkList.total || 0)
        };
    }
}

module.exports = {
    GrowthAttributionService
};
