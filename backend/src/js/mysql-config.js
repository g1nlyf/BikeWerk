const path = require('path');
const fs = require('fs');

// Initial SQL for new databases
const initSQL = `
CREATE TABLE IF NOT EXISTS bikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    price REAL NOT NULL,
    original_price REAL,
    discount INTEGER DEFAULT 0,
    currency TEXT,
    quality_score REAL,
    category TEXT,
    condition_status TEXT,
    is_active BOOLEAN DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    main_image TEXT,
    rank REAL DEFAULT 0.5,
    is_hot_offer INTEGER DEFAULT 0,
    ranking_score REAL DEFAULT 0.5,
    needs_audit INTEGER DEFAULT 0,
    audit_status TEXT DEFAULT "pending",
    condition_score INTEGER,
    condition_grade TEXT,
    condition_penalty REAL,
    condition_reason TEXT,
    location TEXT,
    size TEXT,
    wheel_size TEXT,
    source_url TEXT,
    source_platform TEXT,
    priority TEXT DEFAULT 'normal',
    hotness_score REAL DEFAULT 0,
    views INTEGER DEFAULT 0,
    last_checked DATETIME,
    deactivation_reason TEXT,
    deactivated_at DATETIME,
    fmv REAL,
    fmv_confidence REAL,
    market_comparison TEXT,
    optimal_price REAL,
    days_on_market INTEGER DEFAULT 0,
    source_platform_type TEXT,
    source_ad_id TEXT,
    profit_margin REAL,
    weight REAL,
    suspension_type TEXT,
    groupset TEXT,
    brakes TEXT,
    fork TEXT,
    shock TEXT,
    inspection_data TEXT,
    seller_name TEXT,
    seller_type TEXT,
    seller_rating REAL,
    seller_badges_json TEXT,
    delivery_option TEXT,
    shipping_cost REAL,
    is_pickup_available INTEGER,
    gallery TEXT,
    audit_notes TEXT,
    features_raw TEXT,
    badges TEXT,
    upgrades TEXT,
    is_new INTEGER DEFAULT 0,
    unified_data TEXT,
    specs_json TEXT,
    inspection_json TEXT,
    seller_json TEXT,
    logistics_json TEXT,
    features_json TEXT,
    sub_category TEXT,
    discipline TEXT,
    price_history_json TEXT,
    media_json TEXT,
    ranking_json TEXT,
    audit_json TEXT,
    ai_analysis_json TEXT,
    market_data_json TEXT,
    internal_json TEXT,
    completeness REAL,
    breadcrumb TEXT,
    platform_reviews_count INTEGER,
    platform_reviews_source TEXT,
    buyer_protection_price REAL,
    seller_last_active TEXT,
    seller_rating_visual TEXT,
    shifting_type TEXT,
    receipt_available INTEGER DEFAULT 0,
    component_upgrades_json TEXT
);

CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,
    source TEXT,
    message TEXT,
    stack TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS currency_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bike_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER NOT NULL,
    spec_label TEXT NOT NULL,
    spec_value TEXT,
    spec_order INTEGER DEFAULT 0,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bike_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    local_path TEXT,
    image_type TEXT,
    position INTEGER DEFAULT 0,
    is_main BOOLEAN DEFAULT 0,
    image_order INTEGER DEFAULT 0,
    is_downloaded INTEGER DEFAULT 0,
    width INTEGER,
    height INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bike_id, image_url),
    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    attempts INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 0,
    ip_address TEXT,
    last_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_expires_at ON verification_codes(expires_at);

CREATE TABLE IF NOT EXISTS user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bike_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, bike_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT,
    brand TEXT,
    price_eur REAL,
    source_url TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    frame_material TEXT,
    trim_level TEXT,
    quality_score INTEGER DEFAULT 100,
    category TEXT,
    year INTEGER,
    title TEXT,
    frame_size TEXT,
    condition TEXT,
    source_platform TEXT,
    source_ad_id TEXT
);

CREATE TABLE IF NOT EXISTS recent_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER,
    model TEXT NOT NULL,
    city TEXT NOT NULL,
    price REAL NOT NULL,
    price_breakdown TEXT,
    status TEXT,
    main_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recent_deliveries_created_at ON recent_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_bikes_brand_category ON bikes(brand, category);
CREATE INDEX IF NOT EXISTS idx_bikes_price_quality ON bikes(price, quality_score);
CREATE INDEX IF NOT EXISTS idx_bikes_source_platform ON bikes(source_platform, source_ad_id);
CREATE INDEX IF NOT EXISTS idx_bikes_created_at ON bikes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bike_images_bike_id ON bike_images(bike_id);

CREATE TABLE IF NOT EXISTS analytics_events (
    detail_clicks INTEGER DEFAULT 0,
    hovers INTEGER DEFAULT 0,
    gallery_swipes INTEGER DEFAULT 0,
    favorites INTEGER DEFAULT 0,
    add_to_cart INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    scroll_stops INTEGER DEFAULT 0,
    avg_dwell_ms INTEGER DEFAULT 0,
    bounces INTEGER DEFAULT 0,
    period_start DATETIME,
    period_end DATETIME
);

CREATE TABLE IF NOT EXISTS metric_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER,
    event_type TEXT,
    value INTEGER DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    referrer TEXT,
    source_path TEXT,
    event_id TEXT,
    dwell_ms INTEGER,
    user_id INTEGER,
    person_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_metric_events_bike_created ON metric_events(bike_id, created_at);
CREATE INDEX IF NOT EXISTS idx_metric_events_type_created ON metric_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_metric_events_event_id ON metric_events(event_id);
CREATE INDEX IF NOT EXISTS idx_metric_events_session_created ON metric_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_metric_events_person_created ON metric_events(person_key, created_at);

CREATE TABLE IF NOT EXISTS metrics_session_facts (
    session_id TEXT PRIMARY KEY,
    person_key TEXT,
    user_id INTEGER,
    crm_lead_id TEXT,
    customer_email_hash TEXT,
    customer_phone_hash TEXT,
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_count INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    first_clicks INTEGER DEFAULT 0,
    catalog_views INTEGER DEFAULT 0,
    product_views INTEGER DEFAULT 0,
    add_to_cart INTEGER DEFAULT 0,
    checkout_starts INTEGER DEFAULT 0,
    checkout_steps INTEGER DEFAULT 0,
    checkout_validation_errors INTEGER DEFAULT 0,
    checkout_submit_attempts INTEGER DEFAULT 0,
    checkout_submit_success INTEGER DEFAULT 0,
    checkout_submit_failed INTEGER DEFAULT 0,
    forms_seen INTEGER DEFAULT 0,
    forms_first_input INTEGER DEFAULT 0,
    form_submit_attempts INTEGER DEFAULT 0,
    form_validation_errors INTEGER DEFAULT 0,
    booking_starts INTEGER DEFAULT 0,
    booking_success INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    dwell_ms_sum INTEGER DEFAULT 0,
    first_source_path TEXT,
    last_source_path TEXT,
    entry_referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    click_id TEXT,
    landing_path TEXT,
    is_bot INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_metrics_session_facts_user ON metrics_session_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_session_facts_last_seen ON metrics_session_facts(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_metrics_session_facts_utm ON metrics_session_facts(utm_source, utm_medium, utm_campaign);
CREATE INDEX IF NOT EXISTS idx_metrics_session_facts_person ON metrics_session_facts(person_key);

CREATE TABLE IF NOT EXISTS metrics_anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anomaly_key TEXT NOT NULL,
    severity TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    baseline_value REAL,
    current_value REAL,
    delta_pct REAL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metrics_anomalies_created ON metrics_anomalies(created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_anomalies_key ON metrics_anomalies(anomaly_key, created_at);

CREATE TABLE IF NOT EXISTS metrics_identity_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_type TEXT NOT NULL,
    identity_value TEXT NOT NULL,
    person_key TEXT NOT NULL,
    user_id INTEGER,
    session_id TEXT,
    crm_lead_id TEXT,
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(identity_type, identity_value),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_metrics_identity_person ON metrics_identity_nodes(person_key);
CREATE INDEX IF NOT EXISTS idx_metrics_identity_user ON metrics_identity_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_identity_lead ON metrics_identity_nodes(crm_lead_id);

CREATE TABLE IF NOT EXISTS metrics_feature_store (
    person_key TEXT PRIMARY KEY,
    profile_key TEXT,
    user_id INTEGER,
    session_id TEXT,
    crm_lead_id TEXT,
    budget_cluster TEXT DEFAULT 'unknown',
    weighted_price REAL DEFAULT 0,
    intent_score REAL DEFAULT 0,
    recency_half_life_days REAL DEFAULT 7,
    recency_decay REAL DEFAULT 1,
    discipline_embedding_json TEXT,
    brand_embedding_json TEXT,
    category_embedding_json TEXT,
    last_event_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_metrics_feature_store_user ON metrics_feature_store(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_feature_store_budget ON metrics_feature_store(budget_cluster);
CREATE INDEX IF NOT EXISTS idx_metrics_feature_store_intent ON metrics_feature_store(intent_score);

CREATE TABLE IF NOT EXISTS referral_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    channel_name TEXT NOT NULL,
    code_word TEXT,
    creator_tag TEXT,
    target_path TEXT NOT NULL DEFAULT '/',
    utm_source TEXT NOT NULL DEFAULT 'creator',
    utm_medium TEXT NOT NULL DEFAULT 'referral',
    utm_campaign TEXT,
    utm_content TEXT,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_referral_links_slug ON referral_links(slug);
CREATE INDEX IF NOT EXISTS idx_referral_links_active ON referral_links(is_active, created_at);

CREATE TABLE IF NOT EXISTS referral_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referral_link_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    session_hint TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    referrer TEXT,
    target_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(referral_link_id) REFERENCES referral_links(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_referral_visits_link_created ON referral_visits(referral_link_id, created_at);
CREATE INDEX IF NOT EXISTS idx_referral_visits_slug_created ON referral_visits(slug, created_at);
CREATE INDEX IF NOT EXISTS idx_referral_visits_session ON referral_visits(session_hint, created_at);

CREATE TABLE IF NOT EXISTS bike_behavior_metrics (
    bike_id INTEGER PRIMARY KEY,
    impressions INTEGER DEFAULT 0,
    detail_clicks INTEGER DEFAULT 0,
    hovers INTEGER DEFAULT 0,
    gallery_swipes INTEGER DEFAULT 0,
    favorites INTEGER DEFAULT 0,
    add_to_cart INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    scroll_stops INTEGER DEFAULT 0,
    dwell_time_ms INTEGER DEFAULT 0,
    avg_dwell_ms INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    bounces INTEGER DEFAULT 0,
    period_start DATETIME,
    period_end DATETIME,
    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    user_id INTEGER,
    query TEXT,
    category TEXT,
    brand TEXT,
    min_price REAL,
    max_price REAL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_search_events_session ON search_events(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_search_events_user ON search_events(user_id, ts);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_interest_profiles (
    profile_key TEXT PRIMARY KEY,
    user_id INTEGER,
    session_id TEXT,
    disciplines_json TEXT,
    brands_json TEXT,
    price_sum REAL DEFAULT 0,
    price_weight REAL DEFAULT 0,
    weighted_price REAL DEFAULT 0,
    intent_score REAL DEFAULT 0,
    insight_text TEXT,
    insight_model TEXT,
    insight_updated_at DATETIME,
    last_event_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_interest_profiles_user ON user_interest_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_interest_profiles_session ON user_interest_profiles(session_id);

CREATE TABLE IF NOT EXISTS ab_experiments (
    experiment_key TEXT PRIMARY KEY,
    name TEXT,
    variants_json TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ab_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_key TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    user_id INTEGER,
    session_id TEXT,
    variant TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(experiment_key, subject_key),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_subject ON ab_assignments(subject_key);

CREATE TABLE IF NOT EXISTS ab_goal_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_key TEXT NOT NULL,
    variant TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    bike_id INTEGER,
    user_id INTEGER,
    session_id TEXT,
    value REAL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE SET NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ab_goal_events_exp_metric ON ab_goal_events(experiment_key, metric_name, created_at);

CREATE TABLE IF NOT EXISTS telegram_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, order_id)
);

CREATE TABLE IF NOT EXISTS telegram_preferences (
    chat_id TEXT PRIMARY KEY,
    preferences TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER NOT NULL,
    user_id INTEGER,
    customer_email TEXT,
    customer_name TEXT,
    status TEXT DEFAULT 'pending',
    total_price REAL,
    deposit_amount REAL,
    tariff TEXT DEFAULT 'standard',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bike_id) REFERENCES bikes(id)
);

CREATE TABLE IF NOT EXISTS refill_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    tier INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
);

CREATE TABLE IF NOT EXISTS needs_manual_review (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT,
    model TEXT,
    year INTEGER,
    price INTEGER,
    reason TEXT,
    source_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bike_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER NOT NULL,
    brand TEXT,
    model TEXT,
    year INTEGER,
    tier INTEGER,
    price INTEGER,
    optimal_price INTEGER,
    discount_pct REAL,
    views INTEGER DEFAULT 0,
    detail_views INTEGER DEFAULT 0,
    avg_time_on_page REAL DEFAULT 0,
    favorites INTEGER DEFAULT 0,
    listed_at DATETIME,
    first_view_at DATETIME,
    sold_at DATETIME,
    days_to_first_view REAL,
    days_to_sell REAL,
    predicted_hotness INTEGER DEFAULT 50,
    predicted_days_to_sell REAL,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (bike_id) REFERENCES bikes(id)
);
`;

class DatabaseManager {
    constructor() {
        this.db = null;
        this._recoveryAttempted = false;
        const envPath = process.env.DB_PATH;
        const backendRoot = path.resolve(__dirname, '../..');
        const projectRoot = path.resolve(backendRoot, '..');
        const resolveDbPath = (inputPath) => {
            if (!inputPath) return path.join(backendRoot, 'database/eubike.db');
            if (path.isAbsolute(inputPath)) return inputPath;

            const normalized = String(inputPath).replace(/^\.\/?/, '').replace(/\\/g, '/');
            if (
                normalized === 'database/eubike.db' ||
                normalized.endsWith('/database/eubike.db') ||
                normalized.endsWith('backend/database/eubike.db')
            ) {
                return path.resolve(backendRoot, 'database/eubike.db');
            }
            const fromCwd = path.resolve(process.cwd(), normalized);
            const fromProject = path.resolve(projectRoot, normalized);
            const fromBackend = path.resolve(backendRoot, normalized);
            const candidates = [fromBackend, fromProject, fromCwd];

            for (const candidate of candidates) {
                if (fs.existsSync(path.dirname(candidate))) return candidate;
            }

            return fromBackend;
        };
        this.dbPath = resolveDbPath(envPath);

        console.log(`[DatabaseManager] Using DB Path: ${this.dbPath}`);
        this.isNode = typeof window === 'undefined';
    }

    async initialize() {
        if (this.db) return true;

        try {
            // Ensure directory exists
            const dbDir = path.dirname(this.dbPath);
            if (this.isNode && !fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            if (this.isNode) {
                // Node.js environment - use sqlite3 directly for persistence
                const sqlite3 = require('sqlite3').verbose();
                const { open } = require('sqlite');

                this.db = await open({
                    filename: this.dbPath,
                    driver: sqlite3.Database
                });

                // Helper wrapper to match expected API
                this.db.query = async (sql, params = []) => {
                    const upper = sql.trim().toUpperCase();
                    if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA')) {
                        return await this.db.all(sql, params);
                    } else {
                        const result = await this.db.run(sql, params);
                        // Normalize result for compatibility
                        return { insertId: result.lastID, affectedRows: result.changes, ...result };
                    }
                };

                // Enable FK
                await this.db.run('PRAGMA foreign_keys = ON');
                await this.ensureDatabaseIntegrity();

            } else {
                // Browser environment - keep using sql.js (if needed)
                // Note: Browser support requires loading the wasm, which is separate.
                console.warn('DatabaseManager running in browser - persistence limited.');
                // Placeholder for sql.js logic if strictly needed for browser-only mode
            }

            // Init tables if empty
            const statements = initSQL.split(';').filter(stmt => stmt.trim());
            for (const statement of statements) {
                if (statement.trim()) {
                    if (this.isNode) {
                        try {
                            await this.db.run(statement);
                        } catch (error) {
                            const msg = String(error && error.message ? error.message : error || '');
                            // Gracefully skip index creation if schema is partial (common in isolated test DBs)
                            if (/^\s*CREATE INDEX/i.test(statement) && /no such column/i.test(msg)) {
                                console.warn(`?? Skipping index due to schema drift: ${msg}`);
                                continue;
                            }
                            throw error;
                        }
                    }
                }
            }

            if (this.isNode) {
                await this.ensureMetricsFoundationSchema();
                await this.ensureCrmFoundationSchema();
                await this.ensureRuntimeOpsSchema();
                await this.db.run(`
                    DELETE FROM bike_images
                    WHERE id NOT IN (
                        SELECT MIN(id)
                        FROM bike_images
                        GROUP BY bike_id, image_url
                    )
                `);
                await this.db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_bike_images_unique ON bike_images(bike_id, image_url)');
            }

            console.log(`✅ Database initialized at ${this.dbPath}`);
            return true;
        } catch (error) {
            if (this.isNode && this.isCorruptionError(error) && !this._recoveryAttempted) {
                console.warn('⚠️ SQLite corruption detected. Attempting automatic recovery...');
                this._recoveryAttempted = true;
                await this.recoverCorruptedDatabase();
                return this.initialize();
            }
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    isCorruptionError(error) {
        const message = String(error?.message || '').toLowerCase();
        return (
            error?.code === 'SQLITE_CORRUPT' ||
            message.includes('database disk image is malformed') ||
            message.includes('btreeinitpage') ||
            message.includes('quick_check failed')
        );
    }

    async ensureDatabaseIntegrity() {
        if (!this.db || !this.isNode) return;
        const row = await this.db.get('PRAGMA quick_check');
        const checkValue = row ? String(Object.values(row)[0] ?? '').trim() : '';
        if (!checkValue || checkValue.toLowerCase() === 'ok') return;

        const err = new Error(`SQLite quick_check failed: ${checkValue}`);
        err.code = 'SQLITE_CORRUPT';
        throw err;
    }

    findBackupCandidates() {
        const dir = path.dirname(this.dbPath);
        const base = path.basename(this.dbPath);
        const stem = path.parse(base).name.toLowerCase();

        if (!fs.existsSync(dir)) return [];

        return fs
            .readdirSync(dir)
            .filter((name) => {
                const lower = name.toLowerCase();
                if (name === base) return false;
                if (lower.endsWith('.db-wal') || lower.endsWith('.db-shm')) return false;
                if (lower.endsWith('-wal') || lower.endsWith('-shm')) return false;
                if (lower.includes('.corrupt-')) return false;
                if (!lower.includes(stem)) return false;
                if (lower.includes('test') || lower.includes('corrupt')) return false;
                const looksLikeDb =
                    lower.endsWith('.db') ||
                    /\.db\.bak-\d+$/.test(lower) ||
                    /\.backup\.\d+\.db$/.test(lower) ||
                    /_backup_\d+\.db$/.test(lower);
                if (!looksLikeDb) return false;
                return lower.includes('backup') || lower.includes('.bak');
            })
            .map((name) => {
                const fullPath = path.join(dir, name);
                const mtimeMs = fs.statSync(fullPath).mtimeMs;
                return { fullPath, mtimeMs };
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs)
            .map((entry) => entry.fullPath);
    }

    isBackupHealthy(candidatePath) {
        try {
            const Database = require('better-sqlite3');
            const probe = new Database(candidatePath, { readonly: true, fileMustExist: true });
            const quickCheck = String(probe.pragma('quick_check', { simple: true }) || '').trim().toLowerCase();
            probe.close();
            return quickCheck === 'ok';
        } catch {
            return false;
        }
    }

    archiveCorruptedFiles(timestamp) {
        const relatedFiles = [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`];

        for (const filePath of relatedFiles) {
            if (!fs.existsSync(filePath)) continue;
            const archivedPath = `${filePath}.corrupt-${timestamp}`;
            fs.renameSync(filePath, archivedPath);
            console.warn(`⚠️ Archived corrupted file: ${archivedPath}`);
        }
    }

    async recoverCorruptedDatabase() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }

        const timestamp = Date.now();
        this.archiveCorruptedFiles(timestamp);

        const candidates = this.findBackupCandidates();
        const validBackup = candidates.find((candidate) => this.isBackupHealthy(candidate));

        if (validBackup) {
            fs.copyFileSync(validBackup, this.dbPath);
            console.log(`✅ Restored database from backup: ${validBackup}`);
            return;
        }

        console.error('⚠️ No healthy backup found. Creating a new SQLite database file.');
    }

    async ensureCrmFoundationSchema() {
        if (!this.db) return;
        try {
            const hasTable = async (tableName) => {
                const rows = await this.db.all(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1",
                    [tableName]
                );
                return Boolean(rows && rows[0]);
            };
            const getColumns = async (tableName) => {
                try {
                    const rows = await this.db.all(`PRAGMA table_info(${tableName})`);
                    return Array.isArray(rows) ? rows : [];
                } catch {
                    return [];
                }
            };
            const ensureColumn = async (tableName, columnName, definition) => {
                const cols = await getColumns(tableName);
                const exists = cols.some((col) => String(col.name || '').toLowerCase() === String(columnName || '').toLowerCase());
                if (!exists) {
                    try {
                        await this.db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
                    } catch (error) {
                        const message = String(error?.message || error || '').toLowerCase();
                        if (message.includes('non-constant default')) {
                            const fallbackDefinition = String(definition || '').replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP/ig, '');
                            await this.db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${fallbackDefinition}`);
                            return;
                        }
                        throw error;
                    }
                }
            };

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS customers (
                    id TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    phone TEXT,
                    email TEXT,
                    preferred_channel TEXT DEFAULT 'whatsapp',
                    contact_value TEXT,
                    country TEXT,
                    city TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS leads (
                    id TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    customer_id TEXT,
                    bike_url TEXT,
                    bike_snapshot TEXT,
                    customer_comment TEXT,
                    estimated_budget_eur INTEGER,
                    status TEXT DEFAULT 'new',
                    experience TEXT,
                    usage TEXT,
                    terrain TEXT,
                    features TEXT,
                    preferred_contact TEXT DEFAULT 'phone',
                    contact_method TEXT,
                    contact_value TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY,
                    old_uuid_id TEXT,
                    order_code TEXT UNIQUE NOT NULL,
                    customer_id TEXT,
                    lead_id TEXT,
                    bike_id INTEGER,
                    bike_name TEXT,
                    bike_url TEXT,
                    bike_snapshot TEXT,
                    listing_price_eur REAL,
                    initial_quality TEXT,
                    final_price_eur REAL,
                    commission_eur REAL DEFAULT 0,
                    total_price_rub REAL,
                    booking_price REAL,
                    booking_amount_rub REAL,
                    booking_amount_eur REAL,
                    exchange_rate REAL,
                    delivery_method TEXT,
                    status TEXT DEFAULT 'booked',
                    assigned_manager TEXT,
                    manager_notes TEXT,
                    is_refundable INTEGER DEFAULT 1,
                    magic_link_token TEXT,
                    reserve_enabled INTEGER DEFAULT 0,
                    reserve_paid_at DATETIME,
                    superseded_by_order_id TEXT,
                    cancel_reason_code TEXT,
                    cancel_reason_note TEXT,
                    expert_required INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    closed_at DATETIME,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE SET NULL,
                    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS order_status_events (
                    id TEXT PRIMARY KEY,
                    order_id TEXT,
                    old_status TEXT,
                    new_status TEXT,
                    change_notes TEXT,
                    changed_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS payments (
                    id TEXT PRIMARY KEY,
                    order_id TEXT,
                    direction TEXT NOT NULL,
                    role TEXT NOT NULL,
                    method TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL,
                    status TEXT DEFAULT 'planned',
                    description TEXT,
                    transaction_date DATETIME,
                    external_reference TEXT,
                    related_payment_id TEXT,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(related_payment_id) REFERENCES payments(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS transactions (
                    id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    amount REAL NOT NULL,
                    type TEXT NOT NULL DEFAULT 'payment',
                    method TEXT NOT NULL DEFAULT 'manual',
                    description TEXT,
                    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS shipments (
                    id TEXT PRIMARY KEY,
                    order_id TEXT,
                    provider TEXT DEFAULT 'rusbid',
                    carrier TEXT,
                    tracking_number TEXT,
                    delivery_status TEXT,
                    estimated_delivery TEXT,
                    estimated_delivery_date TEXT,
                    warehouse_received INTEGER DEFAULT 0,
                    warehouse_photos_received INTEGER DEFAULT 0,
                    client_received INTEGER DEFAULT 0,
                    ruspost_status TEXT,
                    ruspost_last_update DATETIME,
                    source_provider TEXT,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    order_id TEXT,
                    title TEXT NOT NULL,
                    description TEXT,
                    due_at DATETIME,
                    completed INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    priority TEXT DEFAULT 'normal',
                    assigned_to TEXT,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS audit_log (
                    id TEXT PRIMARY KEY,
                    actor_id TEXT,
                    action TEXT NOT NULL,
                    entity TEXT NOT NULL,
                    entity_id TEXT,
                    payload TEXT,
                    source TEXT,
                    severity TEXT DEFAULT 'info',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    order_id TEXT,
                    type TEXT NOT NULL,
                    file_url TEXT NOT NULL,
                    status TEXT DEFAULT 'uploaded',
                    metadata TEXT,
                    created_by TEXT,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )`
            );

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS manager_profiles (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    display_name TEXT,
                    channel_primary TEXT DEFAULT 'whatsapp',
                    channel_fallback TEXT DEFAULT 'telegram',
                    is_active INTEGER DEFAULT 1,
                    sla_first_contact_minutes INTEGER DEFAULT 15,
                    sla_response_minutes INTEGER DEFAULT 120,
                    sla_stage_transition_hours INTEGER DEFAULT 24,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS manager_kpi_targets (
                    id TEXT PRIMARY KEY,
                    manager_id TEXT NOT NULL,
                    period_key TEXT NOT NULL,
                    metric_code TEXT NOT NULL,
                    target_value REAL NOT NULL,
                    weight REAL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(manager_id, period_key, metric_code)
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS manager_kpi_snapshots (
                    id TEXT PRIMARY KEY,
                    manager_id TEXT NOT NULL,
                    period_key TEXT NOT NULL,
                    metric_code TEXT NOT NULL,
                    actual_value REAL NOT NULL,
                    target_value REAL,
                    completion_ratio REAL,
                    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(manager_id, period_key, metric_code, captured_at)
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS manager_activity_events (
                    id TEXT PRIMARY KEY,
                    manager_id TEXT NOT NULL,
                    order_id TEXT,
                    event_type TEXT NOT NULL,
                    event_payload TEXT,
                    event_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS order_cases (
                    id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    case_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'opened',
                    reason_code TEXT,
                    reason_text TEXT,
                    opened_by TEXT,
                    resolved_by TEXT,
                    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    resolved_at DATETIME,
                    metadata TEXT,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS refund_requests (
                    id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    case_id TEXT,
                    status TEXT NOT NULL DEFAULT 'pending_review',
                    reason_code TEXT,
                    amount_rub REAL,
                    amount_eur REAL,
                    reserve_action TEXT DEFAULT 'refund_or_transfer',
                    decision_note TEXT,
                    requested_by TEXT,
                    approved_by TEXT,
                    paid_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(case_id) REFERENCES order_cases(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS compensation_requests (
                    id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    case_id TEXT,
                    status TEXT NOT NULL DEFAULT 'pending_review',
                    reason_code TEXT,
                    amount_rub REAL,
                    amount_eur REAL,
                    compensation_type TEXT DEFAULT 'money',
                    decision_note TEXT,
                    requested_by TEXT,
                    approved_by TEXT,
                    settled_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(case_id) REFERENCES order_cases(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS customer_preferences (
                    customer_id TEXT PRIMARY KEY,
                    budget_min_eur REAL,
                    budget_max_eur REAL,
                    preferred_brands_json TEXT,
                    preferred_disciplines_json TEXT,
                    preferred_sizes_json TEXT,
                    preferred_delivery_json TEXT,
                    communication_language TEXT DEFAULT 'ru',
                    timezone TEXT DEFAULT 'Europe/Berlin',
                    communication_notes TEXT,
                    risk_profile TEXT DEFAULT 'balanced',
                    marketing_consent INTEGER DEFAULT 1,
                    priority_criteria_json TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_contact_channels (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    channel TEXT NOT NULL,
                    channel_value TEXT NOT NULL,
                    is_primary INTEGER DEFAULT 0,
                    is_verified INTEGER DEFAULT 0,
                    last_inbound_at DATETIME,
                    last_outbound_at DATETIME,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(customer_id, channel, channel_value),
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS customer_manager_links (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    manager_id TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'owner',
                    is_active INTEGER DEFAULT 1,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    released_at DATETIME,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_touchpoints (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT,
                    lead_id TEXT,
                    order_id TEXT,
                    manager_id TEXT,
                    channel TEXT NOT NULL DEFAULT 'whatsapp',
                    direction TEXT NOT NULL DEFAULT 'outbound',
                    touchpoint_type TEXT NOT NULL DEFAULT 'message',
                    summary TEXT,
                    payload TEXT,
                    happened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    response_due_at DATETIME,
                    responded_at DATETIME,
                    response_sla_minutes INTEGER,
                    is_sla_breached INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE SET NULL,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_journey_events (
                    id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    customer_id TEXT,
                    lead_id TEXT,
                    manager_id TEXT,
                    event_type TEXT NOT NULL,
                    stage_code TEXT,
                    from_status TEXT,
                    to_status TEXT,
                    channel TEXT,
                    source TEXT NOT NULL DEFAULT 'system',
                    payload TEXT,
                    event_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_sla_policies (
                    id TEXT PRIMARY KEY,
                    scope TEXT NOT NULL DEFAULT 'order_status',
                    scope_key TEXT NOT NULL,
                    first_contact_minutes INTEGER,
                    response_minutes INTEGER,
                    transition_hours INTEGER,
                    max_idle_hours INTEGER,
                    is_active INTEGER DEFAULT 1,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(scope, scope_key)
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_order_stage_instances (
                    id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    status_code TEXT NOT NULL,
                    manager_id TEXT,
                    entered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    exited_at DATETIME,
                    duration_minutes REAL,
                    sla_transition_hours REAL,
                    sla_due_at DATETIME,
                    sla_breached_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_manager_followups (
                    id TEXT PRIMARY KEY,
                    order_id TEXT,
                    customer_id TEXT,
                    lead_id TEXT,
                    manager_id TEXT NOT NULL,
                    followup_type TEXT NOT NULL DEFAULT 'client_response',
                    title TEXT NOT NULL,
                    due_at DATETIME NOT NULL,
                    completed_at DATETIME,
                    status TEXT NOT NULL DEFAULT 'pending',
                    source_event_id TEXT,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS manager_kpi_daily_facts (
                    id TEXT PRIMARY KEY,
                    manager_id TEXT NOT NULL,
                    day_key TEXT NOT NULL,
                    metric_code TEXT NOT NULL,
                    metric_value REAL NOT NULL,
                    target_value REAL,
                    weight REAL DEFAULT 1,
                    weighted_score REAL,
                    payload TEXT,
                    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(manager_id, day_key, metric_code)
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS manager_kpi_period_scorecards (
                    id TEXT PRIMARY KEY,
                    manager_id TEXT NOT NULL,
                    period_type TEXT NOT NULL DEFAULT 'month',
                    period_key TEXT NOT NULL,
                    score_total REAL DEFAULT 0,
                    conversion_score REAL DEFAULT 0,
                    sla_score REAL DEFAULT 0,
                    reliability_score REAL DEFAULT 0,
                    quality_score REAL DEFAULT 0,
                    payout_multiplier REAL DEFAULT 1,
                    metrics_payload TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(manager_id, period_type, period_key)
                )`
            );

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_sync_state (
                    table_name TEXT PRIMARY KEY,
                    last_remote_updated_at DATETIME,
                    last_remote_id TEXT,
                    full_synced_at DATETIME,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_sync_outbox (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    payload TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    retry_count INTEGER DEFAULT 0,
                    last_error TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS ai_signals (
                    id TEXT PRIMARY KEY,
                    signal_type TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT 'system',
                    severity TEXT NOT NULL DEFAULT 'medium',
                    status TEXT NOT NULL DEFAULT 'open',
                    owner_circle TEXT NOT NULL DEFAULT 'sales_ops',
                    entity_type TEXT,
                    entity_id TEXT,
                    title TEXT NOT NULL,
                    insight TEXT,
                    target TEXT,
                    payload TEXT,
                    dedupe_key TEXT,
                    assigned_to TEXT,
                    priority_score REAL DEFAULT 0,
                    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    sla_due_at DATETIME,
                    resolved_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS ai_decisions (
                    id TEXT PRIMARY KEY,
                    signal_id TEXT NOT NULL,
                    decision TEXT NOT NULL,
                    note TEXT,
                    actor_id TEXT,
                    payload TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(signal_id) REFERENCES ai_signals(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS ai_assignments (
                    id TEXT PRIMARY KEY,
                    signal_id TEXT NOT NULL,
                    assignee_id TEXT NOT NULL,
                    assigned_by TEXT,
                    status TEXT NOT NULL DEFAULT 'open',
                    due_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(signal_id) REFERENCES ai_signals(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS ai_sla_violations (
                    id TEXT PRIMARY KEY,
                    signal_id TEXT,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    severity TEXT NOT NULL DEFAULT 'high',
                    expected_by DATETIME,
                    breached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    resolved_at DATETIME,
                    status TEXT NOT NULL DEFAULT 'open',
                    payload TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(signal_id) REFERENCES ai_signals(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_holacracy_circles (
                    id TEXT PRIMARY KEY,
                    circle_code TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    purpose TEXT,
                    domain_description TEXT,
                    lead_role_code TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_holacracy_roles (
                    id TEXT PRIMARY KEY,
                    circle_id TEXT NOT NULL,
                    role_code TEXT NOT NULL,
                    title TEXT NOT NULL,
                    purpose TEXT,
                    accountabilities_json TEXT,
                    authorities_json TEXT,
                    role_scope TEXT DEFAULT 'operational',
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(circle_id, role_code),
                    FOREIGN KEY(circle_id) REFERENCES crm_holacracy_circles(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_holacracy_role_assignments (
                    id TEXT PRIMARY KEY,
                    role_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    scope_type TEXT DEFAULT 'global',
                    scope_id TEXT,
                    assignment_kind TEXT DEFAULT 'primary',
                    status TEXT NOT NULL DEFAULT 'active',
                    source TEXT DEFAULT 'manual',
                    assigned_by TEXT,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ended_at DATETIME,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(role_id) REFERENCES crm_holacracy_roles(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_holacracy_tensions (
                    id TEXT PRIMARY KEY,
                    raised_by TEXT NOT NULL,
                    circle_id TEXT,
                    role_id TEXT,
                    related_order_id TEXT,
                    related_customer_id TEXT,
                    related_lead_id TEXT,
                    tension_type TEXT NOT NULL DEFAULT 'process_gap',
                    severity TEXT NOT NULL DEFAULT 'medium',
                    status TEXT NOT NULL DEFAULT 'open',
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    owner_user_id TEXT,
                    owner_circle_code TEXT,
                    due_at DATETIME,
                    resolved_at DATETIME,
                    resolution_note TEXT,
                    ai_signal_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(circle_id) REFERENCES crm_holacracy_circles(id) ON DELETE SET NULL,
                    FOREIGN KEY(role_id) REFERENCES crm_holacracy_roles(id) ON DELETE SET NULL,
                    FOREIGN KEY(related_order_id) REFERENCES orders(id) ON DELETE SET NULL,
                    FOREIGN KEY(related_customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                    FOREIGN KEY(related_lead_id) REFERENCES leads(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_holacracy_tension_events (
                    id TEXT PRIMARY KEY,
                    tension_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    actor_id TEXT,
                    payload TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(tension_id) REFERENCES crm_holacracy_tensions(id) ON DELETE CASCADE
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_holacracy_parking_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    from_role_id TEXT,
                    from_circle_id TEXT,
                    reason_code TEXT NOT NULL DEFAULT 'role_mismatch',
                    status TEXT NOT NULL DEFAULT 'active',
                    target_role_id TEXT,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    support_plan TEXT,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(from_role_id) REFERENCES crm_holacracy_roles(id) ON DELETE SET NULL,
                    FOREIGN KEY(from_circle_id) REFERENCES crm_holacracy_circles(id) ON DELETE SET NULL,
                    FOREIGN KEY(target_role_id) REFERENCES crm_holacracy_roles(id) ON DELETE SET NULL
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS crm_holacracy_member_profiles (
                    user_id TEXT PRIMARY KEY,
                    ambition_statement TEXT,
                    strengths_json TEXT,
                    preferred_roles_json TEXT,
                    growth_goal TEXT,
                    autonomy_level TEXT DEFAULT 'standard',
                    match_score REAL DEFAULT 50,
                    last_review_at DATETIME,
                    next_review_due_at DATETIME,
                    review_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );

            // Legacy table compat: add missing columns to already existing deployments.
            if (await hasTable('customers')) {
                await ensureColumn('customers', 'contact_value', 'TEXT');
                await ensureColumn('customers', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
                await ensureColumn('customers', 'first_contact_at', 'DATETIME');
                await ensureColumn('customers', 'last_contact_at', 'DATETIME');
                await ensureColumn('customers', 'last_inbound_contact_at', 'DATETIME');
                await ensureColumn('customers', 'last_outbound_contact_at', 'DATETIME');
                await ensureColumn('customers', 'contact_count', 'INTEGER DEFAULT 0');
                await ensureColumn('customers', 'segment', 'TEXT');
                await ensureColumn('customers', 'lifecycle_stage', 'TEXT');
                await ensureColumn('customers', 'timezone', 'TEXT');
                await ensureColumn('customers', 'language', 'TEXT');
                await ensureColumn('customers', 'notes_private', 'TEXT');
            }
            if (await hasTable('leads')) {
                await ensureColumn('leads', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
                await ensureColumn('leads', 'source_channel', 'TEXT');
                await ensureColumn('leads', 'pipeline_owner', 'TEXT');
                await ensureColumn('leads', 'attribution_session_id', 'TEXT');
                await ensureColumn('leads', 'last_contact_at', 'DATETIME');
                await ensureColumn('leads', 'qualified_at', 'DATETIME');
                await ensureColumn('leads', 'converted_order_id', 'TEXT');
                await ensureColumn('leads', 'converted_at', 'DATETIME');
            }
            if (await hasTable('orders')) {
                await ensureColumn('orders', 'old_uuid_id', 'TEXT');
                await ensureColumn('orders', 'bike_name', 'TEXT');
                await ensureColumn('orders', 'listing_price_eur', 'REAL');
                await ensureColumn('orders', 'initial_quality', 'TEXT');
                await ensureColumn('orders', 'total_price_rub', 'REAL');
                await ensureColumn('orders', 'booking_amount_rub', 'REAL');
                await ensureColumn('orders', 'booking_amount_eur', 'REAL');
                await ensureColumn('orders', 'exchange_rate', 'REAL');
                await ensureColumn('orders', 'delivery_method', 'TEXT');
                await ensureColumn('orders', 'magic_link_token', 'TEXT');
                await ensureColumn('orders', 'manager_notes', 'TEXT');
                await ensureColumn('orders', 'reserve_enabled', 'INTEGER DEFAULT 0');
                await ensureColumn('orders', 'reserve_paid_at', 'DATETIME');
                await ensureColumn('orders', 'superseded_by_order_id', 'TEXT');
                await ensureColumn('orders', 'cancel_reason_code', 'TEXT');
                await ensureColumn('orders', 'cancel_reason_note', 'TEXT');
                await ensureColumn('orders', 'expert_required', 'INTEGER DEFAULT 0');
                await ensureColumn('orders', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
                await ensureColumn('orders', 'closed_at', 'DATETIME');
                await ensureColumn('orders', 'created_via', 'TEXT');
                await ensureColumn('orders', 'reserved_queue_position', 'INTEGER');
                await ensureColumn('orders', 'first_manager_contact_at', 'DATETIME');
                await ensureColumn('orders', 'last_manager_contact_at', 'DATETIME');
                await ensureColumn('orders', 'manager_contact_count', 'INTEGER DEFAULT 0');
                await ensureColumn('orders', 'next_action_due_at', 'DATETIME');
                await ensureColumn('orders', 'last_activity_at', 'DATETIME');
                await ensureColumn('orders', 'is_stalled', 'INTEGER DEFAULT 0');
                await ensureColumn('orders', 'stalled_since', 'DATETIME');
                await ensureColumn('orders', 'status_entered_at', 'DATETIME');
                await ensureColumn('orders', 'sla_stage_due_at', 'DATETIME');
                await ensureColumn('orders', 'sla_stage_breached_at', 'DATETIME');
                await ensureColumn('orders', 'customer_last_channel', 'TEXT');
                await ensureColumn('orders', 'reserve_superseded_count', 'INTEGER DEFAULT 0');
            }
            if (await hasTable('order_status_events')) {
                await ensureColumn('order_status_events', 'change_notes', 'TEXT');
                await ensureColumn('order_status_events', 'event_kind', 'TEXT');
                await ensureColumn('order_status_events', 'source', 'TEXT');
                await ensureColumn('order_status_events', 'metadata', 'TEXT');
            }
            if (await hasTable('payments')) {
                await ensureColumn('payments', 'description', 'TEXT');
                await ensureColumn('payments', 'transaction_date', 'DATETIME');
                await ensureColumn('payments', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('shipments')) {
                await ensureColumn('shipments', 'carrier', 'TEXT');
                await ensureColumn('shipments', 'delivery_status', 'TEXT');
                await ensureColumn('shipments', 'estimated_delivery', 'TEXT');
                await ensureColumn('shipments', 'source_provider', 'TEXT');
                await ensureColumn('shipments', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('tasks')) {
                await ensureColumn('tasks', 'status', 'TEXT DEFAULT \'pending\'');
                await ensureColumn('tasks', 'priority', 'TEXT DEFAULT \'normal\'');
                await ensureColumn('tasks', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('audit_log')) {
                await ensureColumn('audit_log', 'source', 'TEXT');
                await ensureColumn('audit_log', 'severity', 'TEXT DEFAULT \'info\'');
            }
            if (await hasTable('documents')) {
                await ensureColumn('documents', 'status', 'TEXT DEFAULT \'uploaded\'');
                await ensureColumn('documents', 'metadata', 'TEXT');
            }
            if (await hasTable('ai_signals')) {
                await ensureColumn('ai_signals', 'priority_score', 'REAL DEFAULT 0');
                await ensureColumn('ai_signals', 'resolved_at', 'DATETIME');
                await ensureColumn('ai_signals', 'assigned_to', 'TEXT');
                await ensureColumn('ai_signals', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('ai_decisions')) {
                await ensureColumn('ai_decisions', 'payload', 'TEXT');
            }
            if (await hasTable('ai_assignments')) {
                await ensureColumn('ai_assignments', 'status', 'TEXT DEFAULT \'open\'');
                await ensureColumn('ai_assignments', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('ai_sla_violations')) {
                await ensureColumn('ai_sla_violations', 'payload', 'TEXT');
                await ensureColumn('ai_sla_violations', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('manager_profiles')) {
                await ensureColumn('manager_profiles', 'circle_code', 'TEXT');
                await ensureColumn('manager_profiles', 'parking_state', 'TEXT DEFAULT \'active\'');
                await ensureColumn('manager_profiles', 'autonomy_level', 'TEXT DEFAULT \'standard\'');
            }
            if (await hasTable('manager_activity_events')) {
                await ensureColumn('manager_activity_events', 'lead_id', 'TEXT');
                await ensureColumn('manager_activity_events', 'customer_id', 'TEXT');
                await ensureColumn('manager_activity_events', 'channel', 'TEXT');
                await ensureColumn('manager_activity_events', 'action_result', 'TEXT');
                await ensureColumn('manager_activity_events', 'action_duration_seconds', 'INTEGER');
                await ensureColumn('manager_activity_events', 'is_sla_hit', 'INTEGER');
                await ensureColumn('manager_activity_events', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
                await ensureColumn('manager_activity_events', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('crm_holacracy_tensions')) {
                await ensureColumn('crm_holacracy_tensions', 'owner_circle_code', 'TEXT');
                await ensureColumn('crm_holacracy_tensions', 'ai_signal_id', 'TEXT');
                await ensureColumn('crm_holacracy_tensions', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('crm_holacracy_parking_sessions')) {
                await ensureColumn('crm_holacracy_parking_sessions', 'status', 'TEXT DEFAULT \'active\'');
                await ensureColumn('crm_holacracy_parking_sessions', 'support_plan', 'TEXT');
                await ensureColumn('crm_holacracy_parking_sessions', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            if (await hasTable('crm_holacracy_member_profiles')) {
                await ensureColumn('crm_holacracy_member_profiles', 'autonomy_level', 'TEXT DEFAULT \'standard\'');
                await ensureColumn('crm_holacracy_member_profiles', 'match_score', 'REAL DEFAULT 50');
                await ensureColumn('crm_holacracy_member_profiles', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            }

            await this.db.run('CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_assigned_manager ON orders(assigned_manager)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_last_manager_contact ON orders(last_manager_contact_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_next_action_due ON orders(next_action_due_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_stalled ON orders(is_stalled, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_order_events_order_created ON order_status_events(order_id, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_payments_order_created ON payments(order_id, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_order_date ON transactions(order_id, transaction_date)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_shipments_order_created ON shipments(order_id, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_tasks_order_due ON tasks(order_id, due_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_refunds_order_status ON refund_requests(order_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_compensation_order_status ON compensation_requests(order_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_cases_order_status ON order_cases(order_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_touchpoints_order_happened ON crm_touchpoints(order_id, happened_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_touchpoints_customer_happened ON crm_touchpoints(customer_id, happened_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_touchpoints_manager_happened ON crm_touchpoints(manager_id, happened_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_touchpoints_response_due ON crm_touchpoints(response_due_at, is_sla_breached)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_journey_order_event_at ON crm_journey_events(order_id, event_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_journey_type_event_at ON crm_journey_events(event_type, event_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_stage_instances_order_entered ON crm_order_stage_instances(order_id, entered_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_stage_instances_open ON crm_order_stage_instances(order_id, exited_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_stage_instances_sla_due ON crm_order_stage_instances(sla_due_at, sla_breached_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_followups_manager_due ON crm_manager_followups(manager_id, due_at, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_followups_order_status ON crm_manager_followups(order_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_manager_activity_manager_event_at ON manager_activity_events(manager_id, event_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_manager_activity_order_event_at ON manager_activity_events(order_id, event_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_manager_daily_facts_mgr_day ON manager_kpi_daily_facts(manager_id, day_key)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_manager_scorecards_mgr_period ON manager_kpi_period_scorecards(manager_id, period_type, period_key)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_sync_outbox_status_created ON crm_sync_outbox(status, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_ai_signals_status_severity ON ai_signals(status, severity, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_ai_signals_entity ON ai_signals(entity_type, entity_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_ai_signals_dedupe ON ai_signals(dedupe_key)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_ai_decisions_signal_created ON ai_decisions(signal_id, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_ai_assignments_assignee_status ON ai_assignments(assignee_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_ai_sla_status_expected ON ai_sla_violations(status, expected_by)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_circles_code ON crm_holacracy_circles(circle_code)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_roles_circle_active ON crm_holacracy_roles(circle_id, is_active)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_assignments_role_status ON crm_holacracy_role_assignments(role_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_assignments_user_status ON crm_holacracy_role_assignments(user_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_tensions_status_due ON crm_holacracy_tensions(status, due_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_tensions_owner_status ON crm_holacracy_tensions(owner_user_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_tensions_circle_status ON crm_holacracy_tensions(circle_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_tension_events_tid_created ON crm_holacracy_tension_events(tension_id, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_parking_user_status ON crm_holacracy_parking_sessions(user_id, status)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_hola_parking_status_started ON crm_holacracy_parking_sessions(status, started_at)');

            const defaultSlaPolicies = [
                { scope: 'order_status', scopeKey: 'booked', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'New booking must be contacted quickly' },
                { scope: 'order_status', scopeKey: 'reserve_payment_pending', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'Reserve follow-up pending' },
                { scope: 'order_status', scopeKey: 'reserve_paid', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'Reserve paid, move to seller checks' },
                { scope: 'order_status', scopeKey: 'seller_check_in_progress', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'Seller checks in progress' },
                { scope: 'order_status', scopeKey: 'check_ready', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'Check report must be handed to client' },
                { scope: 'order_status', scopeKey: 'awaiting_client_decision', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 48, notes: 'Client decision waiting state' },
                { scope: 'order_status', scopeKey: 'full_payment_pending', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 48, notes: 'Payment follow-up window' },
                { scope: 'order_status', scopeKey: 'full_payment_received', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'Move to buyout' },
                { scope: 'order_status', scopeKey: 'bike_buyout_completed', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'Move to seller shipment' },
                { scope: 'order_status', scopeKey: 'seller_shipped', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 48, notes: 'Transit in Europe' },
                { scope: 'order_status', scopeKey: 'expert_received', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'Expert branch starts' },
                { scope: 'order_status', scopeKey: 'expert_inspection_in_progress', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 48, notes: 'Inspection execution window' },
                { scope: 'order_status', scopeKey: 'expert_report_ready', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 24, notes: 'Deliver report to client' },
                { scope: 'order_status', scopeKey: 'awaiting_client_decision_post_inspection', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 48, notes: 'Client decision after expert report' },
                { scope: 'order_status', scopeKey: 'warehouse_received', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 48, notes: 'Warehouse received' },
                { scope: 'order_status', scopeKey: 'warehouse_repacked', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 24, maxIdleHours: 48, notes: 'Warehouse repack window' },
                { scope: 'order_status', scopeKey: 'shipped_to_russia', firstContactMinutes: 15, responseMinutes: 120, transitionHours: 72, maxIdleHours: 168, notes: 'Long transit window' },
                { scope: 'touchpoint', scopeKey: 'client_response', firstContactMinutes: 15, responseMinutes: 120, transitionHours: null, maxIdleHours: 24, notes: 'Client response SLA policy' },
                { scope: 'tension_severity', scopeKey: 'critical', firstContactMinutes: null, responseMinutes: null, transitionHours: 0.25, maxIdleHours: 1, notes: 'Critical tension must be owned within 15 minutes' },
                { scope: 'tension_severity', scopeKey: 'high', firstContactMinutes: null, responseMinutes: null, transitionHours: 2, maxIdleHours: 4, notes: 'High tension must be resolved quickly' },
                { scope: 'tension_severity', scopeKey: 'medium', firstContactMinutes: null, responseMinutes: null, transitionHours: 24, maxIdleHours: 48, notes: 'Medium tension default SLA' },
                { scope: 'tension_severity', scopeKey: 'low', firstContactMinutes: null, responseMinutes: null, transitionHours: 72, maxIdleHours: 168, notes: 'Low tension can wait weekly review' }
            ];

            for (const policy of defaultSlaPolicies) {
                await this.db.run(
                    `INSERT OR IGNORE INTO crm_sla_policies
                     (id, scope, scope_key, first_contact_minutes, response_minutes, transition_hours, max_idle_hours, is_active, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                    [
                        `SLA-${policy.scope}-${policy.scopeKey}`,
                        policy.scope,
                        policy.scopeKey,
                        policy.firstContactMinutes,
                        policy.responseMinutes,
                        policy.transitionHours,
                        policy.maxIdleHours,
                        policy.notes || null
                    ]
                );
            }

            const defaultHolacracyCircles = [
                {
                    code: 'brand_growth',
                    title: 'Brand & Growth Circle',
                    purpose: 'Generate high-quality demand and keep truthful positioning',
                    domain: 'Acquisition, brand message, lead quality',
                    leadRoleCode: 'circle_lead'
                },
                {
                    code: 'sales_opening',
                    title: 'Sales Opening Circle',
                    purpose: 'Convert booked orders to paid and trusted deals',
                    domain: 'Lead handling, client dialogue, payment conversion',
                    leadRoleCode: 'circle_lead'
                },
                {
                    code: 'delivery_ops',
                    title: 'Delivery Operations Circle',
                    purpose: 'Move every paid order through logistics without surprises',
                    domain: 'Buyout, inspection branch, warehouse, shipping',
                    leadRoleCode: 'circle_lead'
                },
                {
                    code: 'client_care',
                    title: 'Client Care Circle',
                    purpose: 'Protect post-sale trust and resolve complaints fast',
                    domain: 'Support, claims, compensation, loyalty',
                    leadRoleCode: 'circle_lead'
                },
                {
                    code: 'risk_compliance',
                    title: 'Risk & Compliance Circle',
                    purpose: 'Keep sanctions/customs and legal risk under control',
                    domain: 'Compliance checks, policy, legal and payment risk',
                    leadRoleCode: 'circle_lead'
                },
                {
                    code: 'governance',
                    title: 'Governance Circle',
                    purpose: 'Process tensions into structural improvements',
                    domain: 'Role architecture, tensions, parking and operating constitution',
                    leadRoleCode: 'circle_lead'
                }
            ];

            for (const circle of defaultHolacracyCircles) {
                await this.db.run(
                    `INSERT OR IGNORE INTO crm_holacracy_circles
                     (id, circle_code, title, purpose, domain_description, lead_role_code, is_active, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [
                        `HC-${circle.code}`,
                        circle.code,
                        circle.title,
                        circle.purpose,
                        circle.domain,
                        circle.leadRoleCode
                    ]
                );
            }

            const defaultHolacracyRoles = [
                { circleCode: 'sales_opening', roleCode: 'circle_lead', title: 'Circle Lead', scope: 'governance', accountabilities: ['Sets focus and resolves role collisions', 'Maintains role health and capacity'] },
                { circleCode: 'sales_opening', roleCode: 'deal_owner', title: 'Deal Owner', scope: 'operational', accountabilities: ['Owns order from booked to payment', 'Keeps client communication continuity'] },
                { circleCode: 'sales_opening', roleCode: 'sla_guardian', title: 'SLA Guardian', scope: 'operational', accountabilities: ['Monitors response and stage deadlines', 'Escalates delays before SLA breach'] },
                { circleCode: 'delivery_ops', roleCode: 'flow_operator', title: 'Flow Operator', scope: 'operational', accountabilities: ['Controls buyout and shipping transitions', 'Ensures logistics milestones are logged'] },
                { circleCode: 'client_care', roleCode: 'client_advocate', title: 'Client Advocate', scope: 'operational', accountabilities: ['Handles complaints and quality cases', 'Keeps client trust after delivery'] },
                { circleCode: 'risk_compliance', roleCode: 'compliance_partner', title: 'Compliance Partner', scope: 'operational', accountabilities: ['Checks sanctions/customs constraints', 'Approves high-risk scenarios'] },
                { circleCode: 'governance', roleCode: 'tension_facilitator', title: 'Tension Facilitator', scope: 'governance', accountabilities: ['Processes tensions into concrete actions', 'Tracks parking sessions and role redesign'] }
            ];

            for (const role of defaultHolacracyRoles) {
                await this.db.run(
                    `INSERT OR IGNORE INTO crm_holacracy_roles
                     (id, circle_id, role_code, title, purpose, accountabilities_json, authorities_json, role_scope, is_active, created_at, updated_at)
                     SELECT ?, c.id, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                     FROM crm_holacracy_circles c
                     WHERE c.circle_code = ?
                     LIMIT 1`,
                    [
                        `HR-${role.circleCode}-${role.roleCode}`,
                        role.roleCode,
                        role.title,
                        role.title,
                        JSON.stringify(role.accountabilities || []),
                        JSON.stringify([]),
                        role.scope,
                        role.circleCode
                    ]
                );
            }

            await this.db.run(
                `CREATE VIEW IF NOT EXISTS crm_order_360_v AS
                 SELECT
                    o.id AS order_id,
                    o.order_code,
                    o.customer_id,
                    o.lead_id,
                    o.status,
                    o.assigned_manager,
                    o.created_at,
                    o.updated_at,
                    o.last_manager_contact_at,
                    o.next_action_due_at,
                    o.is_stalled,
                    o.sla_stage_due_at,
                    o.sla_stage_breached_at,
                    (SELECT MAX(tp.happened_at) FROM crm_touchpoints tp WHERE tp.order_id = o.id) AS last_touchpoint_at,
                    (SELECT COUNT(*) FROM crm_touchpoints tp WHERE tp.order_id = o.id) AS touchpoints_total,
                    (SELECT COUNT(*) FROM crm_manager_followups f WHERE f.order_id = o.id AND f.status = 'pending') AS pending_followups,
                    (SELECT si.status_code FROM crm_order_stage_instances si WHERE si.order_id = o.id AND si.exited_at IS NULL ORDER BY si.entered_at DESC LIMIT 1) AS active_stage_code,
                    (SELECT MAX(ev.event_at) FROM crm_journey_events ev WHERE ev.order_id = o.id) AS last_cjm_event_at
                 FROM orders o`
            );

            await this.db.run(
                `CREATE VIEW IF NOT EXISTS crm_customer_360_v AS
                 SELECT
                    c.id AS customer_id,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.preferred_channel,
                    c.last_contact_at,
                    c.contact_count,
                    c.segment,
                    c.lifecycle_stage,
                    c.created_at,
                    (SELECT COUNT(*) FROM leads l WHERE l.customer_id = c.id) AS leads_total,
                    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders_total,
                    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status NOT IN ('delivered', 'closed', 'cancelled')) AS open_orders_total,
                    (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order_at
                 FROM customers c`
            );

            await this.db.run(
                `CREATE VIEW IF NOT EXISTS crm_manager_workload_live_v AS
                 SELECT
                    COALESCE(CAST(o.assigned_manager AS TEXT), 'unassigned') AS manager_id,
                    COUNT(*) AS orders_total,
                    SUM(CASE WHEN o.status IN ('delivered', 'closed') THEN 1 ELSE 0 END) AS done_orders,
                    SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
                    SUM(CASE WHEN o.status NOT IN ('delivered', 'closed', 'cancelled') THEN 1 ELSE 0 END) AS active_orders,
                    SUM(CASE WHEN COALESCE(o.is_stalled, 0) = 1 THEN 1 ELSE 0 END) AS stalled_orders,
                    MAX(o.last_manager_contact_at) AS last_manager_touch
                 FROM orders o
                 GROUP BY COALESCE(CAST(o.assigned_manager AS TEXT), 'unassigned')`
            );
            await this.db.run(
                `CREATE VIEW IF NOT EXISTS crm_holacracy_role_coverage_v AS
                 SELECT
                    c.circle_code,
                    c.title AS circle_title,
                    r.id AS role_id,
                    r.role_code,
                    r.title AS role_title,
                    r.role_scope,
                    SUM(CASE WHEN a.status = 'active' AND a.ended_at IS NULL THEN 1 ELSE 0 END) AS active_assignees,
                    MAX(a.started_at) AS last_assigned_at
                 FROM crm_holacracy_roles r
                 JOIN crm_holacracy_circles c ON c.id = r.circle_id
                 LEFT JOIN crm_holacracy_role_assignments a ON a.role_id = r.id
                 WHERE COALESCE(r.is_active, 1) = 1
                 GROUP BY c.circle_code, c.title, r.id, r.role_code, r.title, r.role_scope`
            );
            await this.db.run(
                `CREATE VIEW IF NOT EXISTS crm_holacracy_tensions_live_v AS
                 SELECT
                    t.id AS tension_id,
                    t.tension_type,
                    t.severity,
                    t.status,
                    t.title,
                    t.owner_user_id,
                    t.owner_circle_code,
                    t.related_order_id,
                    t.related_customer_id,
                    t.related_lead_id,
                    t.due_at,
                    t.created_at,
                    t.resolved_at,
                    c.circle_code,
                    c.title AS circle_title,
                    r.role_code,
                    r.title AS role_title,
                    CASE
                        WHEN t.status = 'resolved' THEN 0
                        WHEN t.due_at IS NOT NULL AND datetime('now') > datetime(t.due_at) THEN 1
                        ELSE 0
                    END AS is_overdue
                 FROM crm_holacracy_tensions t
                 LEFT JOIN crm_holacracy_circles c ON c.id = t.circle_id
                 LEFT JOIN crm_holacracy_roles r ON r.id = t.role_id`
            );

            await this.db.run(
                `CREATE TRIGGER IF NOT EXISTS trg_orders_stage_on_insert
                 AFTER INSERT ON orders
                 BEGIN
                    UPDATE orders
                    SET status_entered_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
                        last_activity_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
                        sla_stage_due_at = (
                            SELECT CASE
                                WHEN p.transition_hours IS NOT NULL THEN datetime(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), '+' || p.transition_hours || ' hours')
                                ELSE NULL
                            END
                            FROM crm_sla_policies p
                            WHERE p.scope = 'order_status' AND p.scope_key = NEW.status AND p.is_active = 1
                            LIMIT 1
                        ),
                        sla_stage_breached_at = NULL
                    WHERE id = NEW.id;

                    INSERT INTO crm_order_stage_instances (
                        id, order_id, status_code, manager_id, entered_at, sla_transition_hours, sla_due_at
                    )
                    VALUES (
                        'CSI-' || lower(hex(randomblob(12))),
                        NEW.id,
                        NEW.status,
                        NEW.assigned_manager,
                        COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
                        (SELECT p.transition_hours FROM crm_sla_policies p WHERE p.scope = 'order_status' AND p.scope_key = NEW.status AND p.is_active = 1 LIMIT 1),
                        (SELECT CASE
                            WHEN p.transition_hours IS NOT NULL THEN datetime(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), '+' || p.transition_hours || ' hours')
                            ELSE NULL
                        END
                        FROM crm_sla_policies p
                        WHERE p.scope = 'order_status' AND p.scope_key = NEW.status AND p.is_active = 1
                        LIMIT 1)
                    );

                    INSERT INTO crm_journey_events (
                        id, order_id, customer_id, lead_id, manager_id, event_type, stage_code, to_status, source, payload, event_at
                    )
                    VALUES (
                        'CJE-' || lower(hex(randomblob(12))),
                        NEW.id,
                        NEW.customer_id,
                        NEW.lead_id,
                        NEW.assigned_manager,
                        'order_created',
                        NEW.status,
                        NEW.status,
                        'system_trigger',
                        'created_via=' || COALESCE(NEW.created_via, 'unknown'),
                        COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
                    );
                 END`
            );

            await this.db.run(
                `CREATE TRIGGER IF NOT EXISTS trg_orders_stage_on_status_update
                 AFTER UPDATE OF status ON orders
                 WHEN COALESCE(NEW.status, '') <> COALESCE(OLD.status, '')
                 BEGIN
                    UPDATE crm_order_stage_instances
                    SET exited_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
                        updated_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
                        duration_minutes = ((julianday(COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)) - julianday(entered_at)) * 24.0 * 60.0),
                        sla_breached_at = CASE
                            WHEN sla_due_at IS NOT NULL AND julianday(COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)) > julianday(sla_due_at)
                                THEN COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
                            ELSE sla_breached_at
                        END
                    WHERE order_id = NEW.id AND exited_at IS NULL;

                    INSERT INTO crm_order_stage_instances (
                        id, order_id, status_code, manager_id, entered_at, sla_transition_hours, sla_due_at
                    )
                    VALUES (
                        'CSI-' || lower(hex(randomblob(12))),
                        NEW.id,
                        NEW.status,
                        NEW.assigned_manager,
                        COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
                        (SELECT p.transition_hours FROM crm_sla_policies p WHERE p.scope = 'order_status' AND p.scope_key = NEW.status AND p.is_active = 1 LIMIT 1),
                        (SELECT CASE
                            WHEN p.transition_hours IS NOT NULL THEN datetime(COALESCE(NEW.updated_at, CURRENT_TIMESTAMP), '+' || p.transition_hours || ' hours')
                            ELSE NULL
                        END
                        FROM crm_sla_policies p
                        WHERE p.scope = 'order_status' AND p.scope_key = NEW.status AND p.is_active = 1
                        LIMIT 1)
                    );

                    UPDATE orders
                    SET status_entered_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
                        last_activity_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
                        sla_stage_due_at = (
                            SELECT CASE
                                WHEN p.transition_hours IS NOT NULL THEN datetime(COALESCE(NEW.updated_at, CURRENT_TIMESTAMP), '+' || p.transition_hours || ' hours')
                                ELSE NULL
                            END
                            FROM crm_sla_policies p
                            WHERE p.scope = 'order_status' AND p.scope_key = NEW.status AND p.is_active = 1
                            LIMIT 1
                        ),
                        sla_stage_breached_at = NULL
                    WHERE id = NEW.id;

                    INSERT INTO crm_journey_events (
                        id, order_id, customer_id, lead_id, manager_id, event_type, stage_code, from_status, to_status, source, payload, event_at
                    )
                    VALUES (
                        'CJE-' || lower(hex(randomblob(12))),
                        NEW.id,
                        NEW.customer_id,
                        NEW.lead_id,
                        NEW.assigned_manager,
                        'status_changed',
                        NEW.status,
                        OLD.status,
                        NEW.status,
                        'system_trigger',
                        'old_status=' || COALESCE(OLD.status, '') || ';new_status=' || COALESCE(NEW.status, ''),
                        COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
                    );
                 END`
            );

            await this.db.run(
                `CREATE TRIGGER IF NOT EXISTS trg_touchpoints_rollup
                 AFTER INSERT ON crm_touchpoints
                 BEGIN
                    UPDATE customers
                    SET last_contact_at = COALESCE(NEW.happened_at, CURRENT_TIMESTAMP),
                        contact_count = COALESCE(contact_count, 0) + 1,
                        last_inbound_contact_at = CASE
                            WHEN lower(COALESCE(NEW.direction, '')) = 'inbound' THEN COALESCE(NEW.happened_at, CURRENT_TIMESTAMP)
                            ELSE last_inbound_contact_at
                        END,
                        last_outbound_contact_at = CASE
                            WHEN lower(COALESCE(NEW.direction, '')) = 'outbound' THEN COALESCE(NEW.happened_at, CURRENT_TIMESTAMP)
                            ELSE last_outbound_contact_at
                        END
                    WHERE id = NEW.customer_id;

                    UPDATE orders
                    SET first_manager_contact_at = CASE
                            WHEN lower(COALESCE(NEW.direction, '')) = 'outbound' AND first_manager_contact_at IS NULL
                                THEN COALESCE(NEW.happened_at, CURRENT_TIMESTAMP)
                            ELSE first_manager_contact_at
                        END,
                        last_manager_contact_at = CASE
                            WHEN lower(COALESCE(NEW.direction, '')) = 'outbound'
                                THEN COALESCE(NEW.happened_at, CURRENT_TIMESTAMP)
                            ELSE last_manager_contact_at
                        END,
                        manager_contact_count = CASE
                            WHEN lower(COALESCE(NEW.direction, '')) = 'outbound'
                                THEN COALESCE(manager_contact_count, 0) + 1
                            ELSE COALESCE(manager_contact_count, 0)
                        END,
                        customer_last_channel = COALESCE(NEW.channel, customer_last_channel),
                        last_activity_at = COALESCE(NEW.happened_at, CURRENT_TIMESTAMP)
                    WHERE id = NEW.order_id;
                 END`
            );
        } catch (e) {
            console.warn(`⚠️ CRM foundation migration warning: ${e.message || e}`);
        }
    }

    async ensureMetricsFoundationSchema() {
        if (!this.db) return;
        try {
            let cols = await this.db.all('PRAGMA table_info(metric_events)');
            if (!cols || cols.length === 0) return;

            const bikeCol = cols.find((c) => c.name === 'bike_id');
            const typeCol = cols.find((c) => c.name === 'type');
            const needsLegacyRebuild = Number(bikeCol?.notnull || 0) === 1 || Number(typeCol?.notnull || 0) === 1;

            if (needsLegacyRebuild) {
                await this.db.exec('PRAGMA foreign_keys = OFF');
                try {
                    await this.db.exec(
                        `CREATE TABLE IF NOT EXISTS metric_events_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            bike_id INTEGER,
                            event_type TEXT NOT NULL,
                            value INTEGER DEFAULT 1,
                            metadata TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            session_id TEXT,
                            referrer TEXT,
                            source_path TEXT,
                            event_id TEXT,
                            dwell_ms INTEGER,
                            user_id INTEGER,
                            person_key TEXT,
                            FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                        )`
                    );
                    await this.db.exec(
                        `INSERT INTO metric_events_new (
                            id, bike_id, event_type, value, metadata, created_at, session_id, referrer, source_path, event_id, dwell_ms, user_id, person_key
                        )
                        SELECT
                            id,
                            CASE WHEN bike_id IS NULL OR bike_id = 0 THEN NULL ELSE bike_id END,
                            COALESCE(event_type, type, 'unknown'),
                            COALESCE(value, 1),
                            metadata,
                            COALESCE(created_at, ts, datetime('now')),
                            session_id,
                            referrer,
                            source_path,
                            event_id,
                            dwell_ms,
                            user_id,
                            person_key
                        FROM metric_events`
                    );
                    await this.db.exec('DROP TABLE metric_events');
                    await this.db.exec('ALTER TABLE metric_events_new RENAME TO metric_events');
                } finally {
                    await this.db.exec('PRAGMA foreign_keys = ON');
                }
                cols = await this.db.all('PRAGMA table_info(metric_events)');
                console.log('? Rebuilt legacy metric_events schema for nullable bike_id compatibility');
            }

            const hasEventType = cols.some(c => c.name === 'event_type');
            const hasType = cols.some(c => c.name === 'type');
            const hasEventId = cols.some(c => c.name === 'event_id');
            const hasPersonKey = cols.some(c => c.name === 'person_key');
            if (!hasEventType) {
                await this.db.run('ALTER TABLE metric_events ADD COLUMN event_type TEXT');
                console.log('? Added event_type to metric_events');
            }
            if (!hasEventId) {
                await this.db.run('ALTER TABLE metric_events ADD COLUMN event_id TEXT');
                console.log('? Added event_id to metric_events');
            }
            if (!hasPersonKey) {
                await this.db.run('ALTER TABLE metric_events ADD COLUMN person_key TEXT');
                console.log('? Added person_key to metric_events');
            }
            if (hasType) {
                await this.db.run('UPDATE metric_events SET event_type = COALESCE(event_type, type) WHERE event_type IS NULL');
            }
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metric_events_type_created ON metric_events(event_type, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metric_events_event_id ON metric_events(event_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metric_events_session_created ON metric_events(session_id, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metric_events_person_created ON metric_events(person_key, created_at)');

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS metrics_session_facts (
                    session_id TEXT PRIMARY KEY,
                    person_key TEXT,
                    user_id INTEGER,
                    crm_lead_id TEXT,
                    customer_email_hash TEXT,
                    customer_phone_hash TEXT,
                    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    event_count INTEGER DEFAULT 0,
                    page_views INTEGER DEFAULT 0,
                    first_clicks INTEGER DEFAULT 0,
                    catalog_views INTEGER DEFAULT 0,
                    product_views INTEGER DEFAULT 0,
                    add_to_cart INTEGER DEFAULT 0,
                    checkout_starts INTEGER DEFAULT 0,
                    checkout_steps INTEGER DEFAULT 0,
                    checkout_validation_errors INTEGER DEFAULT 0,
                    checkout_submit_attempts INTEGER DEFAULT 0,
                    checkout_submit_success INTEGER DEFAULT 0,
                    checkout_submit_failed INTEGER DEFAULT 0,
                    forms_seen INTEGER DEFAULT 0,
                    forms_first_input INTEGER DEFAULT 0,
                    form_submit_attempts INTEGER DEFAULT 0,
                    form_validation_errors INTEGER DEFAULT 0,
                    booking_starts INTEGER DEFAULT 0,
                    booking_success INTEGER DEFAULT 0,
                    orders INTEGER DEFAULT 0,
                    dwell_ms_sum INTEGER DEFAULT 0,
                    first_source_path TEXT,
                    last_source_path TEXT,
                    entry_referrer TEXT,
                    utm_source TEXT,
                    utm_medium TEXT,
                    utm_campaign TEXT,
                    click_id TEXT,
                    landing_path TEXT,
                    is_bot INTEGER DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_session_facts_user ON metrics_session_facts(user_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_session_facts_last_seen ON metrics_session_facts(last_seen_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_session_facts_utm ON metrics_session_facts(utm_source, utm_medium, utm_campaign)');

            const msfCols = await this.db.all('PRAGMA table_info(metrics_session_facts)');
            const msfNames = new Set((msfCols || []).map((c) => String(c.name || '').toLowerCase()));
            const ensureMsfCol = async (name, def) => {
                if (!msfNames.has(name)) {
                    await this.db.run(`ALTER TABLE metrics_session_facts ADD COLUMN ${name} ${def}`);
                }
            };
            await ensureMsfCol('person_key', 'TEXT');
            await ensureMsfCol('crm_lead_id', 'TEXT');
            await ensureMsfCol('customer_email_hash', 'TEXT');
            await ensureMsfCol('customer_phone_hash', 'TEXT');
            await ensureMsfCol('forms_seen', 'INTEGER DEFAULT 0');
            await ensureMsfCol('forms_first_input', 'INTEGER DEFAULT 0');
            await ensureMsfCol('form_submit_attempts', 'INTEGER DEFAULT 0');
            await ensureMsfCol('form_validation_errors', 'INTEGER DEFAULT 0');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_session_facts_person ON metrics_session_facts(person_key)');

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS metrics_anomalies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    anomaly_key TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    baseline_value REAL,
                    current_value REAL,
                    delta_pct REAL,
                    details TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_anomalies_created ON metrics_anomalies(created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_anomalies_key ON metrics_anomalies(anomaly_key, created_at)');

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS metrics_identity_nodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    identity_type TEXT NOT NULL,
                    identity_value TEXT NOT NULL,
                    person_key TEXT NOT NULL,
                    user_id INTEGER,
                    session_id TEXT,
                    crm_lead_id TEXT,
                    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(identity_type, identity_value),
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_identity_person ON metrics_identity_nodes(person_key)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_identity_user ON metrics_identity_nodes(user_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_identity_lead ON metrics_identity_nodes(crm_lead_id)');

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS metrics_feature_store (
                    person_key TEXT PRIMARY KEY,
                    profile_key TEXT,
                    user_id INTEGER,
                    session_id TEXT,
                    crm_lead_id TEXT,
                    budget_cluster TEXT DEFAULT 'unknown',
                    weighted_price REAL DEFAULT 0,
                    intent_score REAL DEFAULT 0,
                    recency_half_life_days REAL DEFAULT 7,
                    recency_decay REAL DEFAULT 1,
                    discipline_embedding_json TEXT,
                    brand_embedding_json TEXT,
                    category_embedding_json TEXT,
                    last_event_at DATETIME,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_feature_store_user ON metrics_feature_store(user_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_feature_store_budget ON metrics_feature_store(budget_cluster)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_metrics_feature_store_intent ON metrics_feature_store(intent_score)');

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS referral_links (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL UNIQUE,
                    channel_name TEXT NOT NULL,
                    code_word TEXT,
                    creator_tag TEXT,
                    target_path TEXT NOT NULL DEFAULT '/',
                    utm_source TEXT NOT NULL DEFAULT 'creator',
                    utm_medium TEXT NOT NULL DEFAULT 'referral',
                    utm_campaign TEXT,
                    utm_content TEXT,
                    is_active INTEGER DEFAULT 1,
                    notes TEXT,
                    created_by INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_referral_links_slug ON referral_links(slug)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_referral_links_active ON referral_links(is_active, created_at)');

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS referral_visits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    referral_link_id INTEGER NOT NULL,
                    slug TEXT NOT NULL,
                    session_hint TEXT,
                    ip_hash TEXT,
                    user_agent TEXT,
                    referrer TEXT,
                    target_path TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(referral_link_id) REFERENCES referral_links(id) ON DELETE CASCADE
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_referral_visits_link_created ON referral_visits(referral_link_id, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_referral_visits_slug_created ON referral_visits(slug, created_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_referral_visits_session ON referral_visits(session_hint, created_at)');

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS search_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
                    session_id TEXT,
                    user_id INTEGER,
                    query TEXT,
                    category TEXT,
                    brand TEXT,
                    min_price REAL,
                    max_price REAL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_search_events_session ON search_events(session_id, ts)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_search_events_user ON search_events(user_id, ts)');

            await this.db.run(
                'CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
            );

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS user_interest_profiles (
                    profile_key TEXT PRIMARY KEY,
                    user_id INTEGER,
                    session_id TEXT,
                    disciplines_json TEXT,
                    brands_json TEXT,
                    price_sum REAL DEFAULT 0,
                    price_weight REAL DEFAULT 0,
                    weighted_price REAL DEFAULT 0,
                    intent_score REAL DEFAULT 0,
                    insight_text TEXT,
                    insight_model TEXT,
                    insight_updated_at DATETIME,
                    last_event_at DATETIME,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_interest_profiles_user ON user_interest_profiles(user_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_interest_profiles_session ON user_interest_profiles(session_id)');

            await this.db.run(
                `CREATE TABLE IF NOT EXISTS ab_experiments (
                    experiment_key TEXT PRIMARY KEY,
                    name TEXT,
                    variants_json TEXT NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS ab_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    experiment_key TEXT NOT NULL,
                    subject_key TEXT NOT NULL,
                    user_id INTEGER,
                    session_id TEXT,
                    variant TEXT NOT NULL,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(experiment_key, subject_key),
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_ab_assignments_subject ON ab_assignments(subject_key)');
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS ab_goal_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    experiment_key TEXT NOT NULL,
                    variant TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    bike_id INTEGER,
                    user_id INTEGER,
                    session_id TEXT,
                    value REAL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE SET NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_ab_goal_events_exp_metric ON ab_goal_events(experiment_key, metric_name, created_at)');

            const bhCols = await this.db.all('PRAGMA table_info(bike_behavior_metrics)');
            const bhNames = new Set((bhCols || []).map((c) => String(c.name || '').toLowerCase()));
            const ensureBhCol = async (name, def) => {
                if (!bhNames.has(name)) {
                    await this.db.run(`ALTER TABLE bike_behavior_metrics ADD COLUMN ${name} ${def}`);
                }
            };
            await ensureBhCol('avg_dwell_ms', 'INTEGER DEFAULT 0');
            await ensureBhCol('orders', 'INTEGER DEFAULT 0');
            await ensureBhCol('bounces', 'INTEGER DEFAULT 0');
            await ensureBhCol('period_start', 'DATETIME');
            await ensureBhCol('period_end', 'DATETIME');
        } catch (e) {
            console.warn(`?? metric_events migration skipped: ${e.message}`);
        }
    }

    async ensureRuntimeOpsSchema() {
        if (!this.db) return;
        try {
            await this.db.run(
                `CREATE TABLE IF NOT EXISTS currency_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rate REAL NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_currency_history_timestamp ON currency_history(timestamp DESC)');

            const cols = await this.db.all('PRAGMA table_info(system_logs)');
            const names = new Set((cols || []).map((c) => String(c.name || '').toLowerCase()));
            if (!names.has('stack')) {
                await this.db.run('ALTER TABLE system_logs ADD COLUMN stack TEXT');
            }
            if (!names.has('data')) {
                await this.db.run('ALTER TABLE system_logs ADD COLUMN data TEXT');
            }
        } catch (e) {
            console.warn(`?? runtime ops schema migration skipped: ${e.message}`);
        }
    }

    async testConnection() {
        if (!this.db) await this.initialize();
        try {
            await this.db.get('SELECT 1');
            console.log('✅ Database connection test passed');
            return true;
        } catch (error) {
            console.error('❌ Database connection test failed:', error);
            throw error;
        }
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log('✅ Database connection closed');
        }
    }

    async query(sql, params = []) {
        if (!this.db) await this.initialize();

        if (this.isNode) {
            const upper = sql.trim().toUpperCase();
            if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA')) {
                return await this.db.all(sql, params);
            } else {
                const result = await this.db.run(sql, params);
                return { insertId: result.lastID, affectedRows: result.changes, ...result };
            }
        } else {
            // Browser environment (sql.js)
            try {
                const result = this.db.exec(sql, params);
                if (sql.trim().toUpperCase().startsWith('SELECT')) {
                    if (result.length > 0) {
                        const columns = result[0].columns;
                        const values = result[0].values;
                        return values.map(row => {
                            const obj = {};
                            columns.forEach((col, i) => { obj[col] = row[i]; });
                            return obj;
                        });
                    }
                    return [];
                }
                return result;
            } catch (e) {
                console.error("SQL Error:", e);
                throw e;
            }
        }
    }
}

const db = new DatabaseManager();
module.exports = { db, DatabaseManager };
