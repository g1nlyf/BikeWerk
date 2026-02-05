const KleinanzeigenParser = require('./kleinanzeigen-parser');
const BikesDatabase = require('./bikes-database-node');
const ScoringService = require('./ScoringService');

class LifecycleManager {
    constructor(db, bot) {
        this.db = db || new BikesDatabase();
        this.bot = bot;
        this.parser = new KleinanzeigenParser();
        this.scoring = new ScoringService(this.db);
    }

    /**
     * Main entry point for syncing bikes
     * @param {string} tier 'hot' | 'medium' | 'all'
     */
    async syncBikes(tier = 'all') {
        console.log(`🔄 Starting LifecycleManager (Tier: ${tier})...`);
        
        let query = 'SELECT * FROM bikes WHERE is_active = 1';
        
        // Tier Logic based on prompt requirements:
        // Hot: Score > 8.5
        // Medium: Score 7 - 8.5
        // All/Others: Rest
        
        if (tier === 'hot') {
            query += ' AND ranking_score > 8.5';
        } else if (tier === 'medium') {
            query += ' AND ranking_score >= 7 AND ranking_score <= 8.5';
        } else {
            // All or Others (Tier C logic handled by scheduling frequency)
        }

        // Add sorting by last_sync_at to prioritize those checked longest ago
        query += ' ORDER BY last_sync_at ASC LIMIT 20'; // Batch size to prevent bans

        try {
            const bikes = await this.db.allQuery(query);
            console.log(`📋 Found ${bikes.length} bikes to sync.`);

            for (const bike of bikes) {
                await this.checkBike(bike);
                // Jitter/Delay to avoid bans
                await new Promise(r => setTimeout(r, Math.random() * 5000 + 2000));
            }
        } catch (e) {
            console.error('❌ SyncService Error:', e);
        }
    }

    async checkBike(bike) {
        if (!bike.original_url) return;

        console.log(`🔎 Checking availability: ${bike.brand} ${bike.model} (${bike.id})`);

        try {
            // We use fetchHtmlContent from parser which handles proxies
            const html = await this.parser.fetchHtmlContent(bike.original_url);
            
            // Check for deletion markers in HTML
            if (this.isDeleted(html)) {
                await this.handleDeletion(bike);
                return;
            }

            // If we are here, bike is active. Check price.
            const newData = this.parser.extractBikeData(html, bike.original_url);
            
            if (newData && newData.price) {
                await this.handlePriceCheck(bike, newData.price);
            }

            // Update last_sync_at
            await this.db.runQuery('UPDATE bikes SET last_sync_at = CURRENT_TIMESTAMP WHERE id = ?', [bike.id]);

        } catch (e) {
            if (e.message.includes('404') || e.message.includes('410') || e.message.includes('Not Found')) {
                await this.handleDeletion(bike);
            } else {
                console.warn(`⚠️ Sync Check Warning for ${bike.id}: ${e.message}`);
                // Maybe increment error count?
            }
        }
    }

    isDeleted(html) {
        if (!html) return true;
        // Common Kleinanzeigen deletion texts
        const markers = [
            'Anzeige ist nicht mehr verfügbar',
            'Die gewünschte Anzeige ist nicht mehr verfügbar',
            'Anzeige gelöscht',
            'Diese Anzeige wurde gelöscht'
        ];
        return markers.some(m => html.includes(m));
    }

    async handleDeletion(bike) {
        console.log(`🗑️ Bike ${bike.id} is no longer available. Archiving...`);
        await this.db.runQuery(`
            UPDATE bikes 
            SET is_active = 0, archived_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [bike.id]);
    }

    async handlePriceCheck(bike, newPrice) {
        if (newPrice !== bike.price) {
            console.log(`💰 Price Change Detected for ${bike.id}: ${bike.price} -> ${newPrice}`);
            
            const oldPrice = bike.price;
            const priceDrop = oldPrice - newPrice;
            const dropPercent = (priceDrop / oldPrice) * 100;

            // Update DB
            await this.db.runQuery('UPDATE bikes SET price = ? WHERE id = ?', [newPrice, bike.id]);
            
            // Recalculate Score
            const fmv = await this.scoring.calculateFMV(bike.brand, bike.model); // This needs verify
            const scoreRes = this.scoring.calculateDesirability({ ...bike, price_eur: newPrice }, fmv || bike.original_price);
            
            await this.db.runQuery('UPDATE bikes SET ranking_score = ? WHERE id = ?', [scoreRes.totalScore, bike.id]);

            // Notify if drop is significant (> 5% or > 50 EUR)
            if (dropPercent > 5 || priceDrop > 50) {
                await this.notifyPriceDrop(bike, oldPrice, newPrice, scoreRes.totalScore);
            }
        }
    }

    async notifyPriceDrop(bike, oldPrice, newPrice, newScore) {
        const msg = `
🔥 <b>PRICE DROP ALERT!</b>
🚲 ${bike.brand} ${bike.model}
📉 <s>${oldPrice}€</s> ➡️ <b>${newPrice}€</b>
⭐ New Score: ${newScore}
🔗 <a href="${bike.original_url}">Link</a>
        `.trim();

        console.log(msg); // Log locally

        // If bot instance is available, send to admin or channel
        if (this.bot) {
            // Assuming bot has sendMessage or we can use a configured channel ID
            const chatId = process.env.TELEGRAM_CHANNEL_ID || process.env.ADMIN_CHAT_ID;
            if (chatId) {
                try {
                    await this.bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML' });
                } catch (e) {
                    console.error('Failed to send price drop notification', e);
                }
            }
        }
    }

    /**
     * The Sanitizer: Cleans up old junk
     */
    async runSanitizer() {
        console.log('🧹 Running Sanitizer...');
        
        // 1. Hard Delete: Archived > 30 days
        await this.db.runQuery(`
            DELETE FROM bikes 
            WHERE is_active = 0 
            AND archived_at < datetime("now", "-30 days")
        `);

        // 2. Soft Cleanup: Active > 14 days AND Score < 6.0
        // We archive them to clear the active catalog
        await this.db.runQuery(`
            UPDATE bikes 
            SET is_active = 0, archived_at = CURRENT_TIMESTAMP
            WHERE is_active = 1 
            AND created_at < datetime("now", "-14 days")
            AND ranking_score < 6.0
        `);
        
        console.log('✨ Sanitizer Complete.');
    }
}

module.exports = LifecycleManager;
