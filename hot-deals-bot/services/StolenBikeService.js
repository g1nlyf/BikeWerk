/**
 * StolenBikeService - Работа с локальной SQLite базой stolen_bikes
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class StolenBikeService {
    constructor() {
        try {
            // Путь к БД
            const dbPath = path.join(__dirname, '../database/stolen_bikes.db');

            // Создаём папку database если нет
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');

            // Создаём таблицу если не существует
            this.initDatabase();

            console.log('✅ StolenBikeService initialized (SQLite)');
            this.enabled = true;
        } catch (error) {
            console.error('❌ Failed to initialize StolenBikeService:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Инициализация базы данных
     */
    initDatabase() {
        // Run initial migration
        const migrationPath = path.join(__dirname, '../migrations/001_stolen_bikes.sql');
        if (fs.existsSync(migrationPath)) {
            const migration = fs.readFileSync(migrationPath, 'utf-8');
            this.db.exec(migration);
        }

        // Run user migration
        const migrationPath2 = path.join(__dirname, '../migrations/002_users_and_stats.sql');
        if (fs.existsSync(migrationPath2)) {
            const migration2 = fs.readFileSync(migrationPath2, 'utf-8');
            this.db.exec(migration2);
        }

        // Run price migration
        const migrationPath3 = path.join(__dirname, '../migrations/003_add_price_to_stolen.sql');
        if (fs.existsSync(migrationPath3)) {
            try {
                // Check if column exists first to avoid error on restart
                const check = this.db.prepare("SELECT count(*) as cnt FROM pragma_table_info('stolen_bikes') WHERE name='price'").get();
                if (check.cnt === 0) {
                    const migration3 = fs.readFileSync(migrationPath3, 'utf-8');
                    this.db.exec(migration3);
                    console.log('✅ Applied migration 003 (price columns)');
                }
            } catch (e) {
                console.error('Migration 003 error:', e.message);
            }
        }

        console.log('✅ Database initialized');
    }

    // ... duplicate check methods ...

    checkDuplicateInStolen(url) {
        if (!this.enabled) return null;
        try {
            return this.db.prepare('SELECT * FROM stolen_bikes WHERE url = ? LIMIT 1').get(url);
        } catch (error) { return null; }
    }

    checkDuplicateInBikes(url) {
        try {
            const backendDbPath = path.join(__dirname, '../../backend/database/eubike.db');
            if (!fs.existsSync(backendDbPath)) return null;
            const backendDb = new Database(backendDbPath, { readonly: true });
            const res = backendDb.prepare('SELECT id, name, price FROM bikes WHERE source_url = ? LIMIT 1').get(url);
            backendDb.close();
            return res;
        } catch (error) { return null; }
    }

    /**
     * Сохранить новый bike в stolen_bikes
     * @param {Object} data - { url, source, rawMessage, userId, username, title, price, currency }
     * @returns {Object}
     */
    saveStolenBike(data) {
        if (!this.enabled) throw new Error('Database not enabled');

        try {
            const stmt = this.db.prepare(`
                INSERT INTO stolen_bikes (url, source, raw_message, added_by_user_id, added_by_username, status, processed, title, price, currency)
                VALUES (?, ?, ?, ?, ?, 'completed', 1, ?, ?, ?)
            `);

            const info = stmt.run(
                data.url,
                data.source,
                data.rawMessage,
                data.userId,
                data.username,
                data.title || null,
                data.price || 0,
                data.currency || 'EUR'
            );

            const inserted = this.db.prepare('SELECT * FROM stolen_bikes WHERE rowid = ?').get(info.lastInsertRowid);
            console.log(`✅ Saved bike: ${inserted.id}`);
            return inserted;
        } catch (error) {
            console.error('Error saving stolen bike:', error);
            throw error;
        }
    }

    /**
     * Обновить статус обработки
     * @param {string} id - ID записи
     * @param {Object} updates - { status, processed, bikeId, errorMessage }
     * @returns {Object}
     */
    updateStatus(id, updates) {
        if (!this.enabled) throw new Error('Database not enabled');

        try {
            const fields = [];
            const values = [];

            if (updates.status) {
                fields.push('status = ?');
                values.push(updates.status);
            }
            if (updates.processed !== undefined) {
                fields.push('processed = ?');
                values.push(updates.processed ? 1 : 0);
            }
            if (updates.bikeId) {
                fields.push('bike_id = ?');
                values.push(updates.bikeId);
            }
            if (updates.errorMessage) {
                fields.push('error_message = ?');
                values.push(updates.errorMessage);
            }

            if (fields.length === 0) {
                return this.getById(id);
            }

            values.push(id);

            const stmt = this.db.prepare(`
                UPDATE stolen_bikes 
                SET ${fields.join(', ')} 
                WHERE id = ?
            `);

            stmt.run(...values);

            return this.getById(id);
        } catch (error) {
            console.error('Error updating status:', error);
            throw error;
        }
    }

    /**
     * Получить все обработанные байки для /hot
     * @param {number} limit - Лимит записей
     * @param {number} offset - Оффсет для пагинации
     * @returns {Array}
     */
    getCompletedBikes(limit = 10, offset = 0) {
        if (!this.enabled) return [];

        try {
            const stmt = this.db.prepare(`
                SELECT * FROM stolen_bikes 
                WHERE status = 'completed' AND processed = 1
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `);

            return stmt.all(limit, offset);
        } catch (error) {
            console.error('Error getting completed bikes:', error);
            return [];
        }
    }

    /**
     * Получить статистику
     * @returns {Object}
     */
    getStats() {
        if (!this.enabled) return null;

        try {
            // Общее количество
            const total = this.db.prepare('SELECT COUNT(*) as count FROM stolen_bikes').get().count;

            // По статусам
            const byStatus = this.db.prepare(`
                SELECT status, COUNT(*) as count 
                FROM stolen_bikes 
                GROUP BY status
            `).all();

            const stats = {
                total,
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0
            };

            byStatus.forEach(row => {
                stats[row.status] = row.count;
            });

            // По пользователям
            const byUser = this.db.prepare(`
                SELECT added_by_username, COUNT(*) as count 
                FROM stolen_bikes 
                GROUP BY added_by_username
            `).all();

            const userStats = {};
            byUser.forEach(row => {
                userStats[row.added_by_username || 'Unknown'] = row.count;
            });

            stats.byUser = userStats;

            return stats;
        } catch (error) {
            console.error('Error getting stats:', error);
            return null;
        }
    }

    /**
     * Удалить запись
     * @param {string} id - ID записи
     * @returns {boolean}
     */
    deleteBike(id) {
        if (!this.enabled) throw new Error('Database not enabled');

        try {
            const stmt = this.db.prepare('DELETE FROM stolen_bikes WHERE id = ?');
            const info = stmt.run(id);

            console.log(`✅ Deleted stolen bike: ${id}`);
            return info.changes > 0;
        } catch (error) {
            console.error('Error deleting bike:', error);
            throw error;
        }
    }

    /**
     * Получить запись по ID
     * @param {string} id 
     * @returns {Object|null}
     */
    getById(id) {
        if (!this.enabled) return null;

        try {
            const stmt = this.db.prepare('SELECT * FROM stolen_bikes WHERE id = ? LIMIT 1');
            return stmt.get(id) || null;
        } catch (error) {
            console.error('Error getting bike by id:', error);
            return null;
        }
    }

    /**
     * Получить БД для прямого доступа (для formatBikeCard)
     */
    getDatabase() {
        return this.db;
    }
}

module.exports = new StolenBikeService();
