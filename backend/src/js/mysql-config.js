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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    dwell_ms INTEGER,
    user_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_metric_events_bike_created ON metric_events(bike_id, created_at);
CREATE INDEX IF NOT EXISTS idx_metric_events_type_created ON metric_events(event_type, created_at);

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
    FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

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
        // FIXED: Hardcode to main database to avoid "double backend" issue
        // c:\Users\hacke\CascadeProjects\Finals1\eubike\backend\database\eubike.db
        this.dbPath = path.join(__dirname, '../../database/eubike.db');

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
                            // Gracefully skip metric_events index creation if legacy schema lacks columns
                            if (/CREATE INDEX IF NOT EXISTS idx_metric_events_/i.test(statement) && /no such column/i.test(msg)) {
                                console.warn(`⚠️ Skipping metric_events index (schema drift): ${msg}`);
                                continue;
                            }
                            throw error;
                        }
                    }
                }
            }

            if (this.isNode) {
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
            console.error('❌ Database initialization failed:', error);
            throw error;
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
