const { DatabaseManager } = require('../js/mysql-config.js');

class EuphoriaService {
    constructor(dbManager) {
        this.db = dbManager || new DatabaseManager();
    }

    // Map technical status to emotional status and description
    getEmotionalStatus(technicalStatus) {
        const mapping = {
            'pending': {
                emotional_status: 'waiting_payment',
                title: 'Ожидание оплаты',
                message: 'Ваш велосипед забронирован и ждет подтверждения.',
                icon: '⏳',
                progress: 10
            },
            'paid': {
                emotional_status: 'created',
                title: 'Байк забронирован!',
                message: 'Поздравляем! Велосипед теперь ваш. Мы готовим его к путешествию.',
                icon: '🚲',
                progress: 20
            },
            'hunting': {
                emotional_status: 'hunting',
                title: 'Агент выехал к продавцу',
                message: 'Наш эксперт уже в пути, чтобы лично проверить каждый винтик.',
                icon: '🕵️',
                progress: 40
            },
            'inspection': {
                emotional_status: 'inspection',
                title: 'Проверка AI-Inspector',
                message: 'Сканируем раму на микротрещины и проверяем износ компонентов.',
                icon: '🔬',
                progress: 60
            },
            'packing': {
                emotional_status: 'packing',
                title: 'Упаковка в Imperial Box',
                message: 'Бережно упаковываем байк в защитный кокон для безопасной доставки.',
                icon: '📦',
                progress: 75
            },
            'shipped': {
                emotional_status: 'shipped',
                title: 'Ваш байк в пути!',
                message: 'Груз передан логистам. Скоро он будет у вас.',
                icon: '🚚',
                progress: 85
            },
            'delivered': {
                emotional_status: 'delivered',
                title: 'Прибытие!',
                message: 'Велосипед доставлен. Время катать!',
                icon: '🎉',
                progress: 100
            }
        };

        return mapping[technicalStatus] || {
            emotional_status: 'unknown',
            title: 'Статус уточняется',
            message: 'Мы уточняем информацию по вашему заказу.',
            icon: '🤔',
            progress: 0
        };
    }

    async getOrderTracking(orderId) {
        // Get order details
        const order = (await this.db.query(
            `SELECT * FROM shop_orders WHERE id = ? OR id = ?`, 
            [orderId, orderId] // Assuming orderId can be ID
        ))[0];

        if (!order) return null;

        // Prefer detailed_status if available, otherwise fallback to standard status
        const effectiveStatus = order.detailed_status || order.status;
        const emotionalData = this.getEmotionalStatus(effectiveStatus);
        
        // Find relevant content
        // We look for content triggers matching the mapped emotional_status key
        const content = await this.db.query(
            `SELECT * FROM content_triggers WHERE status_key = ?`,
            [emotionalData.emotional_status]
        );

        // Calculate urgency (mock logic for now, real logic would check expiration)
        let urgency = order.urgency_level || 'normal';
        if (order.reservation_expires_at && new Date(order.reservation_expires_at) < new Date(Date.now() + 2 * 60 * 60 * 1000)) {
            urgency = 'high';
        }

        return {
            order_id: order.id,
            technical_status: effectiveStatus,
            base_status: order.status,
            ...emotionalData,
            urgency_level: urgency,
            reservation_expires_at: order.reservation_expires_at,
            content_feed: content,
            last_updated: new Date()
        };
    }

    async updateOrderStatus(orderId, newStatus) {
        const allowedStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        let dbStatus = 'processing'; // Default for custom statuses
        
        if (allowedStatuses.includes(newStatus)) {
            dbStatus = newStatus;
        } else {
            // Map special statuses to DB-compatible ones
            if (newStatus === 'paid') dbStatus = 'confirmed';
            // hunting, inspection, packing -> processing
        }
        
        await this.db.query(
            `UPDATE shop_orders SET status = ?, detailed_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [dbStatus, newStatus, orderId]
        );
        return this.getOrderTracking(orderId);
    }
    
    // For cron job
    async checkUrgency() {
        // Find orders with expiring reservations (e.g. within 2 hours) that are 'pending'
        const expiringOrders = await this.db.query(
            `SELECT * FROM shop_orders 
             WHERE status = 'pending' 
             AND reservation_expires_at IS NOT NULL 
             AND reservation_expires_at < datetime('now', '+2 hours')
             AND urgency_level != 'high'`
        );
        
        for (const order of expiringOrders) {
            await this.db.query(
                `UPDATE shop_orders SET urgency_level = 'high' WHERE id = ?`,
                [order.id]
            );
            console.log(`[UrgencyMonitor] Set order ${order.id} to HIGH urgency`);
            // Here we would trigger Push Notification logic
        }
        
        return expiringOrders.length;
    }
}

module.exports = { EuphoriaService };
