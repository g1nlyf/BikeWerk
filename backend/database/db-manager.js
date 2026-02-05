const Database = require('better-sqlite3');
const { DB_PATH } = require('../config/db-path');

class DatabaseManager {
    constructor() {
        this.dbPath = DB_PATH;
        this.db = null;
    }

    getDatabase() {
        if (!this.db) {
            try {
                this.db = new Database(this.dbPath, { verbose: null }); // verbose: console.log for debug
                this.db.pragma('journal_mode = WAL');
                this._ensureMetricEventsSchema();
            } catch (err) {
                console.error('[DatabaseManager] Failed to open database:', err.message);
                throw err;
            }
        }
        return this.db;
    }

    _ensureMetricEventsSchema() {
        try {
            const cols = this.db.prepare('PRAGMA table_info(metric_events)').all();
            if (!cols || cols.length === 0) return;
            const hasEventType = cols.some(c => c.name === 'event_type');
            const hasType = cols.some(c => c.name === 'type');
            if (!hasEventType) {
                this.db.prepare('ALTER TABLE metric_events ADD COLUMN event_type TEXT').run();
            }
            if (hasType) {
                this.db.prepare('UPDATE metric_events SET event_type = COALESCE(event_type, type) WHERE event_type IS NULL').run();
            }
            this.db.prepare('CREATE INDEX IF NOT EXISTS idx_metric_events_type_created ON metric_events(event_type, created_at)').run();
        } catch (err) {
            console.warn('[DatabaseManager] metric_events migration skipped:', err.message);
        }
    }

    /**
     * Execute a query and return results
     * @param {string} sql - SQL query with ? placeholders
     * @param {Array} params - Parameters for the query
     * @returns {Array} Query results
     */
    query(sql, params = []) {
        const db = this.getDatabase();
        try {
            const stmt = db.prepare(sql);
            return stmt.all(...params);
        } catch (err) {
            console.error('[DatabaseManager] Query failed:', err.message);
            console.error('[DatabaseManager] SQL:', sql);
            console.error('[DatabaseManager] Params:', JSON.stringify(params));
            throw err;
        }
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

module.exports = DatabaseManager;
