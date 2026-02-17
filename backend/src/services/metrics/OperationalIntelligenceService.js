const { getGeminiKeyHealth } = require('./geminiKeyHealth');
const { FUNNEL_CONTRACT_REGISTRY } = require('./funnelContractRegistry');

class OperationalIntelligenceService {
    constructor(db, options = {}) {
        this.db = db;
        this.geminiClient = options.geminiClient || null;
    }

    safeParse(raw, fallback = {}) {
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch {
            return fallback;
        }
    }

    parseGeminiText(result) {
        if (!result) return '';
        if (typeof result === 'string') return result;
        if (typeof result.text === 'string') return result.text;
        return '';
    }

    toLocalHourBucket(ts) {
        if (!ts) return null;
        const date = new Date(String(ts));
        if (Number.isNaN(date.getTime())) return null;
        date.setMinutes(0, 0, 0);
        return date.toISOString();
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

    inferPresetFromWindowHours(windowHours, fallback = 'daily') {
        const hours = Number(windowHours || 0);
        if (!Number.isFinite(hours) || hours <= 0) return fallback;
        if (hours <= 48) return 'hourly';
        if (hours <= 24 * 45) return 'daily';
        if (hours <= 24 * 210) return 'weekly';
        if (hours <= 24 * 900) return 'monthly';
        return 'all';
    }

    presetDefaultsHours(preset) {
        const safe = this.normalizeWindowPreset(preset, 'daily');
        const defaults = {
            hourly: 48,
            daily: 24 * 30,
            weekly: 24 * 182,
            monthly: 24 * 730,
            all: 24 * 3650
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

    trendBucketSql(bucket, fieldName = 'created_at') {
        const field = String(fieldName || 'created_at');
        const safeBucket = String(bucket || 'day');
        if (safeBucket === 'hour') return `strftime('%Y-%m-%d %H:00:00', ${field})`;
        if (safeBucket === 'week') return `strftime('%Y-W%W', ${field})`;
        if (safeBucket === 'month') return `strftime('%Y-%m', ${field})`;
        return `strftime('%Y-%m-%d', ${field})`;
    }

    resolveWindowConfig(options = {}, fallbackPreset = 'daily') {
        const explicitPreset = this.normalizeWindowPreset(options.windowPreset || options.preset, '');
        const hasWindowHours = Number.isFinite(Number(options.windowHours)) && Number(options.windowHours) > 0;
        const hasWindowDays = Number.isFinite(Number(options.windowDays)) && Number(options.windowDays) > 0;

        let preset = explicitPreset || fallbackPreset;
        if (!explicitPreset && hasWindowHours) {
            preset = this.inferPresetFromWindowHours(Number(options.windowHours), fallbackPreset);
        }
        if (!explicitPreset && !hasWindowHours && hasWindowDays) {
            preset = this.inferPresetFromWindowHours(Number(options.windowDays) * 24, fallbackPreset);
        }

        let windowHours = hasWindowHours
            ? Math.round(Number(options.windowHours))
            : (hasWindowDays
                ? Math.round(Number(options.windowDays) * 24)
                : this.presetDefaultsHours(preset));

        windowHours = Math.max(1, Math.min(24 * 3650, windowHours));
        const bucket = this.trendBucketForPreset(preset);
        const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
        const windowDays = Math.max(1, Math.ceil(windowHours / 24));

        return {
            preset: this.normalizeWindowPreset(preset, fallbackPreset),
            bucket,
            windowHours,
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
        const pickValue = (row) => {
            if (!keys.length) return 0;
            return keys.reduce((sum, key) => sum + Number(row?.[key] || 0), 0);
        };

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

    mergeScoreMap(rows) {
        const map = new Map();
        for (const row of rows) {
            const key = String(row.key || '');
            const score = Number(row.score || 0);
            if (!key) continue;
            map.set(key, (map.get(key) || 0) + score);
        }
        return [...map.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([key, score]) => ({ key, score: Math.round(score * 100) / 100 }));
    }

    ratioPct(numerator, denominator) {
        const n = Number(numerator || 0);
        const d = Number(denominator || 0);
        if (!d) return 0;
        return Math.round((n / d) * 10000) / 100;
    }

    clampPct(value) {
        return Math.max(0, Math.min(100, Number(value || 0)));
    }

    percentile(values = [], pct = 0.5) {
        const clean = (Array.isArray(values) ? values : [])
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v))
            .sort((a, b) => a - b);
        if (clean.length === 0) return 0;
        const rank = Math.max(0, Math.min(clean.length - 1, Math.floor((clean.length - 1) * pct)));
        return clean[rank];
    }

    readPath(obj, dottedPath) {
        if (!obj || typeof obj !== 'object') return null;
        const path = String(dottedPath || '').split('.').filter(Boolean);
        if (path.length === 0) return null;
        let cursor = obj;
        for (const chunk of path) {
            if (!cursor || typeof cursor !== 'object' || !(chunk in cursor)) return null;
            cursor = cursor[chunk];
        }
        return cursor;
    }

    hasContractValue(source, context, path) {
        const key = String(path || '').trim();
        if (!key) return false;
        const fromContext = key.startsWith('context.');
        const lookup = fromContext ? key.slice('context.'.length) : key;
        const value = this.readPath(fromContext ? (context || {}) : (source || {}), lookup);
        if (value == null) return false;
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'string') return value.trim().length > 0;
        if (typeof value === 'boolean') return true;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return Boolean(value);
    }

    weightedGoalScore(goalMap = {}) {
        const addToCart = Number(goalMap.add_to_cart || 0);
        const order = Number(goalMap.order || 0);
        const favorite = Number(goalMap.favorite || 0);
        const bookingSuccess = Number(goalMap.booking_success || 0);
        return (order * 5) + (bookingSuccess * 5) + (addToCart * 2) + favorite;
    }

    variantWeightMap(variants = []) {
        const map = new Map();
        let total = 0;
        for (const variant of Array.isArray(variants) ? variants : []) {
            const name = String(variant?.name || 'variant');
            const weight = Math.max(0, Number(variant?.weight || 0));
            map.set(name, weight);
            total += weight;
        }
        if (total <= 0) {
            for (const name of map.keys()) map.set(name, 1);
            total = map.size;
        }
        return {
            map,
            total
        };
    }

    computeDrLift(controlRow, variantRow, controlPropensity, variantPropensity) {
        const controlMean = Number(controlRow?.mean || 0);
        const variantMean = Number(variantRow?.mean || 0);
        const controlIpw = controlPropensity > 0 ? controlMean / controlPropensity : controlMean;
        const variantIpw = variantPropensity > 0 ? variantMean / variantPropensity : variantMean;
        const ipwDelta = variantIpw - controlIpw;
        const regressionDelta = variantMean - controlMean;
        const shrinkage = Number(variantRow?.count || 0) / (Number(variantRow?.count || 0) + 60);
        const dr = ((ipwDelta * 0.7) + (regressionDelta * 0.3)) * Math.max(0, Math.min(1, shrinkage));
        const baseline = Math.max(0.000001, Math.abs(controlIpw));
        const drPct = (dr / baseline) * 100;
        return {
            dr,
            drPct,
            shrinkage,
            controlIpw,
            variantIpw
        };
    }

    funnelStageFromPath(path = '') {
        const value = String(path || '').toLowerCase();
        if (!value) return 'unknown';
        if (value.includes('/catalog')) return 'catalog';
        if (value.includes('/product') || value.includes('/bike/')) return 'product';
        if (value.includes('/checkout') || value.includes('/guest-order') || value.includes('/booking-checkout')) return 'checkout';
        if (value.includes('/booking') || value.includes('/order-tracking')) return 'booking';
        return 'other';
    }

    classifyStage(meta = {}, sourcePath = '', eventType = '') {
        const explicit = String(meta.stage || meta.funnel_stage || '').trim().toLowerCase();
        if (explicit) return explicit;
        const event = String(eventType || '').toLowerCase();
        if (event.includes('checkout')) return 'checkout';
        if (event.includes('booking') || event === 'order') return 'booking';
        if (event === 'product_view' || event === 'detail_open') return 'product';
        if (event === 'catalog_view') return 'catalog';
        const path = String(meta.path || sourcePath || '').trim();
        return this.funnelStageFromPath(path);
    }

    normalizeSourcePath(value = '') {
        const raw = String(value || '').trim();
        if (!raw) return '/';
        const noHash = raw.split('#')[0];
        const noQuery = noHash.split('?')[0];
        const path = noQuery.trim();
        if (!path) return '/';
        return path.startsWith('/') ? path : `/${path}`;
    }

    behaviorStageFromEvent(eventType = '', sourcePath = '', meta = {}) {
        const event = String(eventType || '').toLowerCase();
        const explicit = String(meta.stage || meta.funnel_stage || '').trim().toLowerCase();
        if (explicit) return explicit;

        const path = this.normalizeSourcePath(String(sourcePath || meta.path || ''));
        if (
            path.startsWith('/guarantees') ||
            path.startsWith('/delivery') ||
            path.startsWith('/payment') ||
            path.startsWith('/documents') ||
            path.startsWith('/faq') ||
            path.startsWith('/how-it-works')
        ) {
            return 'info';
        }

        if (
            event.includes('checkout') ||
            event.includes('form_') ||
            event === 'checkout_start' ||
            event === 'checkout_step'
        ) {
            return 'checkout';
        }
        if (event.includes('booking') || event === 'order') return 'booking';
        if (
            event === 'product_view' ||
            event === 'detail_open' ||
            event === 'add_to_cart' ||
            event === 'favorite' ||
            event === 'dwell'
        ) {
            return 'product';
        }
        if (event === 'catalog_view') return 'catalog';

        if (path.includes('/catalog')) return 'catalog';
        if (path.includes('/product') || path.includes('/bike/')) return 'product';
        if (path.includes('/guest-order') || path.includes('/booking-checkout')) return 'checkout';
        if (path.includes('/booking') || path.includes('/order-tracking')) return 'booking';
        if (event === 'session_start' || event === 'page_view' || path === '/') return 'entry';

        return 'other';
    }

    safeNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    average(values = []) {
        const clean = (Array.isArray(values) ? values : [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));
        if (clean.length === 0) return 0;
        const sum = clean.reduce((acc, value) => acc + value, 0);
        return sum / clean.length;
    }

    normalizeDepthPct(meta = {}) {
        const candidateRaw = [
            meta.scroll_depth,
            meta.scrollDepth,
            meta.depth_pct,
            meta.depthPct,
            meta.depth
        ];
        for (const raw of candidateRaw) {
            const n = Number(raw);
            if (!Number.isFinite(n)) continue;
            if (n >= 0 && n <= 1) return Math.max(0, Math.min(100, n * 100));
            if (n >= 0 && n <= 100) return Math.max(0, Math.min(100, n));
        }
        return null;
    }

    stageTitle(stage = '') {
        const key = String(stage || '').toLowerCase();
        if (key === 'entry') return 'Вход на сайт';
        if (key === 'catalog') return 'Каталог';
        if (key === 'product') return 'Карточка товара';
        if (key === 'checkout') return 'Checkout';
        if (key === 'booking') return 'Бронь / заказ';
        if (key === 'info') return 'Инфо-страницы';
        if (key === 'other') return 'Прочее';
        return key || 'unknown';
    }

    buildBehaviorOverview(eventRows = [], options = {}) {
        const rows = Array.isArray(eventRows) ? eventRows : [];
        const stageOrder = ['entry', 'catalog', 'product', 'checkout', 'booking'];
        const stageIndex = new Map(stageOrder.map((stage, index) => [stage, index]));

        const stageMap = new Map();
        const stageTransitionMap = new Map();
        const pathTransitionMap = new Map();
        const clickTargetMap = new Map();
        const sessionStats = new Map();
        const sessionPrevPath = new Map();
        const sessionPrevStage = new Map();

        const touchStage = (stage) => {
            if (!stageMap.has(stage)) {
                stageMap.set(stage, {
                    stage,
                    totalTouches: 0,
                    sessions: new Set(),
                    dwellMs: 0,
                    depthValues: [],
                    sessionTimes: new Map()
                });
            }
            return stageMap.get(stage);
        };

        const touchSession = (sessionId) => {
            if (!sessionStats.has(sessionId)) {
                sessionStats.set(sessionId, {
                    entries: 0,
                    catalogFirstTs: null,
                    catalogLastTs: null,
                    firstDetailTs: null,
                    impressionsBeforeFirstDetail: 0,
                    productDwellMs: 0
                });
            }
            return sessionStats.get(sessionId);
        };

        const touchStageTransition = (fromStage, toStage, sessionId) => {
            if (!fromStage || !toStage || fromStage === toStage) return;
            const key = `${fromStage}=>${toStage}`;
            if (!stageTransitionMap.has(key)) {
                stageTransitionMap.set(key, {
                    stageFrom: fromStage,
                    stageTo: toStage,
                    events: 0,
                    sessions: new Set()
                });
            }
            const row = stageTransitionMap.get(key);
            row.events += 1;
            row.sessions.add(sessionId);
        };

        const touchPathTransition = (fromPath, toPath, sessionId) => {
            if (!fromPath || !toPath || fromPath === toPath) return;
            const key = `${fromPath}=>${toPath}`;
            if (!pathTransitionMap.has(key)) {
                pathTransitionMap.set(key, {
                    fromPath,
                    toPath,
                    events: 0,
                    sessions: new Set()
                });
            }
            const row = pathTransitionMap.get(key);
            row.events += 1;
            row.sessions.add(sessionId);
        };

        for (const row of rows) {
            const sessionId = String(row.session_id || '').trim();
            if (!sessionId) continue;

            const eventType = String(row.event_type || '').trim().toLowerCase();
            const meta = this.safeParse(row.metadata, {});
            const path = this.normalizeSourcePath(String(row.source_path || meta.path || ''));
            const stage = this.behaviorStageFromEvent(eventType, path, meta);
            const ts = new Date(String(row.created_at || '')).getTime();
            const tsMs = Number.isFinite(ts) ? ts : 0;
            const dwellMs = Math.max(0, Number(row.dwell_ms || meta.dwell_ms || meta.ms || 0));

            const stageRow = touchStage(stage);
            stageRow.totalTouches += 1;
            stageRow.sessions.add(sessionId);
            if (dwellMs > 0) stageRow.dwellMs += dwellMs;

            const depth = this.normalizeDepthPct(meta);
            if (depth != null) stageRow.depthValues.push(depth);

            const stageTime = stageRow.sessionTimes.get(sessionId) || { first: null, last: null };
            stageTime.first = stageTime.first == null ? tsMs : Math.min(stageTime.first, tsMs);
            stageTime.last = stageTime.last == null ? tsMs : Math.max(stageTime.last, tsMs);
            stageRow.sessionTimes.set(sessionId, stageTime);

            const prevPath = sessionPrevPath.get(sessionId);
            if (prevPath) {
                touchPathTransition(prevPath, path, sessionId);
            }
            sessionPrevPath.set(sessionId, path);

            const prevStage = sessionPrevStage.get(sessionId);
            if (prevStage) {
                touchStageTransition(prevStage, stage, sessionId);
            }
            sessionPrevStage.set(sessionId, stage);

            if (eventType === 'first_click' || eventType === 'ui_click') {
                const rawTarget = String(
                    meta.target_label ||
                    meta.click_target ||
                    meta.click_text ||
                    meta.target_path ||
                    meta.target_href ||
                    path ||
                    'unknown'
                ).trim().slice(0, 90);
                if (rawTarget) {
                    clickTargetMap.set(rawTarget, (clickTargetMap.get(rawTarget) || 0) + 1);
                }
            }

            const session = touchSession(sessionId);
            if (eventType === 'page_view') session.entries += 1;
            if (eventType === 'impression' && !session.firstDetailTs) session.impressionsBeforeFirstDetail += 1;
            if (eventType === 'detail_open' && !session.firstDetailTs) session.firstDetailTs = tsMs;
            if (stage === 'catalog') {
                session.catalogFirstTs = session.catalogFirstTs == null ? tsMs : Math.min(session.catalogFirstTs, tsMs);
                session.catalogLastTs = session.catalogLastTs == null ? tsMs : Math.max(session.catalogLastTs, tsMs);
            }
            if (stage === 'product' && dwellMs > 0) {
                session.productDwellMs += dwellMs;
            }
        }

        const uniqueSessions = Math.max(0, Number(options.sessions || 0));
        const totalEntries = [...sessionStats.values()].reduce((sum, row) => sum + Number(row.entries || 0), 0);
        const avgEntriesPerSession = uniqueSessions > 0 ? totalEntries / uniqueSessions : 0;

        const catalogDurationsSec = [...sessionStats.values()]
            .map((row) => {
                if (row.catalogFirstTs == null || row.catalogLastTs == null) return null;
                return Math.max(0, (row.catalogLastTs - row.catalogFirstTs) / 1000);
            })
            .filter((value) => value != null);
        const avgCatalogDurationSec = this.average(catalogDurationsSec);

        const cardsBeforeFirstClick = [...sessionStats.values()]
            .filter((row) => row.firstDetailTs != null)
            .map((row) => Number(row.impressionsBeforeFirstDetail || 0));
        const avgCardsBeforeFirstClick = this.average(cardsBeforeFirstClick);

        const productDwellSec = [...sessionStats.values()]
            .filter((row) => Number(row.productDwellMs || 0) > 0)
            .map((row) => Number(row.productDwellMs || 0) / 1000);
        const avgProductDwellSec = this.average(productDwellSec);

        const stageTransitions = [...stageTransitionMap.values()]
            .map((row) => ({
                stageFrom: row.stageFrom,
                stageTo: row.stageTo,
                events: Number(row.events || 0),
                sessions: row.sessions.size
            }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 24)
            .map((row) => ({
                ...row,
                transitionRatePct: this.ratioPct(row.sessions, stageMap.get(row.stageFrom)?.sessions?.size || 0)
            }));

        const pathTransitions = [...pathTransitionMap.values()]
            .map((row) => ({
                fromPath: row.fromPath,
                toPath: row.toPath,
                events: Number(row.events || 0),
                sessions: row.sessions.size
            }))
            .sort((a, b) => b.events - a.events)
            .slice(0, 30);

        const infoTransitions = [...pathTransitionMap.values()]
            .filter((row) => {
                const fromPath = String(row.fromPath || '');
                const toPath = String(row.toPath || '');
                return fromPath.startsWith('/product/') && (
                    toPath.startsWith('/guarantees') ||
                    toPath.startsWith('/delivery') ||
                    toPath.startsWith('/payment') ||
                    toPath.startsWith('/documents') ||
                    toPath.startsWith('/faq') ||
                    toPath.startsWith('/how-it-works')
                );
            })
            .map((row) => ({
                fromPath: row.fromPath,
                toPath: row.toPath,
                events: Number(row.events || 0),
                sessions: row.sessions.size
            }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 12);

        const behaviorStages = [...stageMap.values()]
            .map((row) => {
                const sessionDurationsSec = [...row.sessionTimes.values()].map((time) => {
                    if (time.first == null || time.last == null) return 0;
                    return Math.max(0, (time.last - time.first) / 1000);
                });
                const uniqueStageSessions = row.sessions.size;
                const orderPos = stageIndex.get(row.stage);
                const nextStage = Number.isInteger(orderPos) ? stageOrder[orderPos + 1] : null;
                const straightTransition = nextStage
                    ? stageTransitions.find((item) => item.stageFrom === row.stage && item.stageTo === nextStage)
                    : null;
                return {
                    stage: row.stage,
                    title: this.stageTitle(row.stage),
                    totalTouches: Number(row.totalTouches || 0),
                    uniqueSessions: uniqueStageSessions,
                    reachPct: this.ratioPct(uniqueStageSessions, uniqueSessions),
                    avgRetentionSec: Math.round(this.average(sessionDurationsSec) * 100) / 100,
                    avgDwellSec: Math.round(((row.dwellMs || 0) / Math.max(1, uniqueStageSessions) / 1000) * 100) / 100,
                    avgScrollDepthPct: Math.round(this.average(row.depthValues) * 100) / 100,
                    nextStage: nextStage || null,
                    nextStageRatePct: straightTransition ? straightTransition.transitionRatePct : 0
                };
            })
            .sort((a, b) => {
                const ai = stageIndex.has(a.stage) ? stageIndex.get(a.stage) : 99;
                const bi = stageIndex.has(b.stage) ? stageIndex.get(b.stage) : 99;
                if (ai !== bi) return ai - bi;
                return b.uniqueSessions - a.uniqueSessions;
            });

        const topClickTargets = [...clickTargetMap.entries()]
            .map(([target, clicks]) => ({ target, clicks: Number(clicks || 0) }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 12);

        const stageRowsByKey = new Map(behaviorStages.map((row) => [row.stage, row]));
        const ceoFunnel = stageOrder.map((stage) => {
            const row = stageRowsByKey.get(stage);
            return {
                stage,
                title: this.stageTitle(stage),
                totalTouches: Number(row?.totalTouches || 0),
                uniqueSessions: Number(row?.uniqueSessions || 0),
                reachPct: Number(row?.reachPct || 0),
                avgRetentionSec: Number(row?.avgRetentionSec || 0),
                nextStage: row?.nextStage || null,
                nextStageRatePct: Number(row?.nextStageRatePct || 0),
                lossPct: Math.max(0, Math.round((100 - Number(row?.nextStageRatePct || 0)) * 100) / 100)
            };
        });

        return {
            ceoFlow: {
                totalEntries,
                uniqueSessions,
                avgEntriesPerSession: Math.round(avgEntriesPerSession * 100) / 100,
                avgCatalogDurationSec: Math.round(avgCatalogDurationSec * 100) / 100,
                avgCardsBeforeFirstClick: Math.round(avgCardsBeforeFirstClick * 100) / 100,
                avgProductDwellSec: Math.round(avgProductDwellSec * 100) / 100
            },
            ceoFunnel,
            behaviorStages,
            stageTransitions,
            pathTransitions,
            infoTransitions,
            topClickTargets
        };
    }

    async computeGuardrailMetrics(windowDays = 14) {
        const sinceIso = new Date(Date.now() - Math.max(1, Number(windowDays || 14)) * 24 * 60 * 60 * 1000).toISOString();
        const result = {
            cancelRatePct: 0,
            refundRatePct: 0,
            timeToBookingSecP50: 0,
            timeToBookingSecP75: 0,
            apiErrorRatePct: 0,
            apiP95Ms: 0,
            degraded: false,
            reasons: []
        };

        try {
            const orderRows = await this.db.query(
                `SELECT
                    COUNT(*) as total_orders,
                    SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('cancelled','canceled','rejected') THEN 1 ELSE 0 END) as canceled_orders,
                    SUM(CASE WHEN LOWER(COALESCE(payment_status, '')) = 'refunded' THEN 1 ELSE 0 END) as refunded_orders
                 FROM orders
                 WHERE created_at >= ?`,
                [sinceIso]
            );
            const totalOrders = Number(orderRows[0]?.total_orders || 0);
            const canceledOrders = Number(orderRows[0]?.canceled_orders || 0);
            const refundedOrders = Number(orderRows[0]?.refunded_orders || 0);
            result.cancelRatePct = this.ratioPct(canceledOrders, totalOrders);
            result.refundRatePct = this.ratioPct(refundedOrders, totalOrders);
        } catch {
            // Orders table may vary by environment.
        }

        try {
            const latencyRows = await this.db.query(
                `SELECT metadata
                 FROM metric_events
                 WHERE created_at >= ?
                   AND event_type = 'api_latency'
                   AND metadata IS NOT NULL`,
                [sinceIso]
            );
            const values = [];
            let errors = 0;
            for (const row of latencyRows) {
                const meta = this.safeParse(row.metadata, {});
                const duration = Number(meta.duration_ms || meta.durationMs || meta.ms);
                if (Number.isFinite(duration) && duration >= 0) values.push(duration);
                const status = Number(meta.status || 0);
                if (status >= 500 || Number(meta.network_error || 0) === 1) errors += 1;
            }
            result.apiP95Ms = Math.round(this.percentile(values, 0.95));
            result.apiErrorRatePct = this.ratioPct(errors, values.length);
        } catch {
            // ignore
        }

        try {
            const ttbRows = await this.db.query(
                `WITH starts AS (
                    SELECT session_id, MIN(created_at) as checkout_at
                    FROM metric_events
                    WHERE created_at >= ?
                      AND session_id IS NOT NULL
                      AND event_type IN ('checkout_start','checkout_submit_attempt')
                    GROUP BY session_id
                ),
                ends AS (
                    SELECT session_id, MIN(created_at) as booking_at
                    FROM metric_events
                    WHERE created_at >= ?
                      AND session_id IS NOT NULL
                      AND event_type IN ('booking_success','order')
                    GROUP BY session_id
                )
                SELECT (julianday(ends.booking_at) - julianday(starts.checkout_at)) * 86400.0 as sec
                FROM starts
                JOIN ends ON ends.session_id = starts.session_id`,
                [sinceIso, sinceIso]
            );
            const values = ttbRows
                .map((row) => Number(row.sec))
                .filter((v) => Number.isFinite(v) && v >= 0);
            result.timeToBookingSecP50 = Math.round(this.percentile(values, 0.5));
            result.timeToBookingSecP75 = Math.round(this.percentile(values, 0.75));
        } catch {
            // ignore
        }

        if (result.apiErrorRatePct > 5) result.reasons.push('api_error_rate_spike');
        if (result.apiP95Ms > 1800) result.reasons.push('api_latency_high');
        if (result.cancelRatePct > 12) result.reasons.push('cancel_rate_high');
        if (result.refundRatePct > 8) result.reasons.push('refund_rate_high');
        if (result.timeToBookingSecP75 > 7200) result.reasons.push('time_to_booking_slow');
        result.degraded = result.reasons.length > 0;

        return result;
    }

    chiSquareThreshold(df) {
        const table = {
            1: 3.84,
            2: 5.99,
            3: 7.81,
            4: 9.49
        };
        return table[df] || 11.07; // df>=5, alpha~0.05 approximation
    }

    buildExperimentDiagnostics(experimentRows = [], assignmentRows = [], goalRows = [], minAssignments = 0) {
        const assignmentsMap = new Map();
        for (const row of assignmentRows) {
            assignmentsMap.set(`${row.experiment_key}:${row.variant}`, Number(row.cnt || 0));
        }

        const goalsMap = new Map();
        for (const row of goalRows) {
            const key = `${row.experiment_key}:${row.variant}`;
            const current = goalsMap.get(key) || { add_to_cart: 0, order: 0, booking_success: 0, favorite: 0, total: 0 };
            const metric = String(row.metric_name || '');
            const val = Number(row.val || 0);
            if (metric === 'add_to_cart') current.add_to_cart += val;
            if (metric === 'order') current.order += val;
            if (metric === 'booking_success') current.booking_success += val;
            if (metric === 'favorite') current.favorite += val;
            current.total += val;
            goalsMap.set(key, current);
        }

        const list = experimentRows.map((exp) => {
            const variants = this.safeParse(exp.variants_json, []);
            const perVariant = variants.map((variant) => {
                const name = String(variant.name || 'variant');
                const key = `${exp.experiment_key}:${name}`;
                const assignments = Number(assignmentsMap.get(key) || 0);
                const goals = goalsMap.get(key) || { add_to_cart: 0, order: 0, booking_success: 0, favorite: 0, total: 0 };
                const weightedGoals = (goals.order + goals.booking_success) * 5 + goals.add_to_cart * 2 + goals.favorite;
                const conversion = assignments > 0 ? weightedGoals / assignments : 0;
                const orderRate = assignments > 0 ? goals.order / assignments : 0;
                return {
                    variant: name,
                    configuredWeight: Number(variant.weight || 0),
                    assignments,
                    goals,
                    weightedGoals,
                    conversion,
                    orderRate
                };
            });

            const totalAssignments = perVariant.reduce((sum, row) => sum + row.assignments, 0);
            const totalWeight = perVariant.reduce((sum, row) => sum + row.configuredWeight, 0);
            let chiSquare = 0;
            for (const row of perVariant) {
                const expected = totalWeight > 0 ? (totalAssignments * row.configuredWeight) / totalWeight : 0;
                if (expected > 0) {
                    chiSquare += ((row.assignments - expected) ** 2) / expected;
                }
            }
            const df = Math.max(1, perVariant.length - 1);
            const threshold = this.chiSquareThreshold(df);
            const srmDetected = perVariant.length > 1 && totalAssignments >= Math.max(40, minAssignments) && chiSquare > threshold;

            const control = perVariant.find((v) => v.variant === 'control') || perVariant[0] || null;
            const aaLike = /(^|[_-])aa($|[_-])/i.test(String(exp.experiment_key || '')) || /\baa\b/i.test(String(exp.name || ''));
            const maxAbsUplift = perVariant.reduce((max, row) => {
                if (!control || control.conversion <= 0) return max;
                const uplift = Math.abs(((row.conversion - control.conversion) / control.conversion) * 100);
                return Math.max(max, uplift);
            }, 0);

            const controlPropensity = (control && totalWeight > 0)
                ? Number(control.configuredWeight || 0) / totalWeight
                : 0.5;
            const controlIpw = (control && controlPropensity > 0)
                ? Number(control.conversion || 0) / controlPropensity
                : Number(control?.conversion || 0);

            const enrichedVariants = perVariant.map((row) => {
                const propensity = totalWeight > 0 ? Number(row.configuredWeight || 0) / totalWeight : 0;
                const ipwConversion = propensity > 0 ? Number(row.conversion || 0) / propensity : Number(row.conversion || 0);
                const shrinkage = Number(row.assignments || 0) / (Number(row.assignments || 0) + 120);
                const upliftRaw = ipwConversion - controlIpw;
                const upliftPct = controlIpw > 0 ? (upliftRaw / controlIpw) * 100 : (upliftRaw * 100);
                const causalUpliftPct = Math.round((upliftPct * Math.max(0, Math.min(1, shrinkage))) * 100) / 100;
                return {
                    ...row,
                    propensity: Math.round(propensity * 10000) / 10000,
                    ipwConversion,
                    shrinkage,
                    causalUpliftPct
                };
            });

            return {
                experimentKey: exp.experiment_key,
                name: exp.name || exp.experiment_key,
                updatedAt: exp.updated_at,
                srm: {
                    detected: srmDetected,
                    chiSquare: Math.round(chiSquare * 100) / 100,
                    threshold,
                    df,
                    totalAssignments
                },
                aa: {
                    enabled: aaLike,
                    suspicious: aaLike && totalAssignments >= Math.max(60, minAssignments) && maxAbsUplift > 5,
                    maxAbsUpliftPct: Math.round(maxAbsUplift * 100) / 100
                },
                causalModel: {
                    type: 'ipw_shrinkage',
                    controlVariant: control?.variant || null,
                    controlIpwConversion: Math.round(controlIpw * 100000) / 100000
                },
                variants: enrichedVariants.map((row) => ({
                    ...row,
                    conversionPct: Math.round(row.conversion * 10000) / 100,
                    orderRatePct: Math.round(row.orderRate * 10000) / 100,
                    upliftVsControlPct: control && control.conversion > 0
                        ? Math.round((((row.conversion - control.conversion) / control.conversion) * 100) * 100) / 100
                        : 0,
                    causalUpliftPct: Number(row.causalUpliftPct || 0)
                }))
            };
        });

        return {
            list,
            assignmentsMap,
            goalsMap
        };
    }

    normalizeExperimentWeights(variants = [], rawByName = {}, options = {}) {
        const minWeight = Math.max(2, Number(options.minWeight || 5));
        const controlFloor = Math.max(15, Math.min(65, Number(options.controlFloor || 22)));
        const names = (Array.isArray(variants) ? variants : []).map((v) => String(v.name || 'variant'));
        if (names.length === 0) return {};

        const scores = names.map((name) => Math.max(0.0001, Number(rawByName[name] || 0)));
        const scoreSum = scores.reduce((s, v) => s + v, 0) || 1;
        const weights = {};
        names.forEach((name, idx) => {
            weights[name] = (scores[idx] / scoreSum) * 100;
        });

        const controlName = names.includes('control') ? 'control' : names[0];
        if (names.length > 1) {
            weights[controlName] = Math.max(weights[controlName], controlFloor);
            const others = names.filter((n) => n !== controlName);
            let rem = 100 - weights[controlName];
            if (rem < 0) rem = 0;
            const otherSum = others.reduce((s, n) => s + Math.max(0, Number(weights[n] || 0)), 0);
            if (otherSum <= 0) {
                const even = rem / Math.max(1, others.length);
                for (const name of others) weights[name] = even;
            } else {
                for (const name of others) {
                    weights[name] = (Math.max(0, Number(weights[name] || 0)) / otherSum) * rem;
                }
            }

            for (const name of others) {
                if (weights[name] < minWeight) {
                    const needed = minWeight - weights[name];
                    weights[name] = minWeight;
                    const donors = others.filter((d) => d !== name).sort((a, b) => weights[b] - weights[a]);
                    let left = needed;
                    for (const donor of donors) {
                        if (left <= 0) break;
                        const transferable = Math.max(0, Number(weights[donor] || 0) - minWeight);
                        if (transferable <= 0) continue;
                        const take = Math.min(transferable, left);
                        weights[donor] -= take;
                        left -= take;
                    }
                }
            }
        }

        const rounded = {};
        let allocated = 0;
        names.forEach((name, idx) => {
            if (idx === names.length - 1) {
                rounded[name] = Math.max(0, 100 - allocated);
            } else {
                const value = Math.max(0, Math.round(Number(weights[name] || 0)));
                rounded[name] = value;
                allocated += value;
            }
        });
        return rounded;
    }

    buildSegmentedCausalInsights(experimentRows = [], assignmentRows = [], goalRows = [], sessionRows = [], featureRows = [], options = {}) {
        const minSegmentAssignments = Math.max(8, Number(options.minSegmentAssignments || 18));

        const sessionById = new Map();
        for (const row of sessionRows) {
            sessionById.set(String(row.session_id || ''), {
                utmSource: String(row.utm_source || 'direct') || 'direct',
                landingPath: row.landing_path || row.first_source_path || null
            });
        }

        const budgetByUser = new Map();
        for (const row of featureRows) {
            const userId = Number(row.user_id || 0);
            if (!Number.isFinite(userId) || userId <= 0) continue;
            if (!budgetByUser.has(userId)) {
                budgetByUser.set(userId, String(row.budget_cluster || 'unknown'));
            }
        }

        const goalBySubject = new Map();
        for (const row of goalRows) {
            const experimentKey = String(row.experiment_key || '');
            const variant = String(row.variant || 'control');
            const metricName = String(row.metric_name || '');
            const val = Number(row.val || 0);
            const subjectKey = row.session_id
                ? `session:${row.session_id}`
                : Number(row.user_id || 0) > 0
                    ? `user:${Number(row.user_id)}`
                    : null;
            if (!experimentKey || !subjectKey) continue;
            const mapKey = `${experimentKey}:${variant}:${subjectKey}`;
            const current = goalBySubject.get(mapKey) || {};
            current[metricName] = (Number(current[metricName] || 0) + val);
            goalBySubject.set(mapKey, current);
        }

        const experiments = new Map((Array.isArray(experimentRows) ? experimentRows : []).map((row) => [String(row.experiment_key || ''), row]));
        const result = [];

        for (const [experimentKey, expRow] of experiments.entries()) {
            const variants = this.safeParse(expRow?.variants_json, [])
                .map((item) => ({
                    name: String(item?.name || 'variant'),
                    weight: Math.max(0, Number(item?.weight || 0))
                }))
                .filter((item) => item.weight > 0);
            if (variants.length < 2) continue;

            const { map: weightMap, total: totalWeight } = this.variantWeightMap(variants);
            const controlName = variants.find((v) => v.name === 'control')?.name || variants[0].name;

            const bucket = new Map();
            const push = (segmentKey, variant, outcome) => {
                if (!bucket.has(segmentKey)) bucket.set(segmentKey, new Map());
                const byVariant = bucket.get(segmentKey);
                const current = byVariant.get(variant) || { sum: 0, count: 0 };
                current.sum += outcome;
                current.count += 1;
                byVariant.set(variant, current);
            };

            const scopedAssignments = assignmentRows.filter((row) => String(row.experiment_key || '') === experimentKey);
            for (const row of scopedAssignments) {
                const variant = String(row.variant || 'control');
                const sessionId = row.session_id ? String(row.session_id) : null;
                const userId = Number(row.user_id || 0) > 0 ? Number(row.user_id) : null;
                const subjectKey = String(
                    row.subject_key
                    || (sessionId ? `session:${sessionId}` : userId ? `user:${userId}` : '')
                );
                if (!subjectKey) continue;
                const goals = goalBySubject.get(`${experimentKey}:${variant}:${subjectKey}`) || {};
                const outcome = this.weightedGoalScore(goals);

                const session = sessionId ? sessionById.get(sessionId) : null;
                const channel = String(session?.utmSource || 'direct');
                const landingPath = String(session?.landingPath || '');
                const stage = this.funnelStageFromPath(landingPath);
                const budgetCluster = userId ? String(budgetByUser.get(userId) || 'unknown') : 'unknown';

                push(`channel:${channel}`, variant, outcome);
                push(`stage:${stage}`, variant, outcome);
                push(`budget:${budgetCluster}`, variant, outcome);
            }

            const segments = [];
            for (const [segmentKey, byVariant] of bucket.entries()) {
                const [segmentType, segmentValueRaw] = String(segmentKey).split(':');
                const segmentValue = segmentValueRaw || 'unknown';
                const controlRow = byVariant.get(controlName) || { sum: 0, count: 0 };
                if (Number(controlRow.count || 0) < minSegmentAssignments) continue;
                const controlMean = controlRow.count > 0 ? controlRow.sum / controlRow.count : 0;
                const controlProp = (Number(weightMap.get(controlName) || 0) / Math.max(1, totalWeight)) || 0.5;

                for (const variant of variants) {
                    if (variant.name === controlName) continue;
                    const row = byVariant.get(variant.name) || { sum: 0, count: 0 };
                    if (Number(row.count || 0) < minSegmentAssignments) continue;
                    const variantMean = row.count > 0 ? row.sum / row.count : 0;
                    const variantProp = (Number(weightMap.get(variant.name) || 0) / Math.max(1, totalWeight)) || 0.5;
                    const dr = this.computeDrLift(
                        { mean: controlMean, count: controlRow.count },
                        { mean: variantMean, count: row.count },
                        controlProp,
                        variantProp
                    );
                    segments.push({
                        segmentType,
                        segmentValue,
                        segment: `${segmentType}:${segmentValue}`,
                        variant: variant.name,
                        sampleSize: Number(controlRow.count || 0) + Number(row.count || 0),
                        controlCount: Number(controlRow.count || 0),
                        variantCount: Number(row.count || 0),
                        controlMean: Math.round(controlMean * 10000) / 10000,
                        variantMean: Math.round(variantMean * 10000) / 10000,
                        drLift: Math.round(dr.dr * 10000) / 10000,
                        drLiftPct: Math.round(dr.drPct * 100) / 100,
                        shrinkage: Math.round(Number(dr.shrinkage || 0) * 10000) / 10000
                    });
                }
            }

            segments.sort((a, b) => Math.abs(b.drLiftPct) - Math.abs(a.drLiftPct));
            result.push({
                experimentKey,
                model: 'dr_lite_segmented',
                segments: segments.slice(0, 18)
            });
        }

        return result;
    }

    async checkFunnelContract(options = {}) {
        const windowCfg = this.resolveWindowConfig(options, 'daily');
        const windowHours = windowCfg.windowHours;
        const minCoveragePct = Math.max(40, Math.min(100, Number(options.minCoveragePct || 90)));
        const sinceIso = windowCfg.sinceIso;
        const contracts = FUNNEL_CONTRACT_REGISTRY?.eventContracts || {};
        const eventTypes = Object.keys(contracts);

        if (eventTypes.length === 0) {
            return {
                success: true,
                windowHours,
                windowPreset: windowCfg.preset,
                windowBucket: windowCfg.bucket,
                since: sinceIso,
                version: FUNNEL_CONTRACT_REGISTRY?.version || 'unknown',
                checks: [],
                criticalPathOk: true
            };
        }

        const placeholders = eventTypes.map(() => '?').join(',');
        const rows = await this.db.query(
            `SELECT event_type, bike_id, source_path, metadata
             FROM metric_events
             WHERE created_at >= ?
               AND event_type IN (${placeholders})`,
            [sinceIso, ...eventTypes]
        );

        const counters = new Map();
        for (const eventType of eventTypes) {
            const contract = contracts[eventType] || {};
            counters.set(eventType, {
                eventType,
                stage: String(contract.stage || 'unknown'),
                total: 0,
                valid: 0,
                missingGroups: new Map()
            });
        }

        for (const row of rows) {
            const eventType = String(row.event_type || '');
            if (!counters.has(eventType)) continue;
            const contract = contracts[eventType] || {};
            const requiredGroups = Array.isArray(contract.requiredGroups) ? contract.requiredGroups : [];
            const state = counters.get(eventType);
            state.total += 1;

            const source = {
                bikeId: Number(row.bike_id || 0) > 0 ? Number(row.bike_id) : null,
                sourcePath: row.source_path || null,
                metadata: this.safeParse(row.metadata, {})
            };
            const context = {
                sourcePath: row.source_path || null
            };

            let ok = true;
            requiredGroups.forEach((group, idx) => {
                const variants = Array.isArray(group) ? group : [];
                const pass = variants.some((path) => this.hasContractValue(source, context, path));
                if (!pass) {
                    ok = false;
                    state.missingGroups.set(idx, (state.missingGroups.get(idx) || 0) + 1);
                }
            });

            if (ok) state.valid += 1;
        }

        const checks = [...counters.values()].map((row) => {
            const coveragePct = row.total > 0 ? this.ratioPct(row.valid, row.total) : 0;
            let status = 'ok';
            if (row.total === 0) status = 'missing';
            else if (coveragePct < minCoveragePct) status = 'degraded';
            return {
                eventType: row.eventType,
                stage: row.stage,
                total: row.total,
                valid: row.valid,
                coveragePct,
                status,
                missingGroups: [...row.missingGroups.entries()].map(([index, count]) => ({ index, count }))
            };
        });

        const byType = new Map(checks.map((row) => [String(row.eventType), row]));
        const criticalPath = Array.isArray(FUNNEL_CONTRACT_REGISTRY?.criticalPath)
            ? FUNNEL_CONTRACT_REGISTRY.criticalPath
            : [];
        const criticalPathOk = criticalPath.every((eventType) => {
            const row = byType.get(String(eventType));
            return row && row.status === 'ok';
        });

        return {
            success: true,
            windowHours,
            windowPreset: windowCfg.preset,
            windowBucket: windowCfg.bucket,
            since: sinceIso,
            version: FUNNEL_CONTRACT_REGISTRY?.version || 'unknown',
            minCoveragePct,
            checks,
            criticalPath,
            criticalPathOk
        };
    }

    scoreChurnSession(row = {}) {
        const eventCount = Number(row.event_count || 0);
        const firstClicks = Number(row.first_clicks || 0);
        const pageViews = Number(row.page_views || 0);
        const productViews = Number(row.product_views || 0);
        const addToCart = Number(row.add_to_cart || 0);
        const checkoutAttempts = Number(row.checkout_submit_attempts || 0);
        const bookingSuccess = Number(row.booking_success || 0) + Number(row.orders || 0);
        const checkoutErrors = Number(row.checkout_submit_failed || 0) + Number(row.form_validation_errors || 0) + Number(row.checkout_validation_errors || 0);

        const first = new Date(String(row.first_seen_at || ''));
        const last = new Date(String(row.last_seen_at || ''));
        const durationSec = (!Number.isNaN(first.getTime()) && !Number.isNaN(last.getTime()))
            ? Math.max(0, (last.getTime() - first.getTime()) / 1000)
            : 0;

        let score = 0;
        const reasons = [];

        if (eventCount <= 1) {
            score += 35;
            reasons.push('single_event_session');
        }
        if (firstClicks <= 0 && pageViews > 0) {
            score += 15;
            reasons.push('no_first_click');
        }
        if (productViews > 0 && addToCart <= 0) {
            score += 18;
            reasons.push('product_no_atc');
        }
        if (checkoutAttempts > 0 && bookingSuccess <= 0) {
            score += 25;
            reasons.push('checkout_no_booking');
        }
        if (checkoutErrors >= 2) {
            score += 20;
            reasons.push('checkout_validation_friction');
        }
        if (durationSec < 45 && pageViews <= 1) {
            score += 15;
            reasons.push('low_engagement_duration');
        }

        score = Math.max(0, Math.min(100, score));
        let level = 'low';
        if (score >= 70) level = 'high';
        else if (score >= 40) level = 'medium';

        let action = 'personalized_recall';
        if (reasons.includes('checkout_validation_friction')) action = 'checkout_assist_offer';
        else if (reasons.includes('checkout_no_booking')) action = 'concierge_followup';
        else if (reasons.includes('product_no_atc')) action = 'price_value_nudge';

        return {
            score,
            level,
            reasons,
            action,
            durationSec: Math.round(durationSec * 100) / 100
        };
    }

    async buildChurnInsights(options = {}) {
        const windowCfg = this.resolveWindowConfig(options, 'daily');
        const windowHours = windowCfg.windowHours;
        const limit = Math.max(10, Math.min(500, Number(options.limit || 200)));
        const sinceIso = windowCfg.sinceIso;

        const rows = await this.db.query(
            `SELECT
                session_id,
                person_key,
                user_id,
                last_source_path,
                utm_source,
                event_count,
                page_views,
                first_clicks,
                product_views,
                add_to_cart,
                checkout_submit_attempts,
                checkout_submit_failed,
                checkout_validation_errors,
                form_validation_errors,
                booking_success,
                orders,
                first_seen_at,
                last_seen_at
             FROM metrics_session_facts
             WHERE last_seen_at >= ?
             ORDER BY last_seen_at DESC
             LIMIT ?`,
            [sinceIso, limit]
        );

        const summary = {
            totalEvaluated: rows.length,
            highRisk: 0,
            mediumRisk: 0,
            lowRisk: 0
        };
        const reasonCount = new Map();
        const actionCount = new Map();

        const scored = rows.map((row) => {
            const risk = this.scoreChurnSession(row);
            if (risk.level === 'high') summary.highRisk += 1;
            else if (risk.level === 'medium') summary.mediumRisk += 1;
            else summary.lowRisk += 1;

            for (const reason of risk.reasons) {
                reasonCount.set(reason, (reasonCount.get(reason) || 0) + 1);
            }
            actionCount.set(risk.action, (actionCount.get(risk.action) || 0) + 1);

            return {
                sessionId: row.session_id,
                personKey: row.person_key || null,
                userId: row.user_id || null,
                channel: row.utm_source || 'direct',
                lastSourcePath: row.last_source_path || null,
                riskScore: risk.score,
                riskLevel: risk.level,
                reasons: risk.reasons,
                recommendedAction: risk.action,
                sessionDurationSec: risk.durationSec
            };
        });

        scored.sort((a, b) => b.riskScore - a.riskScore);
        const topReasons = [...reasonCount.entries()]
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const suggestedActions = [...actionCount.entries()]
            .map(([action, sessions]) => ({ action, sessions }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 6);

        return {
            windowHours,
            windowPreset: windowCfg.preset,
            since: sinceIso,
            summary: {
                ...summary,
                highRiskPct: this.ratioPct(summary.highRisk, summary.totalEvaluated || 1),
                mediumRiskPct: this.ratioPct(summary.mediumRisk, summary.totalEvaluated || 1)
            },
            topReasons,
            suggestedActions,
            topAtRiskSessions: scored.slice(0, 20)
        };
    }

    async runReplaySimulation(options = {}) {
        const windowDays = Math.max(3, Math.min(60, Number(options.windowDays || 14)));
        const minAssignments = Math.max(20, Number(options.minAssignments || 80));
        const strategy = String(options.strategy || 'causal_best');
        const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

        const [exps, assignments, goals] = await Promise.all([
            this.db.query('SELECT experiment_key, name, variants_json, enabled, updated_at FROM ab_experiments WHERE enabled = 1'),
            this.db.query('SELECT experiment_key, variant, COUNT(*) as cnt FROM ab_assignments WHERE assigned_at >= ? GROUP BY experiment_key, variant', [sinceIso]),
            this.db.query('SELECT experiment_key, variant, metric_name, SUM(value) as val FROM ab_goal_events WHERE created_at >= ? GROUP BY experiment_key, variant, metric_name', [sinceIso])
        ]);

        const diagnostics = this.buildExperimentDiagnostics(exps, assignments, goals, minAssignments);
        const plans = [];

        for (const exp of diagnostics.list) {
            const variants = (Array.isArray(exp.variants) ? exp.variants : []).map((v) => ({
                name: String(v.variant || 'variant'),
                configuredWeight: Number(v.configuredWeight || 0),
                assignments: Number(v.assignments || 0),
                conversion: Number(v.conversion || 0),
                causalUpliftPct: Number(v.causalUpliftPct || 0),
                orderRate: Number(v.orderRate || 0)
            }));
            if (variants.length < 2) continue;
            const totalAssignments = variants.reduce((s, v) => s + v.assignments, 0);
            if (totalAssignments < minAssignments) continue;

            const rawCurrent = Object.fromEntries(variants.map((v) => [v.name, Math.max(1, v.configuredWeight || 1)]));
            const currentWeights = this.normalizeExperimentWeights(
                variants.map((v) => ({ name: v.name, weight: v.configuredWeight })),
                rawCurrent,
                { minWeight: 5, controlFloor: 22 }
            );

            let scenarioRaw = { ...rawCurrent };
            if (strategy === 'bandit_mean') {
                scenarioRaw = {};
                for (const v of variants) {
                    const successes = Math.max(0, Math.min(v.assignments, v.orderRate * v.assignments));
                    const alpha = 1 + successes;
                    const beta = 1 + Math.max(0, v.assignments - successes);
                    scenarioRaw[v.name] = alpha / (alpha + beta);
                }
            } else {
                const sorted = [...variants].sort((a, b) => b.causalUpliftPct - a.causalUpliftPct);
                const winner = sorted[0] || variants[0];
                scenarioRaw = Object.fromEntries(variants.map((v) => [v.name, v.name === winner.name ? 70 : 10]));
            }

            const scenarioWeights = this.normalizeExperimentWeights(
                variants.map((v) => ({ name: v.name, weight: v.configuredWeight })),
                scenarioRaw,
                { minWeight: 5, controlFloor: 22 }
            );

            const expectedCurrent = variants.reduce((sum, v) => {
                const w = Number(currentWeights[v.name] || 0) / 100;
                return sum + (w * v.conversion);
            }, 0);
            const expectedScenario = variants.reduce((sum, v) => {
                const w = Number(scenarioWeights[v.name] || 0) / 100;
                return sum + (w * v.conversion);
            }, 0);
            const upliftPct = expectedCurrent > 0
                ? ((expectedScenario - expectedCurrent) / expectedCurrent) * 100
                : 0;

            plans.push({
                experimentKey: exp.experimentKey,
                strategy,
                assignments: totalAssignments,
                expectedCurrent: Math.round(expectedCurrent * 100000) / 100000,
                expectedScenario: Math.round(expectedScenario * 100000) / 100000,
                upliftPct: Math.round(upliftPct * 100) / 100,
                currentWeights,
                scenarioWeights
            });
        }

        const weighted = plans.reduce((acc, row) => {
            acc.current += Number(row.expectedCurrent || 0) * Number(row.assignments || 0);
            acc.scenario += Number(row.expectedScenario || 0) * Number(row.assignments || 0);
            acc.assignments += Number(row.assignments || 0);
            return acc;
        }, { current: 0, scenario: 0, assignments: 0 });
        const weightedUpliftPct = weighted.current > 0
            ? ((weighted.scenario - weighted.current) / weighted.current) * 100
            : 0;

        return {
            success: true,
            strategy,
            windowDays,
            minAssignments,
            experiments: plans.sort((a, b) => b.upliftPct - a.upliftPct),
            portfolio: {
                experiments: plans.length,
                assignments: weighted.assignments,
                expectedCurrent: Math.round(weighted.current * 1000) / 1000,
                expectedScenario: Math.round(weighted.scenario * 1000) / 1000,
                weightedUpliftPct: Math.round(weightedUpliftPct * 100) / 100
            }
        };
    }

    async getCoreOverview(options = {}) {
        const windowCfg = this.resolveWindowConfig(options, 'daily');
        const windowHours = windowCfg.windowHours;
        const windowDays = windowCfg.windowDays;
        const sinceIso = windowCfg.sinceIso;
        const since5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const trendBucketSql = this.trendBucketSql(windowCfg.bucket, 'created_at');

        const [
            eventsTotalRows,
            events5mRows,
            logsErrRows,
            lastEventRows,
            funnelRows,
            sessionsRows,
            firstClickRows,
            firstActionLatencyRows,
            sessionDurationRows,
            singleEventSessionsRows,
            catalogSessionRows,
            productSessionRows,
            atcSessionRows,
            bookingStartSessionRows,
            bookingSuccessSessionRows,
            sourceRows,
            topBikeRows,
            profilesRows,
            insightsRows,
            avgIntentRows,
            profileUpdatedRows,
            expRows,
            assignmentRows,
            goalRows,
            autoOptRows,
            topEventsRows,
            topRefRows,
            trendRows,
            topAcqRows,
            topCampaignRows,
            attributionCoverageRows
        ] = await Promise.all([
            this.db.query('SELECT COUNT(*) as c FROM metric_events WHERE created_at >= ?', [sinceIso]),
            this.db.query('SELECT COUNT(*) as c FROM metric_events WHERE created_at >= ?', [since5m]),
            this.db.query('SELECT COUNT(*) as c FROM system_logs WHERE created_at >= ? AND source IN ("metrics_ingest", "metrics_search", "metrics_insights", "metrics_auto_optimize")', [sinceIso]),
            this.db.query('SELECT created_at FROM metric_events ORDER BY id DESC LIMIT 1'),
            this.db.query(
                `SELECT
                    SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) as impressions,
                    SUM(CASE WHEN event_type = 'detail_open' THEN 1 ELSE 0 END) as detail_open,
                    SUM(CASE WHEN event_type = 'favorite' THEN 1 ELSE 0 END) as favorite,
                    SUM(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) as add_to_cart,
                    SUM(CASE WHEN event_type = 'order' THEN 1 ELSE 0 END) as ord
                 FROM metric_events
                 WHERE created_at >= ?`,
                [sinceIso]
            ),
            this.db.query('SELECT COUNT(DISTINCT session_id) as c FROM metric_events WHERE created_at >= ? AND session_id IS NOT NULL', [sinceIso]),
            this.db.query('SELECT COUNT(DISTINCT session_id) as c FROM metric_events WHERE created_at >= ? AND session_id IS NOT NULL AND event_type = "first_click"', [sinceIso]),
            this.db.query(
                `WITH starts AS (
                    SELECT session_id, MIN(created_at) as start_at
                    FROM metric_events
                    WHERE created_at >= ? AND session_id IS NOT NULL
                    GROUP BY session_id
                ),
                actions AS (
                    SELECT session_id, MIN(created_at) as action_at
                    FROM metric_events
                    WHERE created_at >= ? AND session_id IS NOT NULL
                      AND event_type IN ('first_click','detail_open','add_to_cart','favorite','booking_start','booking_success','order')
                    GROUP BY session_id
                )
                SELECT AVG((julianday(actions.action_at) - julianday(starts.start_at)) * 86400.0) as avg_sec
                FROM starts
                JOIN actions ON actions.session_id = starts.session_id`,
                [sinceIso, sinceIso]
            ),
            this.db.query(
                `SELECT AVG((julianday(last_at) - julianday(first_at)) * 86400.0) as avg_sec
                 FROM (
                    SELECT session_id, MIN(created_at) as first_at, MAX(created_at) as last_at
                    FROM metric_events
                    WHERE created_at >= ? AND session_id IS NOT NULL
                    GROUP BY session_id
                 )`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT COUNT(*) as c
                 FROM (
                    SELECT session_id, COUNT(*) as event_count
                    FROM metric_events
                    WHERE created_at >= ? AND session_id IS NOT NULL
                    GROUP BY session_id
                    HAVING event_count = 1
                 )`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT COUNT(DISTINCT session_id) as c
                 FROM metric_events
                 WHERE created_at >= ? AND session_id IS NOT NULL
                   AND (event_type = 'catalog_view' OR source_path LIKE '/catalog%')`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT COUNT(DISTINCT session_id) as c
                 FROM metric_events
                 WHERE created_at >= ? AND session_id IS NOT NULL
                   AND event_type IN ('product_view','detail_open')`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT COUNT(DISTINCT session_id) as c
                 FROM metric_events
                 WHERE created_at >= ? AND session_id IS NOT NULL
                   AND event_type = 'add_to_cart'`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT COUNT(DISTINCT session_id) as c
                 FROM metric_events
                 WHERE created_at >= ? AND session_id IS NOT NULL
                   AND event_type IN ('checkout_start','booking_start')`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT COUNT(DISTINCT session_id) as c
                 FROM metric_events
                 WHERE created_at >= ? AND session_id IS NOT NULL
                   AND event_type IN ('booking_success','order')`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT source_path, COUNT(*) as events
                 FROM metric_events
                 WHERE created_at >= ?
                 GROUP BY source_path
                 ORDER BY events DESC
                 LIMIT 12`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT b.id, b.brand, b.model,
                        SUM(CASE WHEN me.event_type = 'detail_open' THEN 1 ELSE 0 END) as detail_open,
                        SUM(CASE WHEN me.event_type = 'add_to_cart' THEN 1 ELSE 0 END) as add_to_cart,
                        SUM(CASE WHEN me.event_type = 'order' THEN 1 ELSE 0 END) as ord
                 FROM metric_events me
                 JOIN bikes b ON b.id = me.bike_id
                 WHERE me.created_at >= ?
                 GROUP BY b.id
                 ORDER BY (SUM(CASE WHEN me.event_type = 'order' THEN 1 ELSE 0 END) * 5 + SUM(CASE WHEN me.event_type = 'add_to_cart' THEN 1 ELSE 0 END) * 2 + SUM(CASE WHEN me.event_type = 'detail_open' THEN 1 ELSE 0 END)) DESC
                 LIMIT 10`,
                [sinceIso]
            ),
            this.db.query('SELECT profile_key, disciplines_json, brands_json, weighted_price, intent_score, updated_at FROM user_interest_profiles ORDER BY intent_score DESC LIMIT 400'),
            this.db.query('SELECT COUNT(*) as c FROM user_interest_profiles WHERE insight_text IS NOT NULL AND TRIM(insight_text) <> ""'),
            this.db.query('SELECT AVG(intent_score) as avg_intent FROM user_interest_profiles'),
            this.db.query('SELECT COUNT(*) as c FROM user_interest_profiles WHERE updated_at >= ?', [sinceIso]),
            this.db.query('SELECT experiment_key, name, variants_json, enabled, updated_at FROM ab_experiments WHERE enabled = 1 ORDER BY experiment_key'),
            this.db.query('SELECT experiment_key, variant, COUNT(*) as cnt FROM ab_assignments GROUP BY experiment_key, variant'),
            this.db.query('SELECT experiment_key, variant, metric_name, SUM(value) as val FROM ab_goal_events WHERE created_at >= ? GROUP BY experiment_key, variant, metric_name', [sinceIso]),
            this.db.query("SELECT key, value, updated_at FROM system_settings WHERE key IN ('metrics_auto_optimize_last_run', 'metrics_auto_optimize_last_result')"),
            this.db.query('SELECT event_type, COUNT(*) as events FROM metric_events WHERE created_at >= ? GROUP BY event_type ORDER BY events DESC LIMIT 20', [sinceIso]),
            this.db.query('SELECT referrer, COUNT(*) as events FROM metric_events WHERE created_at >= ? AND referrer IS NOT NULL AND referrer <> "" GROUP BY referrer ORDER BY events DESC LIMIT 10', [sinceIso]),
            this.db.query(
                `SELECT ${trendBucketSql} as bucket,
                        SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) as impressions,
                        SUM(CASE WHEN event_type = 'detail_open' THEN 1 ELSE 0 END) as detail_open,
                        SUM(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) as add_to_cart,
                        SUM(CASE WHEN event_type = 'order' THEN 1 ELSE 0 END) as ord
                 FROM metric_events
                 WHERE created_at >= ?
                 GROUP BY bucket
                 ORDER BY bucket ASC`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    COALESCE(
                        NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.utm_source') ELSE NULL END, ''),
                        NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.attribution.utm_source') ELSE NULL END, ''),
                        'direct'
                    ) as source,
                    COALESCE(
                        NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.utm_medium') ELSE NULL END, ''),
                        NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.attribution.utm_medium') ELSE NULL END, ''),
                        'none'
                    ) as medium,
                    COUNT(*) as events,
                    COUNT(DISTINCT session_id) as sessions
                 FROM metric_events
                 WHERE created_at >= ?
                 GROUP BY source, medium
                 ORDER BY sessions DESC, events DESC
                 LIMIT 12`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    COALESCE(
                        NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.utm_campaign') ELSE NULL END, ''),
                        NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.attribution.utm_campaign') ELSE NULL END, ''),
                        'none'
                    ) as campaign,
                    COUNT(*) as events,
                    COUNT(DISTINCT session_id) as sessions
                 FROM metric_events
                 WHERE created_at >= ?
                 GROUP BY campaign
                 ORDER BY sessions DESC, events DESC
                 LIMIT 10`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT COUNT(DISTINCT session_id) as c
                 FROM metric_events
                 WHERE created_at >= ?
                   AND session_id IS NOT NULL
                   AND (
                        COALESCE(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.utm_source') ELSE '' END, '') <> ''
                        OR COALESCE(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.attribution.utm_source') ELSE '' END, '') <> ''
                   )`,
                [sinceIso]
            )
        ]);

        const eventsTotal = Number(eventsTotalRows[0]?.c || 0);
        const events5m = Number(events5mRows[0]?.c || 0);
        const errorCount = Number(logsErrRows[0]?.c || 0);
        const ingestionRatePerMinute = Math.round((eventsTotal / (windowHours * 60)) * 100) / 100;
        const errorRatePct = eventsTotal > 0 ? Math.round((errorCount / eventsTotal) * 10000) / 100 : 0;

        const funnel = {
            impressions: Number(funnelRows[0]?.impressions || 0),
            detail_open: Number(funnelRows[0]?.detail_open || 0),
            favorite: Number(funnelRows[0]?.favorite || 0),
            add_to_cart: Number(funnelRows[0]?.add_to_cart || 0),
            order: Number(funnelRows[0]?.ord || 0)
        };

        const ctrPct = funnel.impressions > 0 ? (funnel.detail_open / funnel.impressions) * 100 : 0;
        const atcPct = funnel.detail_open > 0 ? (funnel.add_to_cart / funnel.detail_open) * 100 : 0;
        const orderPct = funnel.add_to_cart > 0 ? (funnel.order / funnel.add_to_cart) * 100 : 0;

        const sessions = Number(sessionsRows[0]?.c || 0);
        const sessionsWithFirstClick = Number(firstClickRows[0]?.c || 0);
        const sessionsCatalog = Number(catalogSessionRows[0]?.c || 0);
        const sessionsProduct = Number(productSessionRows[0]?.c || 0);
        const sessionsAtc = Number(atcSessionRows[0]?.c || 0);
        const sessionsBookingStart = Number(bookingStartSessionRows[0]?.c || 0);
        const sessionsBookingSuccess = Number(bookingSuccessSessionRows[0]?.c || 0);
        const oneEventSessions = Number(singleEventSessionsRows[0]?.c || 0);
        const avgTimeToFirstActionSec = Math.max(0, Number(firstActionLatencyRows[0]?.avg_sec || 0));
        const avgSessionDurationSec = Math.max(0, Number(sessionDurationRows[0]?.avg_sec || 0));

        const journey = {
            sessions,
            sessionsWithFirstClick,
            sessionsCatalog,
            sessionsProduct,
            sessionsAtc,
            sessionsBookingStart,
            sessionsBookingSuccess,
            firstClickRatePct: this.ratioPct(sessionsWithFirstClick, sessions),
            catalogReachPct: this.ratioPct(sessionsCatalog, sessions),
            productReachPct: this.ratioPct(sessionsProduct, sessionsCatalog || sessions),
            atcReachPct: this.ratioPct(sessionsAtc, sessionsProduct || sessions),
            bookingStartReachPct: this.ratioPct(sessionsBookingStart, sessionsAtc || sessionsProduct || sessions),
            bookingSuccessReachPct: this.ratioPct(sessionsBookingSuccess, sessionsBookingStart || sessionsAtc || sessions),
            bounceRatePct: this.ratioPct(oneEventSessions, sessions),
            avgTimeToFirstActionSec: Math.round(avgTimeToFirstActionSec * 100) / 100,
            avgSessionDurationSec: Math.round(avgSessionDurationSec * 100) / 100
        };

        const sessionsWithAttribution = Number(attributionCoverageRows[0]?.c || 0);
        const acquisition = {
            sessionsWithAttribution,
            coveragePct: this.ratioPct(sessionsWithAttribution, sessions),
            topChannels: topAcqRows.map((r) => ({
                source: String(r.source || 'direct'),
                medium: String(r.medium || 'none'),
                events: Number(r.events || 0),
                sessions: Number(r.sessions || 0)
            })),
            topCampaigns: topCampaignRows.map((r) => ({
                campaign: String(r.campaign || 'none'),
                events: Number(r.events || 0),
                sessions: Number(r.sessions || 0)
            }))
        };

        const [behaviorRows, topFavoriteBikeRows, topBookedBikeRows] = await Promise.all([
            this.db.query(
                `SELECT session_id, event_type, source_path, metadata, bike_id, dwell_ms, created_at
                 FROM metric_events
                 WHERE created_at >= ?
                   AND session_id IS NOT NULL
                   AND event_type IN (
                     'session_start','page_view',
                     'catalog_view','product_view','impression','first_click','ui_click',
                     'detail_open','add_to_cart','favorite','dwell','scroll_stop','hover',
                     'checkout_start','checkout_step','checkout_submit_attempt','checkout_submit_success','checkout_submit_failed','checkout_abandon',
                     'booking_start','booking_success','order'
                   )
                 ORDER BY session_id ASC, created_at ASC, id ASC`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT me.bike_id as id, b.brand, b.model, COUNT(*) as favorites
                 FROM metric_events me
                 LEFT JOIN bikes b ON b.id = me.bike_id
                 WHERE me.created_at >= ?
                   AND me.event_type = 'favorite'
                   AND me.bike_id IS NOT NULL
                 GROUP BY me.bike_id
                 ORDER BY favorites DESC
                 LIMIT 12`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT me.bike_id as id, b.brand, b.model,
                        SUM(CASE WHEN me.event_type = 'booking_success' THEN 1 ELSE 0 END) as bookings,
                        SUM(CASE WHEN me.event_type = 'order' THEN 1 ELSE 0 END) as orders
                 FROM metric_events me
                 LEFT JOIN bikes b ON b.id = me.bike_id
                 WHERE me.created_at >= ?
                   AND me.event_type IN ('booking_success','order')
                   AND me.bike_id IS NOT NULL
                 GROUP BY me.bike_id
                 ORDER BY orders DESC, bookings DESC
                 LIMIT 12`,
                [sinceIso]
            )
        ]);

        const behaviorOverview = this.buildBehaviorOverview(behaviorRows, { sessions });
        const behavior = {
            ...behaviorOverview,
            topFavoriteBikes: topFavoriteBikeRows.map((row) => ({
                id: Number(row.id || 0),
                brand: row.brand || null,
                model: row.model || null,
                favorites: Number(row.favorites || 0)
            })),
            topBookedBikes: topBookedBikeRows.map((row) => ({
                id: Number(row.id || 0),
                brand: row.brand || null,
                model: row.model || null,
                bookings: Number(row.bookings || 0),
                orders: Number(row.orders || 0)
            }))
        };

        const lossPoints = [
            {
                stageFrom: 'sessions',
                stageTo: 'catalog',
                from: sessions,
                to: sessionsCatalog,
                conversionPct: this.ratioPct(sessionsCatalog, sessions),
                lossPct: 100 - this.ratioPct(sessionsCatalog, sessions)
            },
            {
                stageFrom: 'catalog',
                stageTo: 'product',
                from: sessionsCatalog,
                to: sessionsProduct,
                conversionPct: this.ratioPct(sessionsProduct, sessionsCatalog || sessions),
                lossPct: 100 - this.ratioPct(sessionsProduct, sessionsCatalog || sessions)
            },
            {
                stageFrom: 'product',
                stageTo: 'add_to_cart',
                from: sessionsProduct,
                to: sessionsAtc,
                conversionPct: this.ratioPct(sessionsAtc, sessionsProduct || sessions),
                lossPct: 100 - this.ratioPct(sessionsAtc, sessionsProduct || sessions)
            },
            {
                stageFrom: 'add_to_cart',
                stageTo: 'booking_success',
                from: sessionsAtc,
                to: sessionsBookingSuccess,
                conversionPct: this.ratioPct(sessionsBookingSuccess, sessionsAtc || sessions),
                lossPct: 100 - this.ratioPct(sessionsBookingSuccess, sessionsAtc || sessions)
            }
        ].map((row) => ({
            ...row,
            conversionPct: Math.max(0, Math.min(100, Math.round(row.conversionPct * 100) / 100)),
            lossPct: Math.max(0, Math.min(100, Math.round(row.lossPct * 100) / 100))
        }));

        const disciplineScores = [];
        const brandScores = [];
        const topProfiles = [];

        for (const row of profilesRows) {
            const disciplines = this.safeParse(row.disciplines_json, {});
            const brands = this.safeParse(row.brands_json, {});

            for (const [key, value] of Object.entries(disciplines)) {
                disciplineScores.push({ key, score: Number(value) || 0 });
            }
            for (const [key, value] of Object.entries(brands)) {
                brandScores.push({ key, score: Number(value) || 0 });
            }

            topProfiles.push({
                profile_key: row.profile_key,
                weighted_price: Number(row.weighted_price || 0),
                intent_score: Number(row.intent_score || 0),
                top_discipline: Object.entries(disciplines).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || null,
                top_brand: Object.entries(brands).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || null,
                updated_at: row.updated_at
            });
        }

        const experimentSummary = this.buildExperimentDiagnostics(expRows, assignmentRows, goalRows, 40);
        const [assignmentDetailRows, goalDetailRows, sessionSignalRows, featureSignalRows] = await Promise.all([
            this.db.query(
                `SELECT experiment_key, variant, subject_key, user_id, session_id, assigned_at
                 FROM ab_assignments
                 WHERE assigned_at >= ?`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    experiment_key,
                    variant,
                    user_id,
                    session_id,
                    metric_name,
                    SUM(value) as val
                 FROM ab_goal_events
                 WHERE created_at >= ?
                 GROUP BY experiment_key, variant, user_id, session_id, metric_name`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT session_id, utm_source, landing_path, first_source_path
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT user_id, budget_cluster
                 FROM metrics_feature_store
                 WHERE user_id IS NOT NULL`
            )
        ]);
        const segmentedInsights = this.buildSegmentedCausalInsights(
            expRows,
            assignmentDetailRows,
            goalDetailRows,
            sessionSignalRows,
            featureSignalRows,
            { minSegmentAssignments: 18 }
        );
        const segmentByExperiment = new Map(segmentedInsights.map((row) => [String(row.experimentKey), row]));
        const experimentStats = experimentSummary.list.map((exp) => {
            const segmented = segmentByExperiment.get(String(exp.experimentKey));
            return {
                ...exp,
                causalModel: {
                    ...(exp.causalModel || {}),
                    segmentedType: segmented?.model || 'dr_lite_segmented'
                },
                causalSegments: Array.isArray(segmented?.segments) ? segmented.segments : []
            };
        });

        const autoOpt = {};
        for (const row of autoOptRows) {
            autoOpt[String(row.key)] = { value: row.value, updatedAt: row.updated_at };
        }

        const [
            webVitalRows,
            apiLatencyRows,
            anomalyRows,
            sessionFactRows,
            identityRows,
            featureStoreRows,
            checkoutFieldRows,
            checkoutStageRows
        ] = await Promise.all([
            this.db.query(
                `SELECT metadata, created_at
                 FROM metric_events
                 WHERE created_at >= ?
                   AND event_type = 'web_vital'
                   AND metadata IS NOT NULL`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT metadata, created_at
                 FROM metric_events
                 WHERE created_at >= ?
                   AND event_type = 'api_latency'
                   AND metadata IS NOT NULL`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT anomaly_key, severity, metric_name, baseline_value, current_value, delta_pct, details, created_at
                 FROM metrics_anomalies
                 WHERE created_at >= ?
                 ORDER BY created_at DESC
                 LIMIT 20`,
                [new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()]
            ),
            this.db.query(
                `SELECT
                    COUNT(*) as sessions,
                    SUM(CASE WHEN checkout_submit_attempts > 0 THEN 1 ELSE 0 END) as sessions_checkout_attempt,
                    SUM(CASE WHEN booking_success > 0 OR orders > 0 THEN 1 ELSE 0 END) as sessions_booking_success,
                    AVG((julianday(last_seen_at) - julianday(first_seen_at)) * 86400.0) as avg_session_sec
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    COUNT(DISTINCT person_key) as persons,
                    SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as linked_user_nodes,
                    SUM(CASE WHEN crm_lead_id IS NOT NULL THEN 1 ELSE 0 END) as linked_lead_nodes
                 FROM metrics_identity_nodes`
            ),
            this.db.query(
                `SELECT
                    budget_cluster,
                    COUNT(*) as profiles
                 FROM metrics_feature_store
                 GROUP BY budget_cluster
                 ORDER BY profiles DESC`
            ),
            this.db.query(
                `SELECT
                    COALESCE(NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.field') END, ''), 'unknown') as field_name,
                    COUNT(*) as errors,
                    COUNT(DISTINCT session_id) as sessions
                 FROM metric_events
                 WHERE created_at >= ?
                   AND event_type IN ('form_validation_error','checkout_validation_error','checkout_field_error')
                 GROUP BY field_name
                 ORDER BY errors DESC
                 LIMIT 12`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    COALESCE(NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.stage') END, ''), 'unknown') as stage,
                    SUM(CASE WHEN event_type IN ('form_seen','checkout_step') THEN 1 ELSE 0 END) as seen_events,
                    SUM(CASE WHEN event_type IN ('form_submit_attempt','checkout_submit_attempt') THEN 1 ELSE 0 END) as submit_attempts,
                    SUM(CASE WHEN event_type IN ('checkout_submit_success','booking_success','order') THEN 1 ELSE 0 END) as success_events,
                    SUM(CASE WHEN event_type IN ('form_validation_error','checkout_validation_error','checkout_field_error','checkout_submit_failed','checkout_abandon') THEN 1 ELSE 0 END) as error_events
                 FROM metric_events
                 WHERE created_at >= ?
                   AND event_type IN (
                       'form_seen','checkout_step',
                       'form_submit_attempt','checkout_submit_attempt',
                       'checkout_submit_success','booking_success','order',
                       'form_validation_error','checkout_validation_error','checkout_field_error','checkout_submit_failed','checkout_abandon'
                   )
                 GROUP BY stage
                 ORDER BY submit_attempts DESC, seen_events DESC`,
                [sinceIso]
            )
        ]);

        const webVitalBuckets = {
            LCP: [],
            CLS: [],
            INP: [],
            FCP: [],
            TTFB: []
        };
        const webVitalByStage = new Map();
        for (const row of webVitalRows) {
            const meta = this.safeParse(row.metadata, {});
            const name = String(meta.name || meta.metric || '').toUpperCase();
            const value = Number(meta.value);
            if (!Number.isFinite(value)) continue;
            if (name in webVitalBuckets) {
                webVitalBuckets[name].push(value);
            }
            const stage = this.classifyStage(meta, String(meta.path || ''), 'web_vital');
            const stageBucket = webVitalByStage.get(stage) || {
                LCP: [],
                CLS: [],
                INP: [],
                FCP: [],
                TTFB: []
            };
            if (name in stageBucket) stageBucket[name].push(value);
            webVitalByStage.set(stage, stageBucket);
        }

        const webVitals = {
            lcpP75: Math.round(this.percentile(webVitalBuckets.LCP, 0.75)),
            clsP75: Math.round(this.percentile(webVitalBuckets.CLS, 0.75) * 1000) / 1000,
            inpP75: Math.round(this.percentile(webVitalBuckets.INP, 0.75)),
            fcpP75: Math.round(this.percentile(webVitalBuckets.FCP, 0.75)),
            ttfbP75: Math.round(this.percentile(webVitalBuckets.TTFB, 0.75)),
            samples: webVitalRows.length
        };

        const latencyByEndpoint = new Map();
        const latencyByStage = new Map();
        const latencyValues = [];
        let latencyErrors = 0;
        for (const row of apiLatencyRows) {
            const meta = this.safeParse(row.metadata, {});
            const duration = Number(meta.duration_ms || meta.durationMs || meta.ms);
            if (!Number.isFinite(duration) || duration < 0) continue;

            latencyValues.push(duration);
            const method = String(meta.method || 'GET').toUpperCase();
            const path = String(meta.path || 'unknown');
            const status = Number(meta.status || 0);
            const key = `${method} ${path}`;
            const current = latencyByEndpoint.get(key) || { count: 0, sum: 0, values: [], errors: 0 };
            current.count += 1;
            current.sum += duration;
            current.values.push(duration);
            if ((Number.isFinite(status) && status >= 500) || Number(meta.network_error || 0) === 1) {
                current.errors += 1;
                latencyErrors += 1;
            }
            latencyByEndpoint.set(key, current);

            const stage = this.classifyStage(meta, String(meta.path || path), 'api_latency');
            const perStage = latencyByStage.get(stage) || { values: [], errors: 0, count: 0 };
            perStage.values.push(duration);
            perStage.count += 1;
            if ((Number.isFinite(status) && status >= 500) || Number(meta.network_error || 0) === 1) {
                perStage.errors += 1;
            }
            latencyByStage.set(stage, perStage);
        }

        const stageBreakdown = {};
        for (const [stage, buckets] of webVitalByStage.entries()) {
            const latencyStats = latencyByStage.get(stage) || { values: [], errors: 0, count: 0 };
            stageBreakdown[stage] = {
                webVitals: {
                    lcpP75: Math.round(this.percentile(buckets.LCP, 0.75)),
                    clsP75: Math.round(this.percentile(buckets.CLS, 0.75) * 1000) / 1000,
                    inpP75: Math.round(this.percentile(buckets.INP, 0.75)),
                    fcpP75: Math.round(this.percentile(buckets.FCP, 0.75)),
                    ttfbP75: Math.round(this.percentile(buckets.TTFB, 0.75)),
                    samples: buckets.LCP.length + buckets.CLS.length + buckets.INP.length + buckets.FCP.length + buckets.TTFB.length
                },
                apiLatency: {
                    p75Ms: Math.round(this.percentile(latencyStats.values, 0.75)),
                    p95Ms: Math.round(this.percentile(latencyStats.values, 0.95)),
                    errorRatePct: this.ratioPct(latencyStats.errors, latencyStats.count),
                    samples: latencyStats.count
                }
            };
        }
        for (const [stage, latencyStats] of latencyByStage.entries()) {
            if (stageBreakdown[stage]) continue;
            stageBreakdown[stage] = {
                webVitals: {
                    lcpP75: 0,
                    clsP75: 0,
                    inpP75: 0,
                    fcpP75: 0,
                    ttfbP75: 0,
                    samples: 0
                },
                apiLatency: {
                    p75Ms: Math.round(this.percentile(latencyStats.values, 0.75)),
                    p95Ms: Math.round(this.percentile(latencyStats.values, 0.95)),
                    errorRatePct: this.ratioPct(latencyStats.errors, latencyStats.count),
                    samples: latencyStats.count
                }
            };
        }

        const apiLatency = {
            p95Ms: Math.round(this.percentile(latencyValues, 0.95)),
            avgMs: latencyValues.length > 0 ? Math.round((latencyValues.reduce((s, v) => s + v, 0) / latencyValues.length) * 100) / 100 : 0,
            errorRatePct: this.ratioPct(latencyErrors, latencyValues.length),
            samples: latencyValues.length,
            stageBreakdown,
            topSlowEndpoints: [...latencyByEndpoint.entries()]
                .map(([endpoint, stats]) => ({
                    endpoint,
                    avgMs: Math.round((stats.sum / Math.max(1, stats.count)) * 100) / 100,
                    p95Ms: Math.round(this.percentile(stats.values, 0.95)),
                    count: stats.count,
                    errorRatePct: this.ratioPct(stats.errors, stats.count)
                }))
                .sort((a, b) => b.p95Ms - a.p95Ms)
                .slice(0, 12)
        };

        const sessionFactSummary = {
            sessions: Number(sessionFactRows[0]?.sessions || 0),
            sessionsCheckoutAttempt: Number(sessionFactRows[0]?.sessions_checkout_attempt || 0),
            sessionsBookingSuccess: Number(sessionFactRows[0]?.sessions_booking_success || 0),
            avgSessionDurationSec: Math.max(0, Math.round(Number(sessionFactRows[0]?.avg_session_sec || 0) * 100) / 100),
            checkoutAttemptRatePct: this.ratioPct(Number(sessionFactRows[0]?.sessions_checkout_attempt || 0), Number(sessionFactRows[0]?.sessions || 0)),
            bookingSuccessRatePct: this.ratioPct(Number(sessionFactRows[0]?.sessions_booking_success || 0), Number(sessionFactRows[0]?.sessions_checkout_attempt || 0) || Number(sessionFactRows[0]?.sessions || 0))
        };

        const identitySummary = {
            persons: Number(identityRows[0]?.persons || 0),
            linkedUserNodes: Number(identityRows[0]?.linked_user_nodes || 0),
            linkedLeadNodes: Number(identityRows[0]?.linked_lead_nodes || 0)
        };

        const featureStoreSummary = {
            totalProfiles: featureStoreRows.reduce((sum, row) => sum + Number(row.profiles || 0), 0),
            byBudgetCluster: featureStoreRows.map((row) => ({
                budgetCluster: String(row.budget_cluster || 'unknown'),
                profiles: Number(row.profiles || 0)
            }))
        };

        const checkoutTelemetry = {
            topErrorFields: checkoutFieldRows.map((row) => ({
                field: String(row.field_name || 'unknown'),
                errors: Number(row.errors || 0),
                sessions: Number(row.sessions || 0)
            })),
            stageLoss: checkoutStageRows.map((row) => {
                const stage = String(row.stage || 'unknown');
                const seen = Number(row.seen_events || 0);
                const attempts = Number(row.submit_attempts || 0);
                const success = Number(row.success_events || 0);
                const errors = Number(row.error_events || 0);
                const lossPct = attempts > 0 ? Math.max(0, Math.min(100, 100 - ((success / attempts) * 100))) : 0;
                return {
                    stage,
                    seenEvents: seen,
                    submitAttempts: attempts,
                    successEvents: success,
                    errorEvents: errors,
                    lossPct: Math.round(lossPct * 100) / 100
                };
            })
        };

        const [guardrails, funnelContract, churn] = await Promise.all([
            this.computeGuardrailMetrics(windowDays),
            this.checkFunnelContract({ windowPreset: windowCfg.preset, windowHours, minCoveragePct: 90 }),
            this.buildChurnInsights({ windowPreset: windowCfg.preset, windowHours, limit: 240 })
        ]);

        const anomalies = anomalyRows.map((row) => ({
            anomalyKey: String(row.anomaly_key || 'unknown'),
            severity: String(row.severity || 'info'),
            metricName: String(row.metric_name || 'metric'),
            baselineValue: Number(row.baseline_value || 0),
            currentValue: Number(row.current_value || 0),
            deltaPct: Number(row.delta_pct || 0),
            details: this.safeParse(row.details, {}),
            createdAt: row.created_at
        }));
        const severeAnomalies = anomalies.filter((row) => row.severity === 'critical' || row.severity === 'warning').length;

        const gemini = getGeminiKeyHealth();
        const nowIso = new Date().toISOString();
        const lastEventAt = lastEventRows[0]?.created_at || null;
        const trends = trendRows.map((r) => ({
            bucket: r.bucket,
            impressions: Number(r.impressions || 0),
            detail_open: Number(r.detail_open || 0),
            add_to_cart: Number(r.add_to_cart || 0),
            order: Number(r.ord || 0)
        }));
        const trendMeta = this.buildOverallTrend(trends, ['detail_open', 'add_to_cart', 'order']);

        const moduleStatus = {
            ingest: {
                status: events5m > 0 ? 'ok' : 'degraded',
                eventsLast5m: events5m,
                eventsTotal,
                sessions,
                sessionsWithAttribution,
                attributionCoveragePct: acquisition.coveragePct,
                ratePerMinute: ingestionRatePerMinute,
                errorRatePct
            },
            profiling: {
                status: Number(profileUpdatedRows[0]?.c || 0) > 0 ? 'ok' : 'degraded',
                profilesTotal: profilesRows.length,
                profilesUpdatedWindow: Number(profileUpdatedRows[0]?.c || 0),
                profilesWithInsight: Number(insightsRows[0]?.c || 0),
                avgIntent: Math.round(Number(avgIntentRows[0]?.avg_intent || 0) * 100) / 100
            },
            experiments: {
                status: experimentStats.length > 0 ? 'ok' : 'idle',
                activeExperiments: experimentStats.length,
                totalAssignments: assignmentRows.reduce((s, r) => s + Number(r.cnt || 0), 0),
                goalsWindow: goalRows.reduce((s, r) => s + Number(r.val || 0), 0),
                srmAlerts: experimentStats.filter((exp) => Boolean(exp?.srm?.detected)).length,
                aaSuspicious: experimentStats.filter((exp) => Boolean(exp?.aa?.suspicious)).length
            },
            personalization: {
                status: profilesRows.length > 0 ? 'ok' : 'warming_up',
                topProfileIntent: topProfiles[0]?.intent_score || 0,
                lastEventAt
            },
            identity: {
                status: identitySummary.persons > 0 ? 'ok' : 'warming_up',
                persons: identitySummary.persons,
                linkedUserNodes: identitySummary.linkedUserNodes,
                linkedLeadNodes: identitySummary.linkedLeadNodes
            },
            featureStore: {
                status: featureStoreSummary.totalProfiles > 0 ? 'ok' : 'warming_up',
                profiles: featureStoreSummary.totalProfiles,
                topBudgetCluster: featureStoreSummary.byBudgetCluster[0]?.budgetCluster || 'unknown'
            },
            performance: {
                status: guardrails.degraded ? 'degraded' : (apiLatency.samples > 0 || webVitals.samples > 0 ? 'ok' : 'degraded'),
                apiP95Ms: apiLatency.p95Ms,
                apiErrorRatePct: apiLatency.errorRatePct,
                webVitalSamples: webVitals.samples,
                guardrailDegraded: guardrails.degraded
            },
            anomalyDetection: {
                status: severeAnomalies > 0 ? 'degraded' : 'ok',
                activeAlerts: severeAnomalies
            },
            contract: {
                status: funnelContract?.criticalPathOk ? 'ok' : 'degraded',
                criticalPathOk: Boolean(funnelContract?.criticalPathOk),
                missingEvents: (funnelContract?.checks || []).filter((row) => String(row.status) === 'missing').length,
                degradedEvents: (funnelContract?.checks || []).filter((row) => String(row.status) === 'degraded').length
            },
            churn: {
                status: Number(churn?.summary?.highRiskPct || 0) >= 35 ? 'degraded' : 'ok',
                highRiskPct: Number(churn?.summary?.highRiskPct || 0),
                highRiskSessions: Number(churn?.summary?.highRisk || 0),
                topAction: churn?.suggestedActions?.[0]?.action || 'none'
            },
            gemini: {
                status: gemini.hasAny ? 'ok' : 'missing_keys',
                keyCount: gemini.keyCount,
                source: gemini.source
            }
        };

        return {
            success: true,
            window: {
                hours: windowHours,
                days: windowDays,
                preset: windowCfg.preset,
                bucket: windowCfg.bucket,
                isAllTime: windowCfg.isAllTime,
                since: sinceIso,
                now: nowIso
            },
            health: {
                lastEventAt,
                eventsTotal,
                errors: errorCount,
                errorRatePct,
                modules: moduleStatus
            },
            funnel: {
                ...funnel,
                ctrPct: Math.round(ctrPct * 100) / 100,
                atcPct: Math.round(atcPct * 100) / 100,
                orderPct: Math.round(orderPct * 100) / 100
            },
            journey,
            ceoFlow: behavior.ceoFlow,
            ceoFunnel: behavior.ceoFunnel,
            acquisition,
            behavior,
            sessionFacts: sessionFactSummary,
            identity: identitySummary,
            featureStore: featureStoreSummary,
            performance: {
                webVitals,
                apiLatency
            },
            checkoutTelemetry,
            guardrails,
            funnelContract,
            churn,
            anomalies,
            lossPoints,
            trends,
            trendMeta,
            topEvents: topEventsRows.map((r) => ({ event_type: r.event_type, events: Number(r.events || 0) })),
            topSources: sourceRows.map((r) => ({ source_path: r.source_path || 'unknown', events: Number(r.events || 0) })),
            topReferrers: topRefRows.map((r) => ({ referrer: r.referrer, events: Number(r.events || 0) })),
            topBikes: topBikeRows.map((r) => ({
                id: Number(r.id),
                brand: r.brand,
                model: r.model,
                detail_open: Number(r.detail_open || 0),
                add_to_cart: Number(r.add_to_cart || 0),
                order: Number(r.ord || 0)
            })),
            profiles: {
                total: profilesRows.length,
                withInsight: Number(insightsRows[0]?.c || 0),
                avgIntent: Math.round(Number(avgIntentRows[0]?.avg_intent || 0) * 100) / 100,
                topDisciplines: this.mergeScoreMap(disciplineScores),
                topBrands: this.mergeScoreMap(brandScores),
                topProfiles: topProfiles.slice(0, 20)
            },
            experiments: {
                list: experimentStats,
                diagnostics: {
                    srmAlerts: experimentStats.filter((exp) => Boolean(exp?.srm?.detected)).length,
                    aaSuspicious: experimentStats.filter((exp) => Boolean(exp?.aa?.suspicious)).length,
                    segmentedSignals: experimentStats.reduce((sum, exp) => sum + Number((exp?.causalSegments || []).length || 0), 0)
                }
            },
            autoOptimization: autoOpt
        };
    }

    heuristicInsight(profile) {
        const disciplines = this.safeParse(profile.disciplines_json, {});
        const brands = this.safeParse(profile.brands_json, {});
        const topDiscipline = Object.entries(disciplines).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || 'mixed';
        const topBrand = Object.entries(brands).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || 'mixed';
        const weighted = Number(profile.weighted_price || 0);
        return `Primary intent: ${topDiscipline}. Brand tilt: ${topBrand}. Preferred price zone: ${Math.round(weighted || 0)} EUR.`;
    }

    async refreshProfileInsights(options = {}) {
        const limit = Math.max(1, Math.min(100, Number(options.limit || 25)));
        const force = Boolean(options.force);

        const rows = await this.db.query(
            `SELECT profile_key, disciplines_json, brands_json, weighted_price, intent_score, insight_text
             FROM user_interest_profiles
             ${force ? '' : 'WHERE insight_text IS NULL OR TRIM(insight_text) = ""'}
             ORDER BY intent_score DESC
             LIMIT ?`,
            [limit]
        );

        let updated = 0;
        let geminiUsed = 0;
        const failures = [];

        for (const row of rows) {
            let insight = this.heuristicInsight(row);
            let model = 'heuristic';

            if (this.geminiClient && String(process.env.ENABLE_GEMINI_PROFILE_INSIGHTS || '0') === '1') {
                try {
                    const prompt = [
                        'You are conversion analyst. Return one short plain-text recommendation sentence.',
                        `Profile: ${JSON.stringify({
                            profile_key: row.profile_key,
                            weighted_price: row.weighted_price,
                            intent_score: row.intent_score,
                            disciplines: this.safeParse(row.disciplines_json, {}),
                            brands: this.safeParse(row.brands_json, {})
                        })}`
                    ].join('\n');
                    const response = await this.geminiClient.generateContent(prompt);
                    const text = this.parseGeminiText(response).trim();
                    if (text) {
                        insight = text.slice(0, 500);
                        model = 'gemini';
                        geminiUsed++;
                    }
                } catch (error) {
                    failures.push({ profile_key: row.profile_key, error: String(error.message || error) });
                }
            }

            await this.db.query(
                `UPDATE user_interest_profiles
                 SET insight_text = ?, insight_model = ?, insight_updated_at = datetime('now'), updated_at = datetime('now')
                 WHERE profile_key = ?`,
                [insight, model, row.profile_key]
            );
            updated++;
        }

        await this.db.query(
            'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
            ['info', 'metrics_insights', `Refreshed ${updated} profile insights (gemini: ${geminiUsed})`]
        );

        return {
            success: true,
            updated,
            geminiUsed,
            failures: failures.slice(0, 10)
        };
    }

    async autoOptimizeExperiments(options = {}) {
        const windowDays = Math.max(1, Math.min(60, Number(options.windowDays || 14)));
        const minAssignments = Math.max(10, Number(options.minAssignments || 120));
        const dryRun = options.dryRun !== false;
        const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

        const exps = await this.db.query('SELECT experiment_key, name, variants_json, enabled, updated_at FROM ab_experiments WHERE enabled = 1');
        const assignments = await this.db.query('SELECT experiment_key, variant, COUNT(*) as cnt FROM ab_assignments GROUP BY experiment_key, variant');
        const goals = await this.db.query('SELECT experiment_key, variant, metric_name, SUM(value) as val FROM ab_goal_events WHERE created_at >= ? GROUP BY experiment_key, variant, metric_name', [sinceIso]);
        const anomalyGuardRows = await this.db.query(
            `SELECT anomaly_key, severity, metric_name, created_at
             FROM metrics_anomalies
             WHERE created_at >= ?
               AND severity IN ('warning', 'critical')
             ORDER BY created_at DESC
             LIMIT 20`,
            [new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()]
        );
        const guardrailMetrics = await this.computeGuardrailMetrics(windowDays);

        const diagnostics = this.buildExperimentDiagnostics(exps, assignments, goals, minAssignments);
        const expByKey = new Map((exps || []).map((row) => [String(row.experiment_key), row]));
        const hasGlobalGuardrail = anomalyGuardRows.length > 0 || guardrailMetrics.degraded;

        const decisions = [];
        const guardrailSummary = {
            globalGuardrail: hasGlobalGuardrail,
            globalGuardrailAlerts: anomalyGuardRows.length,
            guardrailMetricDegraded: guardrailMetrics.degraded,
            guardrailReasons: guardrailMetrics.reasons || [],
            fallbackTriggered: 0,
            srmBlocked: 0,
            orderGuardBlocked: 0
        };

        for (const exp of diagnostics.list) {
            const original = expByKey.get(String(exp.experimentKey));
            const variants = this.safeParse(original?.variants_json, []);
            if (!Array.isArray(variants) || variants.length < 2) continue;

            if (exp?.srm?.detected) {
                guardrailSummary.srmBlocked += 1;
                decisions.push({
                    experimentKey: exp.experimentKey,
                    action: 'hold',
                    reason: 'SRM detected, traffic split mismatch',
                    srm: exp.srm
                });
                continue;
            }

            if (exp?.aa?.suspicious) {
                decisions.push({
                    experimentKey: exp.experimentKey,
                    action: 'hold',
                    reason: 'AA check suspicious, hold optimization until validated',
                    aa: exp.aa
                });
                continue;
            }

            const scored = exp.variants.map((v) => ({
                name: String(v.variant || 'variant'),
                assignments: Number(v.assignments || 0),
                weightedGoals: Number(v.weightedGoals || 0),
                conversion: Number(v.conversion || 0),
                orderRate: Number(v.orderRate || 0),
                causalUpliftPct: Number(v.causalUpliftPct || 0)
            }));
            const control = scored.find((row) => row.name === 'control') || scored[0] || null;

            const eligible = scored.filter((s) => s.assignments >= minAssignments);
            if (eligible.length < 2) {
                decisions.push({
                    experimentKey: exp.experimentKey,
                    action: 'skip',
                    reason: `Not enough assignments >= ${minAssignments}`,
                    variants: scored
                });
                continue;
            }

            if (hasGlobalGuardrail) {
                const totalSlots = Math.max(1, variants.length - 1);
                const newVariants = variants.map((v) => {
                    if (String(v.name) === String(control?.name || 'control')) {
                        return { ...v, weight: 80 };
                    }
                    return { ...v, weight: Math.max(5, Math.round(20 / totalSlots)) };
                });
                guardrailSummary.fallbackTriggered += 1;
                decisions.push({
                    experimentKey: exp.experimentKey,
                    action: dryRun ? 'preview_fallback_reweight' : 'fallback_reweighted',
                    reason: `Auto-fallback due guardrail degradation (${(guardrailMetrics.reasons || []).join(', ') || 'anomaly'})`,
                    guardrailMetrics,
                    newVariants
                });
                if (!dryRun) {
                    await this.db.query(
                        'UPDATE ab_experiments SET variants_json = ?, updated_at = datetime(\'now\') WHERE experiment_key = ?',
                        [JSON.stringify(newVariants), exp.experimentKey]
                    );
                }
                continue;
            }

            eligible.sort((a, b) => (b.causalUpliftPct - a.causalUpliftPct) || (b.conversion - a.conversion));
            const winner = eligible[0];
            const runner = eligible[1];
            const uplift = Number(winner.causalUpliftPct || 0);

            if (winner.name === runner.name || uplift < 3) {
                decisions.push({
                    experimentKey: exp.experimentKey,
                    action: 'hold',
                    reason: 'No significant causal uplift winner',
                    upliftPct: Math.round(uplift * 100) / 100,
                    winner,
                    runner
                });
                continue;
            }

            if (control && control.assignments >= minAssignments && winner.orderRate < (control.orderRate * 0.85)) {
                guardrailSummary.orderGuardBlocked += 1;
                decisions.push({
                    experimentKey: exp.experimentKey,
                    action: 'hold',
                    reason: 'Guardrail: winner reduces order-rate vs control',
                    upliftPct: Math.round(uplift * 100) / 100,
                    winner,
                    control
                });
                continue;
            }

            const newVariants = variants.map((v) => ({
                ...v,
                weight: String(v.name) === winner.name
                    ? 70
                    : Math.max(10, Math.round(30 / Math.max(1, variants.length - 1)))
            }));

            decisions.push({
                experimentKey: exp.experimentKey,
                action: dryRun ? 'preview_reweight' : 'reweighted',
                upliftPct: Math.round(uplift * 100) / 100,
                winner,
                newVariants
            });

            if (!dryRun) {
                await this.db.query(
                    'UPDATE ab_experiments SET variants_json = ?, updated_at = datetime(\'now\') WHERE experiment_key = ?',
                    [JSON.stringify(newVariants), exp.experimentKey]
                );
            }
        }

        if (!dryRun) {
            await this.db.query(
                `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
                ['metrics_auto_optimize_last_run', new Date().toISOString()]
            );
            await this.db.query(
                `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
                ['metrics_auto_optimize_last_result', JSON.stringify({ windowDays, minAssignments, decisions, guardrails: guardrailSummary, metrics: guardrailMetrics })]
            );
            await this.db.query(
                'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
                ['info', 'metrics_auto_optimize', `Auto optimize applied for ${decisions.filter((d) => d.action === 'reweighted' || d.action === 'fallback_reweighted').length} experiments (guardrail=${hasGlobalGuardrail ? 'on' : 'off'})`]
            );
        }

        return {
            success: true,
            dryRun,
            windowDays,
            minAssignments,
            guardrails: {
                ...guardrailSummary,
                metrics: guardrailMetrics,
                recentAlerts: anomalyGuardRows.map((row) => ({
                    anomalyKey: row.anomaly_key,
                    severity: row.severity,
                    metricName: row.metric_name,
                    createdAt: row.created_at
                }))
            },
            decisions
        };
    }

    async getSessionFacts(options = {}) {
        const windowCfg = this.resolveWindowConfig(options, 'daily');
        const windowHours = windowCfg.windowHours;
        const limit = Math.max(1, Math.min(1000, Number(options.limit || 200)));
        const offset = Math.max(0, Number(options.offset || 0));
        const sinceIso = windowCfg.sinceIso;

        const [rows, totals] = await Promise.all([
            this.db.query(
                `SELECT
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
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?
                 ORDER BY last_seen_at DESC
                 LIMIT ? OFFSET ?`,
                [sinceIso, limit, offset]
            ),
            this.db.query(
                `SELECT COUNT(*) as c
                 FROM metrics_session_facts
                 WHERE last_seen_at >= ?`,
                [sinceIso]
            )
        ]);

        return {
            success: true,
            window: { hours: windowHours, preset: windowCfg.preset, bucket: windowCfg.bucket, since: sinceIso },
            total: Number(totals[0]?.c || 0),
            rows: rows.map((row) => ({
                sessionId: row.session_id,
                personKey: row.person_key || null,
                userId: row.user_id,
                crmLeadId: row.crm_lead_id || null,
                customerEmailHash: row.customer_email_hash || null,
                customerPhoneHash: row.customer_phone_hash || null,
                firstSeenAt: row.first_seen_at,
                lastSeenAt: row.last_seen_at,
                eventCount: Number(row.event_count || 0),
                pageViews: Number(row.page_views || 0),
                firstClicks: Number(row.first_clicks || 0),
                catalogViews: Number(row.catalog_views || 0),
                productViews: Number(row.product_views || 0),
                addToCart: Number(row.add_to_cart || 0),
                checkoutStarts: Number(row.checkout_starts || 0),
                checkoutSteps: Number(row.checkout_steps || 0),
                checkoutValidationErrors: Number(row.checkout_validation_errors || 0),
                checkoutSubmitAttempts: Number(row.checkout_submit_attempts || 0),
                checkoutSubmitSuccess: Number(row.checkout_submit_success || 0),
                checkoutSubmitFailed: Number(row.checkout_submit_failed || 0),
                formsSeen: Number(row.forms_seen || 0),
                formsFirstInput: Number(row.forms_first_input || 0),
                formSubmitAttempts: Number(row.form_submit_attempts || 0),
                formValidationErrors: Number(row.form_validation_errors || 0),
                bookingStarts: Number(row.booking_starts || 0),
                bookingSuccess: Number(row.booking_success || 0),
                orders: Number(row.orders || 0),
                dwellMsSum: Number(row.dwell_ms_sum || 0),
                firstSourcePath: row.first_source_path || null,
                lastSourcePath: row.last_source_path || null,
                entryReferrer: row.entry_referrer || null,
                utmSource: row.utm_source || null,
                utmMedium: row.utm_medium || null,
                utmCampaign: row.utm_campaign || null,
                clickId: row.click_id || null,
                landingPath: row.landing_path || null,
                isBot: Number(row.is_bot || 0) === 1,
                updatedAt: row.updated_at || null
            }))
        };
    }

    async detectAndStoreAnomalies(options = {}) {
        const lookbackHours = Math.max(12, Math.min(24 * 14, Number(options.lookbackHours || 72)));
        const baselineHours = Math.max(6, Math.min(lookbackHours - 1, Number(options.baselineHours || 24)));
        const minBaselineEvents = Math.max(10, Number(options.minBaselineEvents || 40));
        const sinceIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
        const dedupeSince = new Date(Date.now() - 90 * 60 * 1000).toISOString();

        const diagSinceIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const [eventRows, checkoutRows, apiRows, topSourceRows, topPathRows, topFieldRows] = await Promise.all([
            this.db.query(
                `SELECT strftime('%Y-%m-%d %H:00:00', created_at) as bucket, COUNT(*) as events
                 FROM metric_events
                 WHERE created_at >= ?
                 GROUP BY bucket
                 ORDER BY bucket ASC`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    strftime('%Y-%m-%d %H:00:00', created_at) as bucket,
                    SUM(CASE WHEN event_type = 'checkout_submit_attempt' THEN 1 ELSE 0 END) as attempts,
                    SUM(CASE WHEN event_type = 'checkout_submit_failed' THEN 1 ELSE 0 END) as failed
                 FROM metric_events
                 WHERE created_at >= ?
                 GROUP BY bucket
                 ORDER BY bucket ASC`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT created_at, metadata
                 FROM metric_events
                 WHERE created_at >= ?
                   AND event_type = 'api_latency'
                   AND metadata IS NOT NULL`,
                [sinceIso]
            ),
            this.db.query(
                `SELECT
                    COALESCE(
                        NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.utm_source') ELSE NULL END, ''),
                        NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.attribution.utm_source') ELSE NULL END, ''),
                        'direct'
                    ) as source,
                    COUNT(*) as events
                 FROM metric_events
                 WHERE created_at >= ?
                 GROUP BY source
                 ORDER BY events DESC
                 LIMIT 5`,
                [diagSinceIso]
            ),
            this.db.query(
                `SELECT source_path, COUNT(*) as events
                 FROM metric_events
                 WHERE created_at >= ?
                 GROUP BY source_path
                 ORDER BY events DESC
                 LIMIT 5`,
                [diagSinceIso]
            ),
            this.db.query(
                `SELECT
                    COALESCE(NULLIF(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.field') ELSE NULL END, ''), 'unknown') as field,
                    COUNT(*) as errors
                 FROM metric_events
                 WHERE created_at >= ?
                   AND event_type IN ('form_validation_error','checkout_validation_error','checkout_field_error')
                 GROUP BY field
                 ORDER BY errors DESC
                 LIMIT 5`,
                [diagSinceIso]
            )
        ]);

        const created = [];
        const nowBucket = eventRows[eventRows.length - 1] || null;
        if (!nowBucket) {
            return { success: true, created: [], checkedAt: new Date().toISOString() };
        }

        const toNumber = (value) => Number(value || 0);
        const baselineEventRows = eventRows.slice(-1 - baselineHours, -1);
        const baselineEvents = baselineEventRows.map((row) => toNumber(row.events));
        const baselineEventsAvg = baselineEvents.length > 0
            ? baselineEvents.reduce((sum, value) => sum + value, 0) / baselineEvents.length
            : 0;
        const currentEvents = toNumber(nowBucket.events);

        const latestCheckout = checkoutRows[checkoutRows.length - 1] || null;
        const baselineCheckoutRows = checkoutRows.slice(-1 - baselineHours, -1);
        const baselineCheckoutRates = baselineCheckoutRows.map((row) => {
            const attempts = toNumber(row.attempts);
            const failed = toNumber(row.failed);
            return attempts > 0 ? failed / attempts : 0;
        });
        const baselineCheckoutFailRate = baselineCheckoutRates.length > 0
            ? baselineCheckoutRates.reduce((sum, value) => sum + value, 0) / baselineCheckoutRates.length
            : 0;
        const currentCheckoutAttempts = toNumber(latestCheckout?.attempts || 0);
        const currentCheckoutFailRate = currentCheckoutAttempts > 0 ? (toNumber(latestCheckout?.failed || 0) / currentCheckoutAttempts) : 0;

        const apiByBucket = new Map();
        for (const row of apiRows) {
            const bucket = this.toLocalHourBucket(row.created_at);
            if (!bucket) continue;
            const meta = this.safeParse(row.metadata, {});
            const duration = Number(meta.duration_ms || meta.durationMs || meta.ms);
            if (!Number.isFinite(duration) || duration < 0) continue;
            const curr = apiByBucket.get(bucket) || [];
            curr.push(duration);
            apiByBucket.set(bucket, curr);
        }

        const apiBuckets = [...apiByBucket.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        const currentApi = apiBuckets[apiBuckets.length - 1] || null;
        const baselineApi = apiBuckets.slice(Math.max(0, apiBuckets.length - 1 - baselineHours), Math.max(0, apiBuckets.length - 1));
        const currentApiP95 = currentApi ? this.percentile(currentApi[1], 0.95) : 0;
        const baselineApiP95 = baselineApi.length > 0
            ? baselineApi.reduce((sum, row) => sum + this.percentile(row[1], 0.95), 0) / baselineApi.length
            : 0;

        const maybeInsert = async (payload) => {
            const existing = await this.db.query(
                `SELECT id
                 FROM metrics_anomalies
                 WHERE anomaly_key = ?
                   AND created_at >= ?
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [payload.anomaly_key, dedupeSince]
            );
            if (existing.length > 0) return false;
            await this.db.query(
                `INSERT INTO metrics_anomalies (
                    anomaly_key, severity, metric_name, baseline_value, current_value, delta_pct, details, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    payload.anomaly_key,
                    payload.severity,
                    payload.metric_name,
                    payload.baseline_value,
                    payload.current_value,
                    payload.delta_pct,
                    JSON.stringify(payload.details || {})
                ]
            );
            created.push(payload);
            return true;
        };

        const diagnostics = {
            topSource: topSourceRows[0]?.source || 'direct',
            topPath: topPathRows[0]?.source_path || 'unknown',
            topField: topFieldRows[0]?.field || null
        };

        if (baselineEventsAvg >= minBaselineEvents && currentEvents < baselineEventsAvg * 0.45) {
            const deltaPct = baselineEventsAvg > 0 ? ((currentEvents - baselineEventsAvg) / baselineEventsAvg) * 100 : 0;
            await maybeInsert({
                anomaly_key: 'ingest_drop',
                severity: 'critical',
                metric_name: 'events_per_hour',
                baseline_value: Math.round(baselineEventsAvg * 100) / 100,
                current_value: currentEvents,
                delta_pct: Math.round(deltaPct * 100) / 100,
                details: {
                    lookbackHours,
                    baselineHours,
                    currentBucket: nowBucket.bucket,
                    channel: diagnostics.topSource,
                    sourcePath: diagnostics.topPath,
                    stage: this.funnelStageFromPath(diagnostics.topPath),
                    probableCause: 'traffic_or_ingest_drop'
                }
            });
        }

        if (currentCheckoutAttempts >= 10 && currentCheckoutFailRate > Math.max(0.25, baselineCheckoutFailRate + 0.15)) {
            const deltaPct = baselineCheckoutFailRate > 0
                ? ((currentCheckoutFailRate - baselineCheckoutFailRate) / baselineCheckoutFailRate) * 100
                : 100;
            await maybeInsert({
                anomaly_key: 'checkout_failure_spike',
                severity: 'warning',
                metric_name: 'checkout_fail_rate',
                baseline_value: Math.round(baselineCheckoutFailRate * 10000) / 100,
                current_value: Math.round(currentCheckoutFailRate * 10000) / 100,
                delta_pct: Math.round(deltaPct * 100) / 100,
                details: {
                    currentAttempts: currentCheckoutAttempts,
                    channel: diagnostics.topSource,
                    sourcePath: diagnostics.topPath,
                    stage: 'checkout',
                    topField: diagnostics.topField,
                    probableCause: diagnostics.topField && diagnostics.topField !== 'unknown'
                        ? `validation_errors_on_${diagnostics.topField}`
                        : 'checkout_validation_or_backend_issue'
                }
            });
        }

        if (baselineApiP95 >= 300 && currentApiP95 > baselineApiP95 * 1.8) {
            const deltaPct = baselineApiP95 > 0 ? ((currentApiP95 - baselineApiP95) / baselineApiP95) * 100 : 0;
            await maybeInsert({
                anomaly_key: 'api_latency_spike',
                severity: 'warning',
                metric_name: 'api_p95_ms',
                baseline_value: Math.round(baselineApiP95 * 100) / 100,
                current_value: Math.round(currentApiP95 * 100) / 100,
                delta_pct: Math.round(deltaPct * 100) / 100,
                details: {
                    lookbackHours,
                    baselineHours,
                    channel: diagnostics.topSource,
                    sourcePath: diagnostics.topPath,
                    stage: this.funnelStageFromPath(diagnostics.topPath),
                    probableCause: 'api_or_network_latency_spike'
                }
            });
        }

        await this.db.query(
            `DELETE FROM metrics_anomalies
             WHERE created_at < ?`,
            [new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()]
        );

        if (created.length > 0) {
            await this.db.query(
                'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
                ['warning', 'metrics_anomaly', `Detected ${created.length} anomaly signals`]
            );
        }

        return {
            success: true,
            checkedAt: new Date().toISOString(),
            created
        };
    }

    async runDailyAnomalyDigest(options = {}) {
        const lookbackHours = Math.max(24, Math.min(24 * 21, Number(options.lookbackHours || 168)));
        const baselineHours = Math.max(12, Math.min(72, Number(options.baselineHours || 24)));
        const scan = await this.detectAndStoreAnomalies({ lookbackHours, baselineHours });
        const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const rows = await this.db.query(
            `SELECT anomaly_key, severity, metric_name, delta_pct, details, created_at
             FROM metrics_anomalies
             WHERE created_at >= ?
             ORDER BY created_at DESC
             LIMIT 100`,
            [sinceIso]
        );

        const alerts = rows.map((row) => ({
            anomalyKey: String(row.anomaly_key || 'unknown'),
            severity: String(row.severity || 'info'),
            metricName: String(row.metric_name || 'metric'),
            deltaPct: Number(row.delta_pct || 0),
            details: this.safeParse(row.details, {}),
            createdAt: row.created_at
        }));

        const critical = alerts.filter((a) => a.severity === 'critical').length;
        const warning = alerts.filter((a) => a.severity === 'warning').length;
        if (alerts.length > 0) {
            await this.db.query(
                'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
                [
                    critical > 0 ? 'warning' : 'info',
                    'metrics_daily_anomaly_digest',
                    `Daily anomaly digest: total=${alerts.length}, critical=${critical}, warning=${warning}`
                ]
            );
        }

        return {
            success: true,
            checkedAt: new Date().toISOString(),
            lookbackHours,
            baselineHours,
            scanCreated: Array.isArray(scan?.created) ? scan.created.length : 0,
            alerts
        };
    }
}

module.exports = {
    OperationalIntelligenceService
};
