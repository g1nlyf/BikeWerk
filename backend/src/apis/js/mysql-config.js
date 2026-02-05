// EUBike SQLite Database Configuration and Schema
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
require('dotenv').config();

// Database initialization SQL for SQLite
const initSQL = `
-- Users table for authentication and user management
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    last_logout DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Main bikes table
CREATE TABLE IF NOT EXISTS bikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    brand TEXT NOT NULL,
    model TEXT DEFAULT '',
    size TEXT DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    original_price REAL DEFAULT 0,
    discount INTEGER DEFAULT 0,
    main_image TEXT,
    rating REAL DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    description TEXT,
    features TEXT, -- JSON as TEXT in SQLite
    delivery_info TEXT,
    warranty TEXT,
    source TEXT DEFAULT 'manual',
    original_url TEXT,
    condition_status TEXT DEFAULT 'used',
    year INTEGER,
    wheel_diameter TEXT,
    location TEXT,
    is_negotiable INTEGER DEFAULT 0,
    is_new INTEGER DEFAULT 0,
    discipline TEXT,
    last_checked_at DATETIME,
    is_reserviert INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bikes_category ON bikes(category);
CREATE INDEX IF NOT EXISTS idx_bikes_brand ON bikes(brand);
CREATE INDEX IF NOT EXISTS idx_bikes_price ON bikes(price);
CREATE INDEX IF NOT EXISTS idx_bikes_active ON bikes(is_active);
CREATE INDEX IF NOT EXISTS idx_bikes_condition ON bikes(condition_status);
CREATE INDEX IF NOT EXISTS idx_bikes_new ON bikes(is_new);

CREATE TABLE IF NOT EXISTS bike_evaluations (
    bike_id INTEGER PRIMARY KEY,
    price_value_score INTEGER NOT NULL DEFAULT 5,
    quality_appearance_score INTEGER NOT NULL DEFAULT 5,
    detail_intent_score INTEGER NOT NULL DEFAULT 5,
    trust_confidence_score INTEGER,
    seasonal_fit_score INTEGER,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bike_evaluations_updated ON bike_evaluations(updated_at);

CREATE TABLE IF NOT EXISTS bike_behavior_metrics (
    bike_id INTEGER PRIMARY KEY,
    impressions INTEGER NOT NULL DEFAULT 0,
    detail_clicks INTEGER NOT NULL DEFAULT 0,
    add_to_cart INTEGER NOT NULL DEFAULT 0,
    orders INTEGER NOT NULL DEFAULT 0,
    favorites INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    avg_dwell_ms INTEGER DEFAULT 0,
    bounces INTEGER NOT NULL DEFAULT 0,
    period_start DATETIME,
    period_end DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_behavior_metrics_updated ON bike_behavior_metrics(updated_at);

-- Raw metric events (for analytics)
CREATE TABLE IF NOT EXISTS metric_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    value INTEGER DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    referrer TEXT,
    source_path TEXT,
    dwell_ms INTEGER,
    user_id INTEGER,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_metric_events_bike_created ON metric_events(bike_id, created_at);
CREATE INDEX IF NOT EXISTS idx_metric_events_type_created ON metric_events(event_type, created_at);

-- Search events for personalization
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

CREATE TABLE IF NOT EXISTS bike_behavior_metrics_daily (
    bike_id INTEGER NOT NULL,
    day DATE NOT NULL,
    impressions INTEGER NOT NULL DEFAULT 0,
    detail_clicks INTEGER NOT NULL DEFAULT 0,
    add_to_cart INTEGER NOT NULL DEFAULT 0,
    orders INTEGER NOT NULL DEFAULT 0,
    favorites INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    dwell_ms_sum INTEGER NOT NULL DEFAULT 0,
    bounces INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bike_id, day),
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_day ON bike_behavior_metrics_daily(day);

-- System logs for diagnostics
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    level TEXT DEFAULT 'error',
    source TEXT,
    message TEXT,
    stack TEXT
);
CREATE INDEX IF NOT EXISTS idx_system_logs_ts ON system_logs(ts);

-- Bike images table
CREATE TABLE IF NOT EXISTS bike_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    image_order INTEGER DEFAULT 0,
    is_main INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bike_images_bike_id ON bike_images(bike_id);
CREATE INDEX IF NOT EXISTS idx_bike_images_order ON bike_images(image_order);

-- Bike specifications table
CREATE TABLE IF NOT EXISTS bike_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER NOT NULL,
    spec_label TEXT NOT NULL,
    spec_value TEXT NOT NULL,
    spec_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bike_specs_bike_id ON bike_specs(bike_id);
CREATE INDEX IF NOT EXISTS idx_bike_specs_label ON bike_specs(spec_label);

-- User favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bike_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
    UNIQUE(user_id, bike_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_bike_id ON user_favorites(bike_id);

-- Shopping cart table
CREATE TABLE IF NOT EXISTS shopping_cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bike_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    calculated_price DECIMAL(10,2),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
    UNIQUE(user_id, bike_id)
);

CREATE INDEX IF NOT EXISTS idx_shopping_cart_user_id ON shopping_cart(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_cart_bike_id ON shopping_cart(bike_id);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    total_amount REAL NOT NULL,
    shipping_address TEXT NOT NULL,
    billing_address TEXT,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    shipped_at DATETIME,
    delivered_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    bike_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    bike_snapshot TEXT, -- JSON as TEXT in SQLite
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_bike_id ON order_items(bike_id);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Telegram users table for bot integration
CREATE TABLE IF NOT EXISTS telegram_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    language_code TEXT DEFAULT 'en',
    is_bot INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_username ON telegram_users(username);
CREATE INDEX IF NOT EXISTS idx_telegram_users_active ON telegram_users(is_active);

-- Bot sessions table for managing conversation state
CREATE TABLE IF NOT EXISTS bot_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id INTEGER NOT NULL,
    session_data TEXT, -- JSON as TEXT in SQLite
    current_state TEXT DEFAULT 'idle',
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (telegram_user_id) REFERENCES telegram_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_telegram_user_id ON bot_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_state ON bot_sessions(current_state);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_expires ON bot_sessions(expires_at);

CREATE TABLE IF NOT EXISTS recent_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER,
    model TEXT NOT NULL,
    city TEXT,
    price REAL NOT NULL,
    main_image TEXT,
    status TEXT DEFAULT 'Снято',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recent_deliveries_created ON recent_deliveries(created_at DESC);
`;

class DatabaseManager {
    constructor() {
        this.db = null;
        // Robust DB path resolution: handle running from project root or backend dir
        const fs = require('fs');
        const envPath = process.env.DB_PATH;
        // Compute real backend root from this file location: .../backend/src/apis/js
        // Go up 4 levels -> .../backend
        const backendRoot = path.resolve(__dirname, '../../../..');
        const projectRoot = path.resolve(backendRoot, '..');    // monorepo root

        let finalPath;
        if (envPath) {
            if (path.isAbsolute(envPath)) {
                finalPath = envPath;
            } else {
                const normalized = envPath.replace(/^\.\/?/, '').replace(/\\/g, '/');
                // Prefer resolving from monorepo root when path starts with 'backend/'
                const candidateFromProject = path.resolve(projectRoot, normalized);
                const candidateFromBackend = path.resolve(backendRoot, normalized);
                // Choose candidate that points to an existing directory; fallback to project
                finalPath = candidateFromProject;
                const dirProject = path.dirname(candidateFromProject);
                const dirBackend = path.dirname(candidateFromBackend);
                if (!fs.existsSync(dirProject) && fs.existsSync(dirBackend)) {
                    finalPath = candidateFromBackend;
                }
            }
        } else {
            // Default to .../backend/Databases/eubike.db
            finalPath = path.resolve(backendRoot, 'Databases/eubike.db');
        }

        this.dbPath = finalPath;
    }

    // Initialize database and tables
    async initialize() {
        try {
            // Ensure database directory exists
            const fs = require('fs');
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Open SQLite database
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });

            // Enable foreign keys
            await this.db.exec('PRAGMA foreign_keys = ON');
            
            // Create database and tables
            const statements = initSQL.split(';').filter(stmt => stmt.trim());
            
            for (const statement of statements) {
                if (statement.trim()) {
                    await this.db.exec(statement);
                }
            }
            
            // Run migrations
            await this.runMigrations();
            
            console.log('✅ Database initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    // Run database migrations
    async runMigrations() {
        try {
            // Check if last_logout column exists in users table
            const tableInfo = await this.db.all("PRAGMA table_info(users)");
            const hasLastLogout = tableInfo.some(column => column.name === 'last_logout');
            
            if (!hasLastLogout) {
                await this.db.exec('ALTER TABLE users ADD COLUMN last_logout DATETIME');
                console.log('✅ Added last_logout column to users table');
            }

            const bikesInfo = await this.db.all("PRAGMA table_info(bikes)");
            const hasRankingScore = bikesInfo.some(column => column.name === 'ranking_score');
            const hasRankingUpdatedAt = bikesInfo.some(column => column.name === 'ranking_updated_at');
            const hasIsReserviert = bikesInfo.some(column => column.name === 'is_reserviert');
            const hasLastCheckedAt = bikesInfo.some(column => column.name === 'last_checked_at');
            const hasIsHotOffer = bikesInfo.some(column => column.name === 'is_hot_offer');

            if (!hasRankingScore) {
                await this.db.exec('ALTER TABLE bikes ADD COLUMN ranking_score REAL DEFAULT 0');
                console.log('✅ Added ranking_score to bikes');
            }
            if (!hasRankingUpdatedAt) {
                await this.db.exec('ALTER TABLE bikes ADD COLUMN ranking_updated_at DATETIME');
                console.log('✅ Added ranking_updated_at to bikes');
            }
            if (!hasIsReserviert) {
                await this.db.exec("ALTER TABLE bikes ADD COLUMN is_reserviert INTEGER DEFAULT 0");
                console.log('✅ Added is_reserviert to bikes');
            }
            if (!hasLastCheckedAt) {
                await this.db.exec("ALTER TABLE bikes ADD COLUMN last_checked_at DATETIME");
                console.log('✅ Added last_checked_at to bikes');
            }
            if (!hasIsHotOffer) {
                await this.db.exec("ALTER TABLE bikes ADD COLUMN is_hot_offer INTEGER DEFAULT 0");
                console.log('✅ Added is_hot_offer to bikes');
            }
            await this.db.exec('CREATE INDEX IF NOT EXISTS idx_bikes_ranking ON bikes(ranking_score)');

            // Ensure metric_events has user_id column
            const meInfo = await this.db.all("PRAGMA table_info(metric_events)");
            const hasMeUserId = meInfo.some(column => column.name === 'user_id');
            if (!hasMeUserId) {
                try {
                    await this.db.exec('ALTER TABLE metric_events ADD COLUMN user_id INTEGER');
                    console.log('✅ Added user_id to metric_events');
                } catch (e) {
                    console.log('ℹ️ metric_events user_id already exists or cannot be added:', e.message);
                }
            }

            // Ensure search_events table exists
            try {
                await this.db.exec('CREATE TABLE IF NOT EXISTS search_events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts DATETIME DEFAULT CURRENT_TIMESTAMP, session_id TEXT, user_id INTEGER, query TEXT, category TEXT, brand TEXT, min_price REAL, max_price REAL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL)');
                await this.db.exec('CREATE INDEX IF NOT EXISTS idx_search_events_session ON search_events(session_id, ts)');
                await this.db.exec('CREATE INDEX IF NOT EXISTS idx_search_events_user ON search_events(user_id, ts)');
            } catch (e) {
                console.log('ℹ️ search_events ensure error:', e.message);
            }
        } catch (error) {
            console.error('❌ Migration failed:', error);
            // Don't throw error for migrations, just log it
        }
    }

    // Test database connection
    async testConnection() {
        try {
            if (!this.db) {
                await this.initialize();
            }
            await this.db.get('SELECT 1');
            console.log('✅ Database connection successful');
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }

    // Execute query with parameters
    async query(sql, params = []) {
        try {
            if (!this.db) {
                await this.initialize();
            }
            
            const sqlUpper = sql.trim().toUpperCase();
            if (sqlUpper.startsWith('SELECT')) {
                return await this.db.all(sql, params);
            } else if (sqlUpper.startsWith('INSERT') || sqlUpper.startsWith('UPDATE') || sqlUpper.startsWith('DELETE')) {
                const result = await this.db.run(sql, params);
                return {
                    lastID: result.lastID,
                    changes: result.changes,
                    insertId: result.lastID // For compatibility
                };
            } else {
                return await this.db.run(sql, params);
            }
        } catch (error) {
            console.error('❌ Query execution failed:', error);
            throw error;
        }
    }

    // Execute multiple queries in transaction
    async transaction(queries) {
        if (!this.db) {
            await this.initialize();
        }
        
        try {
            await this.db.exec('BEGIN TRANSACTION');
            
            const results = [];
            for (const { sql, params } of queries) {
                const result = await this.db.run(sql, params);
                results.push(result);
            }
            
            await this.db.exec('COMMIT');
            return results;
        } catch (error) {
            await this.db.exec('ROLLBACK');
            throw error;
        }
    }

    // Close database connection
    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}

// Export configuration and manager
module.exports = {
    DatabaseManager,
    initSQL
};

// For browser environment
if (typeof window !== 'undefined') {
    window.DatabaseManager = DatabaseManager;
}
