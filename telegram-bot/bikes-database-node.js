const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class BikesDatabase {
    constructor() {
        this.categories = ['Горный', 'Шоссейный', 'Городской', 'Электро', 'BMX', 'Детский'];
        this.brands = ['trek', 'specialized', 'giant', 'cannondale', 'scott', 'merida', 'cube', 'bianchi'];
        
        // Use ENV if available, else fallback to relative path
        this.dbPath = process.env.BOT_DB_PATH || process.env.DB_PATH
            ? path.resolve(process.cwd(), process.env.BOT_DB_PATH || process.env.DB_PATH)
            : path.resolve(__dirname, '../backend/database/eubike.db');
            
        console.log(`[BikesDatabase] Using DB at: ${this.dbPath}`);
        
        this.db = null;
        this.disabled = false;
    }

    async ensureInitialized() {
        if (this.db) return true;
        try {
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            this.db = new sqlite3.Database(this.dbPath);
            await this.runQuery('PRAGMA foreign_keys = ON');
            
            // Migration: Ensure logistics_priority column exists
            try {
                await this.runQuery('ALTER TABLE bikes ADD COLUMN logistics_priority TEXT DEFAULT "none"');
            } catch (e) {
                // Ignore if column exists
            }

            // Migration: Ensure condition_report column exists for AI JSON
            try {
                await this.runQuery('ALTER TABLE bikes ADD COLUMN condition_report TEXT');
            } catch (e) {
                // Ignore if column exists
            }

            // Migration: Create bounties table
            try {
                await this.runQuery(`
                    CREATE TABLE IF NOT EXISTS bounties (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT,
                        category TEXT,
                        brand TEXT,
                        model TEXT,
                        size TEXT,
                        max_price REAL,
                        min_grade TEXT,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            } catch (e) {
                console.error('Failed to create bounties table', e);
            }

            // Migration: Create price_history table
            try {
                await this.runQuery(`
                    CREATE TABLE IF NOT EXISTS price_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        bike_id INTEGER,
                        price REAL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE CASCADE
                    )
                `);
            } catch (e) {
                console.error('Failed to create price_history table', e);
            }

            // Migration: Create user_favorites table
            try {
                await this.runQuery(`
                    CREATE TABLE IF NOT EXISTS user_favorites (
                        user_id TEXT,
                        bike_id INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, bike_id),
                        FOREIGN KEY(bike_id) REFERENCES bikes(id) ON DELETE CASCADE
                    )
                `);
            } catch (e) {
                console.error('Failed to create user_favorites table', e);
            }

            // Migration: Create bot_tasks table
            try {
                await this.runQuery(`
                    CREATE TABLE IF NOT EXISTS bot_tasks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        type TEXT,
                        status TEXT DEFAULT 'pending',
                        payload TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        processed_at DATETIME
                    )
                `);
            } catch (e) {
                console.error('Failed to create bot_tasks table', e);
            }

            // Migration: Create market_history table
            try {
                await this.runQuery(`
                    CREATE TABLE IF NOT EXISTS market_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        brand TEXT,
                        title TEXT,
                        model TEXT,
                        year INTEGER,
                        price_eur REAL,
                        source_url TEXT UNIQUE,
                        frame_size TEXT,
                        condition TEXT,
                        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        category TEXT
                    )
                `);
            } catch (e) {
                console.error('Failed to create market_history table', e);
            }

            // Migration: Create needs_manual_review table (Task 3: Opportunistic Learning)
            try {
                await this.runQuery(`
                    CREATE TABLE IF NOT EXISTS needs_manual_review (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT,
                        brand TEXT,
                        model TEXT,
                        price REAL,
                        url TEXT UNIQUE,
                        reason TEXT,
                        status TEXT DEFAULT 'pending', -- pending, approved, rejected
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            } catch (e) {
                console.error('Failed to create needs_manual_review table', e);
            }

            // Migration: Create skipped_targets table (Task 4: Race Condition Fix)
            try {
                await this.runQuery(`
                    CREATE TABLE IF NOT EXISTS skipped_targets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        brand TEXT,
                        model TEXT,
                        attempts INTEGER DEFAULT 1,
                        last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        coverage INTEGER DEFAULT 0,
                        UNIQUE(brand, model)
                    )
                `);
            } catch (e) {
                console.error('Failed to create skipped_targets table', e);
            }

            // Migration: Create system_logs table
            try {
                await this.runQuery(`
                    CREATE TABLE IF NOT EXISTS system_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        level TEXT,
                        source TEXT,
                        message TEXT,
                        data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                // Ensure source column exists (if table already existed without it)
                try {
                    await this.runQuery('ALTER TABLE system_logs ADD COLUMN source TEXT');
                } catch (e) { /* ignore if exists */ }
            } catch (e) {
                console.error('Failed to create system_logs table', e);
            }

            // Migration: Ensure indexes on market_history (Performance Optimization)
            try {
                await this.runQuery('CREATE INDEX IF NOT EXISTS idx_market_brand_model ON market_history(brand, title)');
                await this.runQuery('CREATE INDEX IF NOT EXISTS idx_market_price ON market_history(price_eur)');
            } catch (e) {
                // Ignore if table doesn't exist yet or other non-critical error
                // console.warn('Index creation warning:', e.message);
            }

            try {
                await this.runQuery(`
                    DELETE FROM bike_images
                    WHERE id NOT IN (
                        SELECT MIN(id)
                        FROM bike_images
                        GROUP BY bike_id, image_url
                    )
                `);
            } catch (e) {}
            try {
                await this.runQuery('CREATE UNIQUE INDEX IF NOT EXISTS idx_bike_images_unique ON bike_images(bike_id, image_url)');
            } catch (e) {}

            // Migration: SyncService columns
            try {
                await this.runQuery('ALTER TABLE bikes ADD COLUMN last_sync_at DATETIME');
            } catch (e) {}
            try {
                await this.runQuery('ALTER TABLE bikes ADD COLUMN archived_at DATETIME');
            } catch (e) {}

            // Migration: Logistic Sniper 2.0 - Guaranteed Pickup (Marburg Hub)
            try {
                await this.runQuery('ALTER TABLE bikes ADD COLUMN guaranteed_pickup BOOLEAN DEFAULT 0');
            } catch (e) {}

            // Migration: Hotness Radar (Sprint 1.4)
            try {
                await this.runQuery('ALTER TABLE bikes ADD COLUMN hotness_score REAL DEFAULT 0');
                await this.runQuery('ALTER TABLE bikes ADD COLUMN views_count INTEGER DEFAULT 0');
                await this.runQuery('ALTER TABLE bikes ADD COLUMN publish_date DATETIME');
            } catch (e) {}

            // Migration: Sprint 1.5 - Industrial Standard (Shield, Trust, Gold)
            try {
                await this.runQuery('ALTER TABLE bikes ADD COLUMN confidence_score INTEGER DEFAULT 0');
                await this.runQuery('ALTER TABLE bikes ADD COLUMN salvage_value REAL DEFAULT 0');
                await this.runQuery('ALTER TABLE bikes ADD COLUMN is_salvage_gem INTEGER DEFAULT 0');
                await this.runQuery('ALTER TABLE bikes ADD COLUMN kill_reason TEXT');
            } catch (e) {}

            // Migration: Add category to market_history
            try {
                await this.runQuery('ALTER TABLE market_history ADD COLUMN category TEXT');
            } catch (e) {}

            return true;
        } catch (error) {
            console.error('BikesDatabase initialization failed:', error);
            throw error;
        }
    }

    async runQuery(sql, params = []) {
        await this.ensureInitialized();
        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    async getQuery(sql, params = []) {
        await this.ensureInitialized();
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    async allQuery(sql, params = []) {
        await this.ensureInitialized();
        return await new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    // Adapter for ValuationService
    async query(sql, params = []) {
        return this.allQuery(sql, params);
    }

    async getAllBikes() {
        return await this.allQuery('SELECT * FROM bikes');
    }

    async getBikeById(id) {
        return await this.getQuery('SELECT * FROM bikes WHERE id = ?', [id]);
    }

    async saveBike(bike) {
        await this.ensureInitialized();
        const originalUrl = bike.originalUrl || bike.original_url;
        
        // 1. Check for duplicate
        let existing = null;
        if (originalUrl) {
            existing = await this.getBikeByUrl(originalUrl);
        }

        const params = [
            bike.name || `${bike.brand} ${bike.model}`,
            bike.brand,
            bike.model,
            bike.price,
            bike.category,
            bike.description,
            bike.location,
            bike.condition || bike.condition_status || (bike.is_new ? 'new' : 'used'),
            bike.frameSize || bike.frame_size || bike.size,
            bike.wheelDiameter || bike.wheel_diameter,
            bike.year,
            bike.isNegotiable ? 1 : 0,
            bike.deliveryOption || bike.delivery_option || bike.shipping_option || 'unknown',
            originalUrl,
            bike.source,
            bike.sourceAdId || bike.source_ad_id,
            bike.views || bike.views_count || 0,
            bike.publishDate || bike.publish_date,
            bike.is_active || 0,
            bike.priority || 'normal',
            bike.fmv || null,
            bike.hotness_score || 0,
            bike.salvage_value || 0,
            bike.condition_grade || null,
            bike.condition_score || null,
            bike.condition_penalty || null
        ];

        try {
            if (existing) {
                // UPDATE
                const sqlUpdate = `
                    UPDATE bikes SET
                        name = ?, brand = ?, model = ?, price = ?, category = ?,
                        description = ?, location = ?, condition_status = ?, size = ?, wheel_diameter = ?,
                        year = ?, is_negotiable = ?, shipping_option = ?, original_url = ?, source = ?,
                        source_ad_id = ?, views_count = ?, publish_date = ?, is_active = ?, priority = ?,
                        fmv = ?, hotness_score = ?, salvage_value = ?, condition_grade = ?,
                        condition_score = ?, condition_penalty = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;
                await this.runQuery(sqlUpdate, [...params, existing.id]);
                return { id: existing.id, lastID: existing.id, updated: true };
            } else {
                // INSERT
                const sqlInsert = `
                    INSERT INTO bikes (
                        name, brand, model, price, category,
                        description, location, condition_status, size, wheel_diameter,
                        year, is_negotiable, shipping_option, original_url, source,
                        source_ad_id, views_count, publish_date, is_active, priority,
                        fmv, hotness_score, salvage_value, condition_grade,
                        condition_score, condition_penalty, created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                `;
                const result = await this.runQuery(sqlInsert, params);
                return { id: result.lastID, lastID: result.lastID, updated: false };
            }
        } catch (e) {
            console.error('saveBike error:', e);
            throw e;
        }
    }

    async addBike(bike) {
        return this.saveBike(bike);
    }

    async getBikeByUrl(url) {
        return this.getBikeByOriginalUrl(url);
    }

    async addBikeImages(bikeId, images) {
        await this.ensureInitialized();
        const unique = Array.from(new Set((images || []).filter(Boolean)));
        for (let i = 0; i < unique.length; i++) {
            await this.runQuery(
                'INSERT INTO bike_images (bike_id, image_url, is_main, image_order) VALUES (?, ?, ?, ?)',
                [bikeId, unique[i], i === 0 ? 1 : 0, i]
            );
        }
    }

    async clearBikeImages(bikeId) {
        await this.ensureInitialized();
        await this.runQuery('DELETE FROM bike_images WHERE bike_id = ?', [bikeId]);
    }

    async updateBike(id, updates) {
        await this.ensureInitialized();
        const keys = Object.keys(updates);
        if (keys.length === 0) return;

        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        await this.runQuery(`UPDATE bikes SET ${setClause}, updated_at = datetime('now') WHERE id = ?`, values);
    }

    async getBikeByOriginalUrl(url) {
        try {
            const bike = await this.getQuery('SELECT * FROM bikes WHERE original_url = ?', [url]);
            if (bike) return bike;
        } catch (e) {
            if (!e.message.includes('no such column')) console.error(e);
        }
        return null;
    }

    async logMarketHistory(items, defaultCategory = null) {
        for (const item of items) {
            let price = 0;
            // Parse price
            if (typeof item.priceRaw === 'string') {
                 // Try parsing '2.300 €' -> 2300
                 // '150 €' -> 150
                 const t = item.priceRaw.replace(/[^0-9,]/g, '').replace(/,/g, '.');
                 price = parseFloat(t);
            } else if (typeof item.price === 'number') {
                price = item.price;
            } else if (typeof item.priceRaw === 'number') {
                price = item.priceRaw;
            }

            // Extract Brand from title if not present (simple heuristic)
            let brand = item.brand || null;
            if (!brand) {
                const brands = ['canyon', 'specialized', 'cube', 'trek', 'scott', 'giant', 'cannondale', 'orbea', 'santa cruz', 'yt', 'pivot'];
                const lowerTitle = (item.title || '').toLowerCase();
                for (const b of brands) {
                    if (lowerTitle.includes(b)) {
                        brand = b.charAt(0).toUpperCase() + b.slice(1);
                        break;
                    }
                }
            }

            // Extract Model (remove brand from title)
            let model = item.model || item.title;
            if (brand && model === item.title) {
                model = model.replace(new RegExp(brand, 'gi'), '').trim();
            }

            try {
                // Use INSERT OR IGNORE to handle duplicates gracefully
                await this.runQuery(
                    `INSERT OR IGNORE INTO market_history 
                    (title, model, brand, price_eur, source_url, scraped_at, category) 
                    VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
                    [item.title, model, brand, price, item.link, defaultCategory || 'MTB']
                );
            } catch(e) {
                // Only log if it's NOT a constraint error (which we handled via IGNORE, but just in case)
                if (!e.message.includes('UNIQUE constraint')) {
                    console.error('Error logging market history item:', e.message);
                }
            }
        }
    }

    async getNextId() {
        const res = await this.getQuery("SELECT seq FROM sqlite_sequence WHERE name = 'bikes'");
        return res ? res.seq + 1 : 1;
    }

    async removeBike(id) {
        await this.runQuery('DELETE FROM bikes WHERE id = ?', [id]);
    }

    async getBikeImages(bikeId) {
        const rows = await this.allQuery(
            'SELECT image_url FROM bike_images WHERE bike_id = ? ORDER BY image_order ASC',
            [bikeId]
        );
        return rows.map(r => r.image_url).filter(Boolean);
    }

    async setBikeActive(bikeId, isActive) {
        await this.runQuery('UPDATE bikes SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, bikeId]);
    }

    async markBikeChecked(bikeId) {
        await this.runQuery('UPDATE bikes SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?', [bikeId]);
    }

    async getLeastRecentlyCheckedBikes(limit = 10) {
        const n = Math.max(1, Math.min(200, Number(limit) || 10));
        return await this.allQuery(
            `
            SELECT *
            FROM bikes
            WHERE is_active = 1
            ORDER BY (last_checked_at IS NOT NULL) ASC, last_checked_at ASC, id ASC
            LIMIT ?
            `,
            [n]
        );
    }

    async getTelegramBikes() {
        try {
            return await this.allQuery(
                `
                SELECT *
                FROM bikes
                WHERE LOWER(COALESCE(source, '')) LIKE 'telegram%'
                ORDER BY COALESCE(added_at, created_at) DESC, id DESC
                `
            );
        } catch (e) {
            return [];
        }
    }

    async ensureRecentDeliveriesSchema() {
        await this.runQuery(
            `
            CREATE TABLE IF NOT EXISTS recent_deliveries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bike_id INTEGER,
                model TEXT NOT NULL,
                city TEXT NOT NULL,
                price REAL NOT NULL,
                main_image TEXT,
                price_breakdown TEXT,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            `
        );
        try {
            await this.runQuery('ALTER TABLE recent_deliveries ADD COLUMN main_image TEXT');
        } catch {}
        try {
            await this.runQuery('ALTER TABLE recent_deliveries ADD COLUMN price_breakdown TEXT');
        } catch {}
    }

    async addRecentDelivery(delivery) {
        await this.ensureRecentDeliveriesSchema();
        const bikeId = delivery?.bikeId ?? delivery?.bike_id ?? null;
        const model = String(delivery?.model || '').trim() || 'Unknown';
        const city = String(delivery?.city || '').trim() || '—';
        const price = Number(delivery?.price || 0) || 0;
        const status = String(delivery?.status || '').trim() || 'Доставлен';
        const mainImage = delivery?.mainImage ?? delivery?.main_image ?? delivery?.image ?? null;
        const priceBreakdown = delivery?.priceBreakdown ?? delivery?.price_breakdown ?? delivery?.price_breakdown_text ?? null;

        const info = await this.allQuery('PRAGMA table_info(recent_deliveries)');
        const colSet = new Set((info || []).map(c => String(c.name || '').toLowerCase()));

        const cols = [];
        const vals = [];
        const add = (name, value) => {
            if (colSet.has(name.toLowerCase())) {
                cols.push(name);
                vals.push(value);
            }
        };

        add('bike_id', bikeId);
        add('model', model);
        add('city', city);
        add('price', price);
        add('status', status);
        add('main_image', mainImage);
        add('price_breakdown', priceBreakdown);

        const placeholders = cols.map(() => '?').join(', ');
        const sql = `INSERT INTO recent_deliveries (${cols.join(', ')}) VALUES (${placeholders})`;
        const result = await this.runQuery(sql, vals);
        return { id: result.lastID };
    }

    async getUserOrdersByTelegramId(chatId) {
        try {
            const sql = `
                SELECT o.*, b.name as bike_name, b.price as bike_price, b.main_image as bike_image, b.brand as bike_brand, b.model as bike_model
                FROM orders o
                JOIN customers c ON o.customer_id = c.id
                LEFT JOIN bikes b ON o.bike_id = b.id
                WHERE c.contact_value = ? OR c.phone = ?
                ORDER BY o.created_at DESC
            `;
            return await this.allQuery(sql, [String(chatId), String(chatId)]);
        } catch (e) {
            console.error('Error fetching user orders:', e.message);
            return [];
        }
    }
}

module.exports = BikesDatabase;
