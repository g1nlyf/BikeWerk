/**
 * QueueService - Управление очередью обработки URL
 */

const Database = require('better-sqlite3');
const path = require('path');

class QueueService {
    constructor() {
        try {
            const dbPath = path.join(__dirname, '../database/stolen_bikes.db');
            this.db = new Database(dbPath);
            this.enabled = true;
        } catch (error) {
            console.error('❌ QueueService init error:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Добавить URL в очередь
     */
    addToQueue(url, source, chatId) {
        if (!this.enabled) return null;

        try {
            const stmt = this.db.prepare(`
                INSERT INTO processing_queue (url, source, user_chat_id, status)
                VALUES (?, ?, ?, 'queued')
            `);
            const info = stmt.run(url, source, chatId);

            return this.db.prepare('SELECT * FROM processing_queue WHERE rowid = ?').get(info.lastInsertRowid);
        } catch (error) {
            console.error('Error adding to queue:', error);
            return null;
        }
    }

    /**
     * Получить следующий элемент из очереди
     */
    getNext() {
        if (!this.enabled) return null;

        try {
            return this.db.prepare(`
                SELECT * FROM processing_queue 
                WHERE status = 'queued' 
                ORDER BY created_at ASC 
                LIMIT 1
            `).get();
        } catch (error) {
            console.error('Error getting next from queue:', error);
            return null;
        }
    }

    /**
     * Обновить статус элемента очереди
     */
    updateStatus(id, status, stolenBikeId = null, errorMessage = null) {
        if (!this.enabled) return false;

        try {
            const stmt = this.db.prepare(`
                UPDATE processing_queue 
                SET status = ?, stolen_bike_id = ?, error_message = ?, processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            const info = stmt.run(status, stolenBikeId, errorMessage, id);
            return info.changes > 0;
        } catch (error) {
            console.error('Error updating queue status:', error);
            return false;
        }
    }

    /**
     * Получить количество элементов в очереди
     */
    getQueueSize() {
        if (!this.enabled) return 0;

        try {
            return this.db.prepare(`
                SELECT COUNT(*) as count FROM processing_queue 
                WHERE status = 'queued'
            `).get().count;
        } catch (error) {
            console.error('Error getting queue size:', error);
            return 0;
        }
    }

    /**
     * Получить статистику очереди для пользователя
     */
    getUserQueueStats(chatId) {
        if (!this.enabled) return null;

        try {
            const queued = this.db.prepare(`
                SELECT COUNT(*) as count FROM processing_queue 
                WHERE user_chat_id = ? AND status = 'queued'
            `).get(chatId).count;

            const processing = this.db.prepare(`
                SELECT COUNT(*) as count FROM processing_queue 
                WHERE user_chat_id = ? AND status = 'processing'
            `).get(chatId).count;

            const completed = this.db.prepare(`
                SELECT COUNT(*) as count FROM processing_queue 
                WHERE user_chat_id = ? AND status = 'completed'
            `).get(chatId).count;

            const failed = this.db.prepare(`
                SELECT COUNT(*) as count FROM processing_queue 
                WHERE user_chat_id = ? AND status = 'failed'
            `).get(chatId).count;

            return { queued, processing, completed, failed };
        } catch (error) {
            console.error('Error getting user queue stats:', error);
            return null;
        }
    }

    /**
     * Очистить старые записи (старше 7 дней)
     */
    cleanup(days = 7) {
        if (!this.enabled) return 0;

        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.setDate() - days);

            const stmt = this.db.prepare(`
                DELETE FROM processing_queue 
                WHERE status IN ('completed', 'failed') 
                AND processed_at < ?
            `);
            const info = stmt.run(cutoff.toISOString());
            return info.changes;
        } catch (error) {
            console.error('Error cleaning up queue:', error);
            return 0;
        }
    }
}

module.exports = new QueueService();
