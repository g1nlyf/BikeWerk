const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class UniversalLogger {
    constructor(options = {}) {
        this.logDir = options.logDir || path.resolve(__dirname, 'logs');
        this.dbPath = options.dbPath || path.resolve(__dirname, '../backend/database/eubike.db');
        this.ensureLogDir();
        
        // Lazy DB init to avoid circular deps or init issues
        this.db = null;
    }

    async _ensureDb() {
        if (this.db) return;
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        let logMsg = `[${timestamp}] [${level}] ${message}`;
        if (data) {
            logMsg += `\n${JSON.stringify(data, null, 2)}`;
        }
        return logMsg;
    }

    async log(level, message, data = null) {
        const msg = this.formatMessage(level, message, data);
        
        // Console output with colors
        switch(level) {
            case 'ERROR': console.error('\x1b[31m%s\x1b[0m', msg); break; // Red
            case 'SUCCESS': console.log('\x1b[32m%s\x1b[0m', msg); break; // Green
            case 'WARN': console.warn('\x1b[33m%s\x1b[0m', msg); break; // Yellow
            case 'DEBUG': console.log('\x1b[36m%s\x1b[0m', msg); break; // Cyan
            default: console.log(msg);
        }

        // File output
        try {
            const today = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logDir, `hunter-${today}.log`);
            fs.appendFileSync(logFile, msg + '\n');
        } catch (e) {}

        // Database output
        try {
            await this._ensureDb();
            const dataStr = data ? JSON.stringify(data) : null;
            this.db.run('INSERT INTO system_logs (level, message, data) VALUES (?, ?, ?)', [level, message, dataStr]);
        } catch (e) {
            // silent fail for db logs
        }
    }

    debug(msg, data) { this.log('DEBUG', msg, data); }
    info(msg, data) { this.log('INFO', msg, data); }
    success(msg, data) { this.log('SUCCESS', msg, data); }
    error(msg, data) { this.log('ERROR', msg, data); }
}

module.exports = UniversalLogger;
