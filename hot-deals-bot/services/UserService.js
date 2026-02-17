/**
 * UserService - Управление пользователями и ролями
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class UserService {
    constructor() {
        try {
            const dbPath = path.join(__dirname, '../database/stolen_bikes.db');
            this.db = new Database(dbPath);
            this.initTables();
            this.enabled = true;
        } catch (error) {
            console.error('❌ UserService init error:', error.message);
            this.enabled = false;
        }
    }

    initTables() {
        const migrationPath = path.join(__dirname, '../migrations/002_users_and_stats.sql');
        if (fs.existsSync(migrationPath)) {
            const migration = fs.readFileSync(migrationPath, 'utf-8');
            this.db.exec(migration);
        }

        // Run user tracking migration
        const migrationPath4 = path.join(__dirname, '../migrations/004_add_user_tracking.sql');
        if (fs.existsSync(migrationPath4)) {
            try {
                // Check if column exists first to avoid error on restart
                const check = this.db.prepare("SELECT count(*) as cnt FROM pragma_table_info('users') WHERE name='last_hot_check'").get();
                if (check.cnt === 0) {
                    const migration4 = fs.readFileSync(migrationPath4, 'utf-8');
                    this.db.exec(migration4);
                    console.log('✅ Applied migration 004 (user tracking)');
                }
            } catch (e) {
                console.error('Migration 004 error:', e.message);
            }
        }
    }

    /**
     * Получить или создать пользователя
     */
    getOrCreateUser(chatId, username, firstName) {
        if (!this.enabled) return null;

        try {
            let user = this.db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);

            if (!user) {
                const stmt = this.db.prepare(`
                    INSERT INTO users (chat_id, username, first_name, role)
                    VALUES (?, ?, ?, 'guest')
                `);
                stmt.run(chatId, username, firstName);
                user = this.db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
            } else {
                // Обновляем last_active
                this.db.prepare('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE chat_id = ?').run(chatId);
            }

            return user;
        } catch (error) {
            console.error('Error in getOrCreateUser:', error);
            return null;
        }
    }

    /**
     * Установить роль пользователя
     */
    setUserRole(chatId, role) {
        if (!this.enabled) return false;

        try {
            const stmt = this.db.prepare('UPDATE users SET role = ? WHERE chat_id = ?');
            const info = stmt.run(role, chatId);
            return info.changes > 0;
        } catch (error) {
            console.error('Error setting user role:', error);
            return false;
        }
    }

    /**
     * Обновить данные пользователя
     */
    updateUser(chatId, data) {
        if (!this.enabled || !data) return false;

        try {
            const keys = Object.keys(data);
            if (keys.length === 0) return false;

            const setClause = keys.map(k => `${k} = ?`).join(', ');
            const values = Object.values(data);
            values.push(chatId);

            const stmt = this.db.prepare(`UPDATE users SET ${setClause} WHERE chat_id = ?`);
            const info = stmt.run(...values);
            return info.changes > 0;
        } catch (error) {
            console.error('Error updating user:', error);
            return false;
        }
    }

    /**
     * Получить пользователя
     */
    getUser(chatId) {
        if (!this.enabled) return null;

        try {
            return this.db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    /**
     * Проверить права пользователя
     */
    canUpload(chatId) {
        const user = this.getUser(chatId);
        return user && (user.role === 'manager' || user.role === 'admin');
    }

    /**
     * Получить всех пользователей
     */
    getAllUsers() {
        if (!this.enabled) return [];

        try {
            return this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
        } catch (error) {
            console.error('Error getting all users:', error);
            return [];
        }
    }

    /**
     * Записать событие статистики
     */
    logEvent(eventType, chatId, metadata = null) {
        if (!this.enabled) return;

        try {
            const stmt = this.db.prepare(`
                INSERT INTO bot_stats (event_type, user_chat_id, metadata)
                VALUES (?, ?, ?)
            `);
            stmt.run(eventType, chatId, metadata ? JSON.stringify(metadata) : null);
        } catch (error) {
            console.error('Error logging event:', error);
        }
    }

    /**
     * Получить статистику
     */
    getStats(days = 7) {
        if (!this.enabled) return null;

        try {
            const since = new Date();
            since.setDate(since.getDate() - days);
            const sinceStr = since.toISOString();

            // Общая статистика
            const totalUploads = this.db.prepare(`
                SELECT COUNT(*) as count FROM bot_stats 
                WHERE event_type = 'upload_start' AND created_at >= ?
            `).get(sinceStr).count;

            const successUploads = this.db.prepare(`
                SELECT COUNT(*) as count FROM bot_stats 
                WHERE event_type = 'upload_success' AND created_at >= ?
            `).get(sinceStr).count;

            const failedUploads = this.db.prepare(`
                SELECT COUNT(*) as count FROM bot_stats 
                WHERE event_type = 'upload_fail' AND created_at >= ?
            `).get(sinceStr).count;

            const viewsCount = this.db.prepare(`
                SELECT COUNT(*) as count FROM bot_stats 
                WHERE event_type = 'view_hot' AND created_at >= ?
            `).get(sinceStr).count;

            // Средний процент заполнения (из metadata)
            const fillRates = this.db.prepare(`
                SELECT metadata FROM bot_stats 
                WHERE event_type = 'upload_success' AND metadata IS NOT NULL AND created_at >= ?
            `).all(sinceStr);

            let avgFillRate = 0;
            if (fillRates.length > 0) {
                const rates = fillRates.map(r => {
                    try {
                        const meta = JSON.parse(r.metadata);
                        return meta.fillRate || 0;
                    } catch {
                        return 0;
                    }
                }).filter(r => r > 0);

                if (rates.length > 0) {
                    avgFillRate = rates.reduce((a, b) => a + b, 0) / rates.length;
                }
            }

            return {
                totalUploads,
                successUploads,
                failedUploads,
                viewsCount,
                avgFillRate: Math.round(avgFillRate * 100) / 100,
                successRate: totalUploads > 0 ? Math.round((successUploads / totalUploads) * 100) : 0
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return null;
        }
    }
}

module.exports = new UserService();
