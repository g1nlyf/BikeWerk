const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

class DatabaseManager {
    constructor() {
        this.db = null;
        // Adjusted path for running from /root/eubike/backend/scripts/
        // App is at /root/eubike/backend
        // DB is at /root/eubike/database/eubike.db
        
        this.dbPath = '/root/eubike/database/eubike.db';
        console.log(`[DatabaseManager] Using DB Path: ${this.dbPath}`);
    }

    async initialize() {
        if (this.db) return true;

        try {
            // Ensure directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

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
                    return { insertId: result.lastID, affectedRows: result.changes, ...result };
                }
            };

            // Enable FK
            await this.db.run('PRAGMA foreign_keys = ON');
            return true;

        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }
    
    async query(sql, params) {
        return this.db.query(sql, params);
    }
}

(async () => {
    const db = new DatabaseManager();
    await db.initialize();
    console.log('🔌 DB Connected');

    // 1. Fix 'bikes' table columns
    const columnsToAdd = [
        'source_platform_type TEXT',
        'source_ad_id TEXT',
        'profit_margin REAL',
        'weight REAL',
        'suspension_type TEXT',
        'groupset TEXT',
        'brakes TEXT',
        'fork TEXT',
        'shock TEXT',
        'inspection_data TEXT',
        'seller_name TEXT',
        'seller_type TEXT',
        'seller_rating REAL',
        'seller_badges_json TEXT',
        'delivery_option TEXT',
        'shipping_cost REAL',
        'is_pickup_available INTEGER',
        'gallery TEXT',
        'audit_notes TEXT',
        'features_raw TEXT',
        'badges TEXT',
        'upgrades TEXT',
        'is_new INTEGER DEFAULT 0',
        'added_at DATETIME DEFAULT CURRENT_TIMESTAMP'
    ];

    for (const colDef of columnsToAdd) {
        try {
            await db.query(`ALTER TABLE bikes ADD COLUMN ${colDef}`);
            console.log(`✅ Added column: bikes.${colDef.split(' ')[0]}`);
        } catch (e) {
            // Ignore "duplicate column name" error
            if (!e.message.includes('duplicate column name')) {
                console.log(`ℹ️ bikes.${colDef.split(' ')[0]} check: ${e.message}`);
            }
        }
    }

    // 2. Create 'bike_specs' table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS bike_specs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bike_id INTEGER NOT NULL,
                spec_label TEXT NOT NULL,
                spec_value TEXT,
                spec_order INTEGER DEFAULT 0,
                FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created table: bike_specs');
    } catch (e) { console.error('Error creating bike_specs:', e.message); }

    // 3. Create 'bike_behavior_metrics' table
    try {
        await db.query(`
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
            )
        `);
        console.log('✅ Created table: bike_behavior_metrics');
    } catch (e) { console.error('Error creating bike_behavior_metrics:', e.message); }

    // 4. Create 'analytics_events' table
    try {
        await db.query(`
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
            )
        `);
        console.log('✅ Created table: analytics_events');
    } catch (e) { console.error('Error creating analytics_events:', e.message); }

    // 5. Create 'metric_events' table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS metric_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bike_id INTEGER,
                event_type TEXT,
                value INTEGER DEFAULT 1,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created table: metric_events');
    } catch (e) { console.error('Error creating metric_events:', e.message); }

     // 6. Create 'user_favorites' table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                bike_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (bike_id) REFERENCES bikes(id)
            )
        `);
        console.log('✅ Created table: user_favorites');
    } catch (e) { console.error('Error creating user_favorites:', e.message); }

    console.log('🏁 Schema Fix v4 Complete');
})();
