const UnifiedHunter = require('../../../telegram-bot/unified-hunter');
const priceCalculator = require('./PriceCalculatorService');
const BikesDatabase = require('../../../telegram-bot/bikes-database-node');
const cheerio = require('cheerio');
const axios = require('axios');

class PriceMonitor {
    constructor() {
        this.logger = console.log;
        // Use a lightweight Hunter just for checking logic
        this.hunter = new UnifiedHunter({ logger: this.log.bind(this) });
        this.bikesDB = new BikesDatabase();
    }

    log(msg) {
        console.log(`[PriceMonitor] ${msg}`);
    }

    async runDailyMonitor(limit = 50) {
        this.log('🚀 Starting Mirror Pricing Monitor...');
        await this.hunter.ensureInitialized();
        await this.bikesDB.ensureInitialized();

        // 1. Fetch active bikes
        let bikes = [];
        try {
            bikes = await this.bikesDB.getLeastRecentlyCheckedBikes(limit);
        } catch (e) {
            this.log(`⚠️ Error fetching LRS bikes: ${e.message}`);
        }

        if (!bikes || bikes.length === 0) {
            // Fallback if no checked_at date yet or method fails
            bikes = await this.bikesDB.allQuery('SELECT * FROM bikes WHERE is_active = 1 LIMIT ?', [limit]);
        }
        
        this.log(`🔍 Monitoring ${bikes.length} bikes...`);

        for (const bike of bikes) {
            await this.checkBike(bike);
            // 5-10s delay as requested (Mirror Pricing Rule)
            const delay = 5000 + Math.random() * 5000;
            await new Promise(r => setTimeout(r, delay));
        }
        
        this.log('✅ Daily Monitor Complete.');
    }

    async checkBike(bike) {
        const url = bike.original_url;
        if (!url || !url.includes('kleinanzeigen')) return;

        this.log(`Checking Bike ${bike.id}: ${bike.brand} ${bike.model} (${bike.price}€)`);

        try {
            // Use Hunter's fetchHtml to use its rate limiter and UA rotation
            const html = await this.hunter.fetchHtml(url);
            const $ = cheerio.load(html);
            
            // Kleinanzeigen Detail Page Price parsing
            // Usually #viewad-price
            let priceText = $('#viewad-price').text().trim();
            if (!priceText) {
                // Try meta tag
                priceText = $('meta[property="product:price:amount"]').attr('content');
            }
            
            if (!priceText) {
                this.log(`⚠️ Could not parse price for ${bike.id}. Possible layout change or sold.`);
                // If sold, check for "Gelöscht" text
                if ($('#viewad-status .deleted-badge').length > 0 || html.includes('Die Anzeige ist nicht mehr verfügbar')) {
                    this.log(`❌ Bike ${bike.id} is SOLD/Deleted.`);
                    await this.bikesDB.setBikeActive(bike.id, false);
                }
                return;
            }
            
            const newPrice = this.hunter.parsePriceEUR(priceText);
            
            if (newPrice > 0 && newPrice < bike.price) {
                // Price DROP!
                const oldPrice = bike.price;
                const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;
                
                this.log(`📉 PRICE DROP DETECTED! ${oldPrice}€ -> ${newPrice}€ (-${dropPercent.toFixed(1)}%)`);
                
                // 1. Update DB Listing Price
                await this.bikesDB.updateBike(bike.id, { price: newPrice });
                
                // 2. Calculate RUB Price for notification
                const calc = priceCalculator.calculate(newPrice, 'Cargo', true);
                
                // 3. Notify if > 5% drop
                if (dropPercent >= 5) {
                    await this.sendDiscountAlert(bike, oldPrice, newPrice, calc.total_price_rub);
                }
            } else if (newPrice > bike.price) {
                 this.log(`📈 Price increased: ${bike.price} -> ${newPrice}€. Updating.`);
                 await this.bikesDB.updateBike(bike.id, { price: newPrice });
            } else {
                 this.log(`= Price stable.`);
            }
            
            // Mark checked
            await this.bikesDB.markBikeChecked(bike.id);

        } catch (e) {
            this.log(`❌ Error checking ${bike.id}: ${e.message}`);
        }
    }

    async sendDiscountAlert(bike, oldPrice, newPrice, newRub) {
        const botToken = process.env.BOT_TOKEN;
        const chatId = process.env.DISCOUNT_CHANNEL_ID || process.env.ADMIN_CHAT_ID;
        
        if (!botToken || !chatId) {
            this.log('⚠️ Missing BOT_TOKEN or Channel ID for alert.');
            return;
        }
        
        const drop = oldPrice - newPrice;
        const text = `
📉 <b>ЦЕНА СНИЖЕНА!</b>

🚲 <b>${bike.brand} ${bike.model}</b>
❌ Старая цена: <strike>${oldPrice}€</strike>
✅ <b>Новая цена: ${newPrice}€</b> (-${drop}€)
🇷🇺 Под ключ: ~${newRub.toLocaleString('ru-RU')}₽

🔗 <a href="${bike.original_url}">Ссылка</a>
        `.trim();

        try {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            });
            this.log('📢 Discount Alert sent.');
        } catch (e) {
            this.log(`⚠️ Failed to send alert: ${e.message}`);
        }
    }
}

module.exports = PriceMonitor;
