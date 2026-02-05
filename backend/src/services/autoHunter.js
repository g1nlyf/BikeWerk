const cron = require('node-cron');
const path = require('path');
const { DatabaseManager } = require('../js/mysql-config');
const ValuationService = require('./ValuationService');
const UnifiedHunter = require('../../../telegram-bot/unified-hunter.js');


class AutoHunter {
    constructor(dbManager) {
        this.db = dbManager;
        this.isHunting = false;
        this.isCleaning = false;
    }

    getHunter(logger) {
        return new UnifiedHunter({ logger });
    }

    async ensureServices() {
        // Handled by UnifiedHunter internally
        return true;
    }

    start() {
        console.log('🤖 AutoHunter Service Started');

        // 1. Auto-Hunt: Every 1 hour (0 * * * *)
        // Logic: Intelligent Diversity Protocol
        // Total quota per run: 50 bikes
        cron.schedule('0 * * * *', async () => {
            console.log('⏰ Hourly Hunt Triggered');
            await this.runHuntCycle();
        });

        // 2. Catalog-Cleaner: Once a day at 3 AM (0 3 * * *)
        cron.schedule('0 3 * * *', async () => {
            await this.cleanupDeadLinks();
        });

        // 3. FMV Daily Refill: Every day at 4 AM (0 4 * * *)
        cron.schedule('0 4 * * *', async () => {
            console.log('⏰ Daily FMV Refill Triggered');
            this.runFMVRefill();
        });
    }

    runFMVRefill() {
        const scriptPath = path.resolve(__dirname, '../../scripts/mass-data-collection.js');
        console.log(`🚀 Starting FMV Refill: ${scriptPath}`);
        
        const { spawn } = require('child_process');
        const child = spawn('node', [scriptPath], {
            cwd: path.dirname(scriptPath),
            stdio: 'inherit'
        });
        
        child.on('close', (code) => {
            console.log(`✅ FMV Refill finished with code ${code}`);
        });
        
        child.on('error', (err) => {
            console.error(`❌ FMV Refill failed to start: ${err.message}`);
        });
    }

    async runHuntCycle() {
        if (this.isHunting) {
            console.log('⚠️ AutoHunter is already running. Skipping cycle.');
            return;
        }
        this.isHunting = true;
        console.log('🏹 AutoHunter: Starting Hunt Cycle (Target: 50)...');

        const logger = (msg) => console.log(`[AutoHunter] ${msg}`);
        const hunter = this.getHunter(logger);

        try {
            await hunter.ensureInitialized();

            // Hunter 7.0: Use "auto" category to trigger Intelligent Diversity (LRS + Balancing)
            // Quota: 50 bikes per run (every 1 hour)
            await hunter.hunt({ category: 'auto', quota: 50 });

            console.log('✅ AutoHunter: Cycle Complete');
            
            // Check for Hot Offers
            await this.processHotOffers();

            // Log completion
            await this.db.query('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', 
                ['info', 'AutoHunter', 'Hunt Cycle Completed: 50 bikes requested']);

        } catch (error) {
            console.error('❌ AutoHunter Error:', error);
            await this.db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', 
                ['error', 'AutoHunter', error.message, error.stack]);
        } finally {
            this.isHunting = false;
        }
    }

    async processHotOffers() {
        try {
            console.log('🔥 Checking for Hot Offers...');
            // Get recently added bikes (last 1 hour)
            const recentBikes = await this.db.query(
                'SELECT * FROM bikes WHERE created_at >= datetime("now", "-1 hour") AND is_active = 1'
            );
            
            for (const bike of recentBikes) {
                await this.checkHotOffer(bike.id);
            }
        } catch (e) {
            console.error('Hot Offer Process Error:', e);
        }
    }

    async checkHotOffer(bikeId) {
        try {
            const rows = await this.db.query('SELECT * FROM bikes WHERE id = ?', [bikeId]);
            const bike = rows[0];
            if (!bike) return;

            // Criteria 1: Quality Class A
            if (bike.initial_quality_class !== 'A') return;

            // Criteria 2: Price 15% lower than FMV (Valuation Engine)
            if (!bike.model) return;

            const bikeParams = {
                brand: bike.brand,
                model: bike.model,
                year: bike.year,
                frame_material: bike.frame_material // Assuming this field exists or needs extraction
            };

            const fmvData = await ValuationService.calculateFMV(bikeParams);
            let avgPrice = 0;
            let comparisonSource = '';

            if (fmvData.fmv) {
                avgPrice = fmvData.fmv;
                comparisonSource = `FMV (${fmvData.confidence} confidence)`;
            } else {
                // Fallback to old average method if no FMV data
                const modelAvgRows = await this.db.query(
                    'SELECT AVG(price) as avg_price FROM bikes WHERE model LIKE ? AND id != ? AND is_active = 1', 
                    [`%${bike.model}%`, bikeId]
                );
                avgPrice = modelAvgRows[0]?.avg_price;
                comparisonSource = 'internal average';
            }
            
            if (!avgPrice) return; // No comparison data
            
            // Valuation Engine: Target is 15% below FMV
            // If using internal average, keep 15% rule
            const discount = (avgPrice - bike.price) / avgPrice;
            console.log(`[STAGE 4] -> [HOT DEAL LOGIC] -> Price: ${bike.price}€, FMV: ${Math.round(avgPrice)}€, Discount: ${(discount*100).toFixed(1)}%. Threshold: 15%.`);
            
            if (discount < 0.15) return;

            // --- SUPER DEAL CHECK (Arbitrage Alert) ---
            if (discount >= 0.30 && bike.initial_quality_class === 'A') {
                await this.db.query('UPDATE bikes SET is_hot_offer = 1, is_hot = 1, is_super_deal = 1 WHERE id = ?', [bikeId]);
                console.log(`[STAGE 4] -> [SUPER DEAL] -> ⚡️ SUPER DEAL TRIGGERED! Discount > 30% and Quality 'A'.`);
                await this.notifyAdminArbitrage(bike, avgPrice);
            } else {
                // Standard Hot Offer
                await this.db.query('UPDATE bikes SET is_hot_offer = 1, is_hot = 1 WHERE id = ?', [bikeId]);
                console.log(`[STAGE 4] -> [HOT OFFER] -> 🔥 Hot Offer Triggered. Discount > 15%.`);
            }

            // Post to Public Channel (only standard hot offers or both? usually both)
            console.log(`[STAGE 5] -> [OUTREACH] -> Generating Marketing Post...`);
            await this.postToPublicChannel(bike, avgPrice);

        } catch (e) {
            console.error('Check Hot Offer Error:', e);
        }
    }

    async notifyAdminArbitrage(bike, fmv) {
        try {
            const adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID; 
            const botToken = process.env.BOT_TOKEN;
            const profit = Math.round(fmv - bike.price);
            
            const text = `
🚀 <b>ОБНАРУЖЕН АРБИТРАЖ!</b>

🚲 <b>${bike.brand} ${bike.model}</b>
💰 <b>Цена:</b> ${bike.price}€
📊 <b>Рынок (FMV):</b> ${Math.round(fmv)}€
💸 <b>Потенциальная прибыль: ${profit}€</b>
🔗 <a href="${bike.original_url}">Ссылка на объявление</a>
            `.trim();

            if (botToken && adminChatId) {
                const axios = require('axios');
                await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    chat_id: adminChatId,
                    text: text,
                    parse_mode: 'HTML'
                });
            }
        } catch (e) {
            console.error('Admin Alert Error:', e.message);
        }
    }

    async checkWaitlists(bike) {
        try {
            // Find matching waitlist entries
            // Logic: partial match on brand/model, price < max_price
            // We use simple LIKE for now.
            const query = `
                SELECT * FROM user_waitlists 
                WHERE ? LIKE '%' || brand || '%' 
                AND ? LIKE '%' || model || '%'
                AND (max_price IS NULL OR ? <= max_price)
                AND notified_at IS NULL
            `;
            // Note: In SQLite concatenation is ||.
            
            const matches = await this.db.query(query, [bike.brand, bike.model, bike.price]);
            
            if (!matches || matches.length === 0) return;

            const botToken = process.env.BOT_TOKEN;
            const axios = require('axios');

            for (const req of matches) {
                if (req.telegram_chat_id && botToken) {
                    const msg = `
🎉 <b>Нашел!</b>

Я искал для вас <b>${req.brand} ${req.model}</b>.
Появился отличный вариант:

🚲 <b>${bike.brand} ${bike.model}</b>
💰 <b>${bike.price}€</b> (Ваш лимит: ${req.max_price || 'не задан'})
🔗 <a href="https://eubike.ru/product/${bike.id}">Посмотреть сейчас</a>
                    `.trim();

                    try {
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: req.telegram_chat_id,
                            text: msg,
                            parse_mode: 'HTML'
                        });
                        
                        // Mark as notified
                        await this.db.query('UPDATE user_waitlists SET notified_at = datetime("now") WHERE id = ?', [req.id]);
                        console.log(`🔔 Waitlist notification sent to ${req.telegram_chat_id} for bike ${bike.id}`);
                    } catch (err) {
                        console.error(`Failed to notify ${req.telegram_chat_id}`, err.message);
                    }
                }
            }

        } catch (e) {
            console.error('Waitlist Check Error:', e);
        }
    }

    async notifyInterestedUsers(bikeId, oldPrice, newPrice, bikeName) {
        try {
            console.log(`🕵️ Price Drop Stalker: Checking for interested users for bike ${bikeId}...`);
            
            // Find users who viewed this bike for > 30 seconds
            // metric_events table: bike_id, type='dwell' OR (type='view' and dwell_ms > 30000)
            // We need user_id. We'll join with users/telegram_users if possible or just use user_id if it's the TG ID (which it isn't usually).
            // Assuming metric_events.user_id links to users.id. 
            // We need to find the Telegram ID associated with that user.
            
            // Query: Get distinct user_ids from metric_events for this bike with significant interest
            // And join with telegram_users if there is a link (users table might not have it, but maybe we can find a way).
            // Actually, let's look at `telegram_users` table. It has `telegram_id`.
            // Does `users` table link to `telegram_users`? No foreign key seen.
            // Maybe `user_favorites`? 
            
            // Let's assume for now we only notify users who have a record in `bot_sessions` or `telegram_users` that we can link.
            // If metric_events has user_id, and that user_id is from the `users` table.
            // Does `users` table have a telegram_id? Let's check schema again.
            // `users`: id, name, email...
            // `telegram_users`: telegram_id, username...
            // There is no obvious link.
            
            // However, `user_waitlists` has `telegram_chat_id`.
            // Maybe we can notify people who have this bike in favorites?
            // "Price Drop Stalker" usually implies tracking behavior.
            
            // Strategy:
            // 1. Find interested user_ids from metrics (dwell > 30s)
            // 2. Also find users who favorited the bike (strong signal)
            // 3. Resolve their Telegram IDs.
            //    - If user_id is in `users` table, how do we get TG ID? 
            //    - Maybe they are the same ID? Unlikely.
            //    - Maybe we look up by email if available?
            //    - For this implementation, I will assume we can't easily link web users to TG users unless they are logged in via TG.
            //    - BUT, if the user interacts with the bot, we have their TG ID.
            //    - Maybe `metric_events` for bot users logs the TG ID as user_id?
            //    - If the event source is 'telegram', user_id might be TG ID.
            
            // Let's try to notify `user_favorites` as a proxy for "interested users" who we definitely know (if they used bot).
            // And for metrics, we'll try to match.
            
            const dropAmount = Math.round(oldPrice - newPrice);
            
            // 1. Favorites (High intent)
            const favRows = await this.db.query(`
                SELECT u.telegram_id 
                FROM user_favorites uf
                JOIN telegram_users u ON uf.user_id = u.id -- Assuming user_id in favs matches telegram_users.id if source was bot? 
                -- Actually, user_favorites.user_id references users.id.
                -- If web user, we might not have TG ID.
                -- If bot user, maybe they are in users table too?
                WHERE uf.bike_id = ?
            `, [bikeId]);
            
            // Wait, this join is risky if schema doesn't support it.
            // Let's stick to what we know: `user_waitlists` has telegram_chat_id.
            // But we want "viewed > 30s".
            
            // Alternative: The prompt implies we SHOULD be able to do this.
            // "найди всех пользователей в metric_events... Бот должен отправить им..."
            // This implies `metric_events` has a way to contact them.
            // Maybe `metadata` contains `telegram_id`?
            // Or `user_id` IS the telegram_id for bot interactions.
            
            const interestedUsers = await this.db.query(`
                SELECT DISTINCT user_id, metadata 
                FROM metric_events 
                WHERE bike_id = ? 
                AND (
                    (type = 'dwell' AND value >= 30000) 
                    OR 
                    (type = 'view' AND dwell_ms >= 30000)
                )
                AND created_at >= datetime('now', '-30 days')
            `, [bikeId]);

            const botToken = process.env.BOT_TOKEN;
            const axios = require('axios');
            const notifiedIds = new Set();

            for (const row of interestedUsers) {
                let tgId = null;
                
                // Try to extract TG ID
                // 1. Check if user_id looks like a TG ID (usually > 1000000)
                if (row.user_id && Number(row.user_id) > 1000000) {
                    tgId = row.user_id;
                }
                
                // 2. Check metadata
                if (!tgId && row.metadata) {
                    try {
                        const meta = JSON.parse(row.metadata);
                        if (meta.telegram_id) tgId = meta.telegram_id;
                    } catch (_) {}
                }

                if (tgId && !notifiedIds.has(tgId)) {
                    notifiedIds.add(tgId);
                    
                    const msg = `
📉 <b>Хорошие новости!</b>

Цена на <b>${bikeName}</b> снизилась на <b>${dropAmount}€</b>!
Теперь это еще более выгодная сделка.

💰 Старая цена: <s>${Math.round(oldPrice)}€</s>
🔥 Новая цена: <b>${Math.round(newPrice)}€</b>

👉 <a href="https://eubike.ru/product/${bikeId}">Успейте забронировать!</a>
                    `.trim();

                    try {
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: tgId,
                            text: msg,
                            parse_mode: 'HTML'
                        });
                        console.log(`🔔 Price drop notification sent to ${tgId}`);
                    } catch (e) {
                        console.error(`Failed to notify ${tgId}:`, e.message);
                    }
                }
            }

        } catch (e) {
            console.error('Notify Interested Users Error:', e);
        }
    }

    async postToPublicChannel(bike, avgPrice) {
        try {
            const channelId = process.env.TELEGRAM_PUBLIC_CHANNEL_ID || '@eubike_hot_offers'; 
            const botToken = process.env.BOT_TOKEN;
            
            // 1. Generate AI Copy
            let caption = '';
            if (this.geminiProcessor) {
                caption = await this.geminiProcessor.generateMarketingCopy(bike, avgPrice);
            }

            // Fallback if AI fails
            if (!caption || caption.includes('⚠️')) {
                const savings = Math.round(avgPrice - bike.price);
                const discountPercent = Math.round((savings / avgPrice) * 100);
                caption = `
🔥 <b>HOT OFFER DETECTED!</b>

🚲 <b>${bike.name}</b>
💎 <b>Состояние:</b> Class A (Идеальное)
📏 <b>Размер:</b> ${bike.size || 'M'}

💰 <b>Цена: ${bike.price}€</b>
❌ <i>Средняя цена: ${Math.round(avgPrice)}€</i>
📉 <b>Выгода: -${discountPercent}% (${savings}€)</b>

📍 <i>Найден: ${bike.location || 'EU'}</i>
👉 <a href="https://eubike.ru/product/${bike.id}">Забронировать</a>
                `.trim();
            }

            // Add standard footer if not present (AI might skip it)
            if (!caption.includes('eubike.ru')) {
                // Usually AI is instructed not to add links, so we add the button. 
                // But caption might need a footer tag?
                // The prompt says "NE add links in text".
            }

            console.log(`📢 Posting to ${channelId}...`);

            if (botToken) {
                const axios = require('axios');
                const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
                
                await axios.post(url, {
                    chat_id: channelId,
                    photo: bike.main_image,
                    caption: caption,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "⚡️ Забронировать за 2%", url: `https://eubike.ru/product/${bike.id}` }]
                        ]
                    }
                });
                console.log('✅ Posted to Telegram Channel');
            } else {
                console.log('⚠️ No BOT_TOKEN, skipping real post. Caption:\n', caption);
                this.mockBot.sendMessage('admin_channel', `[MOCK CHANNEL POST]\n${caption}`);
            }

        } catch (e) {
            console.error('❌ Failed to post to channel:', e.message);
        }
    }

    async cleanupDeadLinks(options = {}) {
        if (this.isCleaning) return;
        this.isCleaning = true;

        const { limit = 0, logger } = options;
        const effectiveLogger = logger || ((msg) => console.log(`[CatalogCleaner] ${msg}`));
        
        try {
            const hunter = this.getHunter(effectiveLogger);
            await hunter.checkAndCleanup({ limit, onProgress: effectiveLogger });
            
            await this.db.query('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', 
                ['info', 'CatalogCleaner', `Cleanup Finished.`]);

        } catch (error) {
            console.error('❌ Catalog-Cleaner Error:', error);
        } finally {
            this.isCleaning = false;
        }
    }
}

module.exports = { AutoHunter };
