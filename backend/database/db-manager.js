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
            } catch (err) {
                console.error('[DatabaseManager] Failed to open database:', err.message);
                throw err;
            }
        }
        return this.db;
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
