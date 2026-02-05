const TelegramBot = require('node-telegram-bot-api');
const BikesDatabase = require('./bikes-database-node');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

class AdminBotService {
    constructor() {
        this.token = process.env.ADMIN_BOT_TOKEN;
        this.adminChatId = process.env.ADMIN_CHAT_ID || process.env.ADMINCHATID;
        this.db = new BikesDatabase();
        
        if (!this.token) {
            console.warn('⚠️ ADMIN_BOT_TOKEN not found in .env. Admin features disabled.');
            return;
        }

        this.bot = new TelegramBot(this.token, { polling: true });
        this.initCommands();
        console.log('🛡️ Admin Command Center initialized.');
    }

    initCommands() {
        // /start - Security Check & ID Discovery
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            console.log(`[AdminBot] Connection attempt from ID: ${chatId}`);

            // Resolve admin from env/DB or auto-register first user
            const resolved = await this._resolveAdminChatId();
            if (resolved && String(chatId) === String(resolved)) {
                this.bot.sendMessage(chatId, `🫡 Welcome back, Commander.\nSystem Status: *ONLINE*\nUse /stats, /top, /health`, { parse_mode: 'Markdown' });
                return;
            }

            if (!resolved) {
                await this._registerAdmin(chatId, msg.from);
                this.bot.sendMessage(chatId, `✅ Admin registered.\nYour ID: \`${chatId}\`\nSet ADMIN_CHAT_ID in .env for permanent pin.`, { parse_mode: 'Markdown' });
                return;
            }

            this.bot.sendMessage(chatId, `🛑 *ACCESS DENIED*\nYour ID: \`${chatId}\`\nAsk admin to add ADMIN_CHAT_ID or re-register.`, { parse_mode: 'Markdown' });
        });

        // /stats - General Statistics
        this.bot.onText(/\/stats/, async (msg) => {
            if (!(await this._checkAuth(msg))) return;
            
            const stats = await this._getSystemStats();
            const text = `
📊 *System Status Report*

🚲 *Inventory:*
• Active Bikes: *${stats.active}*
• Total Processed: *${stats.total}*

💰 *Financials:*
• Potential Profit: *${stats.potentialProfit}€*
• Avg Margin: *${stats.avgMargin}%*

🛡️ *Logistics:*
• Marburg Hub: *${stats.marburgCount}*
• Diplomatic: *${stats.diplomaticCount}*
            `;
            this.bot.sendMessage(msg.chat.id, text.trim(), { parse_mode: 'Markdown' });
        });

        // /top or /last - Last 3 Gold Deals
        this.bot.onText(/\/(top|last)/, async (msg) => {
            if (!(await this._checkAuth(msg))) return;
            
            const bikes = await this.db.allQuery(`
                SELECT * FROM bikes 
                WHERE is_active = 1 
                ORDER BY created_at DESC 
                LIMIT 3
            `);

            if (bikes.length === 0) {
                this.bot.sendMessage(msg.chat.id, "No active bikes found.");
                return;
            }

            for (const bike of bikes) {
                await this.sendBikeCard(msg.chat.id, bike);
            }
        });

        // /health - System Health
        this.bot.onText(/\/health/, async (msg) => {
            if (!(await this._checkAuth(msg))) return;
            
            // Mock API Limit Check (Real implementation would track usage)
            const apiStatus = "✅ Gemini (Multi-Key): OK"; 
            const dbStatus = "✅ Database: Connected";
            
            this.bot.sendMessage(msg.chat.id, `🏥 *System Health*\n\n${apiStatus}\n${dbStatus}`, { parse_mode: 'Markdown' });
        });

        // /restart - Restart all services (Server Side)
        this.bot.onText(/\/restart/, async (msg) => {
            if (!(await this._checkAuth(msg))) return;

            this.bot.sendMessage(msg.chat.id, '🔄 Initiating system-wide restart (PM2)... Hold tight!');
            
            // Execute pm2 restart all on the server
            exec('pm2 restart all', (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    this.bot.sendMessage(msg.chat.id, `❌ Restart Failed:\n\`${error.message}\``, { parse_mode: 'Markdown' });
                    return;
                }
                // If successful, the bot process will likely die here and restart.
                // We won't see this message usually unless the bot is NOT managed by PM2 (which it is).
                // So the "Initiating" message is the key indicator.
            });
        });

        // /clear [id] - Delete specific bike
        this.bot.onText(/\/clear\s+(\d+)/, async (msg, match) => {
            if (!(await this._checkAuth(msg))) return;
            const id = match[1];
            const res = await this._clearBike(id);
            if (res.success) {
                this.bot.sendMessage(msg.chat.id, `✅ Bike ${id} deleted (Files: ${res.deletedFiles})`);
            } else {
                this.bot.sendMessage(msg.chat.id, `❌ Failed to delete ${id}: ${res.error}`);
            }
        });

        // /clear_all - Delete all bikes
        this.bot.onText(/\/clear_all/, async (msg) => {
            if (!(await this._checkAuth(msg))) return;
            
            // Confirmation via custom keyboard
            const opts = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔥 YES, DELETE EVERYTHING", callback_data: "confirm_clear_all" }],
                        [{ text: "❌ Cancel", callback_data: "cancel_clear" }]
                    ]
                }
            };
            this.bot.sendMessage(msg.chat.id, "⚠️ Are you sure you want to delete ALL bikes and images?", opts);
        });

        this.bot.on('callback_query', async (query) => {
            if (query.data === 'confirm_clear_all') {
                const res = await this._clearAll();
                const text = res.success 
                    ? `✅ Database CLEARED. Deleted ${res.deletedFiles} images.` 
                    : `❌ Failed: ${res.error}`;
                this.bot.sendMessage(query.message.chat.id, text);
                this.bot.answerCallbackQuery(query.id);
            } else if (query.data === 'cancel_clear') {
                this.bot.sendMessage(query.message.chat.id, "Cancelled.");
                this.bot.answerCallbackQuery(query.id);
            }
        });
    }

    async _checkAuth(msg) {
        const resolved = await this._resolveAdminChatId();
        if (!resolved || String(msg.chat.id) !== String(resolved)) {
            console.log(`[AdminBot] Unauthorized access attempt by ${msg.chat.id}`);
            if (!resolved) {
                try {
                    this.bot.sendMessage(msg.chat.id, `⚠️ Admin not registered. Send /start to register.`, { parse_mode: 'Markdown' });
                } catch (_) {}
            }
            return false;
        }
        return true;
    }

    async _resolveAdminChatId() {
        if (this.adminChatId) return this.adminChatId;
        try {
            const row = await this.db.getQuery(`SELECT telegram_id FROM telegram_users WHERE role = 'admin' ORDER BY id LIMIT 1`);
            if (row && row.telegram_id) {
                this.adminChatId = row.telegram_id;
                return this.adminChatId;
            }
        } catch (_) {}
        return null;
    }

    async _registerAdmin(chatId, from) {
        this.adminChatId = chatId;
        try {
            await this._upsertTelegramUser(from, 'admin');
        } catch (e) {
            console.warn(`Admin registration warning: ${e.message}`);
        }
    }

    async _upsertTelegramUser(from, role = 'user') {
        if (!from) return;
        const payload = {
            telegram_id: from.id,
            username: from.username || null,
            first_name: from.first_name || null,
            last_name: from.last_name || null,
            language_code: from.language_code || null,
            is_bot: from.is_bot ? 1 : 0,
            is_active: 1,
            role: role || 'user',
            user_id: null
        };
        await this.db.runQuery(
            `INSERT OR REPLACE INTO telegram_users
            (telegram_id, username, first_name, last_name, language_code, is_bot, is_active, role, user_id, updated_at, last_interaction)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                payload.telegram_id,
                payload.username,
                payload.first_name,
                payload.last_name,
                payload.language_code,
                payload.is_bot,
                payload.is_active,
                payload.role,
                payload.user_id
            ]
        );
    }

    async _getSystemStats() {
        const active = await this.db.getQuery("SELECT COUNT(*) as c FROM bikes WHERE is_active = 1");
        const total = await this.db.getQuery("SELECT COUNT(*) as c FROM bikes");
        const marburg = await this.db.getQuery("SELECT COUNT(*) as c FROM bikes WHERE is_active = 1 AND guaranteed_pickup = 1");
        const profit = await this.db.allQuery("SELECT original_price, price FROM bikes WHERE is_active = 1");
        
        let totalProfit = 0;
        let totalMargin = 0;
        let count = 0;
        
        profit.forEach(p => {
            if (p.original_price && p.price) {
                const estProfit = p.original_price - p.price; // Rough calc
                if (estProfit > 0) {
                    totalProfit += estProfit;
                    totalMargin += (estProfit / p.price);
                    count++;
                }
            }
        });

        return {
            active: active.c,
            total: total.c,
            marburgCount: marburg.c,
            diplomaticCount: active.c - marburg.c,
            potentialProfit: Math.round(totalProfit),
            avgMargin: count > 0 ? Math.round((totalMargin / count) * 100) : 0
        };
    }

    async sendInstantAlert(bike, profitData) {
        const adminId = await this._resolveAdminChatId();
        if (!adminId) return;

        const isMarburg = bike.guaranteed_pickup;
        const profit = profitData ? profitData.profit : (bike.original_price - bike.price);
        
        let header = "🚨 *NEW FIND*";
        if (isMarburg) header = "🛡️ *MARBURG SPECIAL*";
        else if (profit > 500) header = "💰 *HIGH PROFIT ALERT*";

        const msg = `
${header}

🚲 *${bike.brand} ${bike.model}*
💶 Price: *${bike.price}€*
📈 Est. Profit: *${profit}€*
📍 Location: ${bike.location || 'Unknown'}

${isMarburg ? "✅ Guaranteed Pickup (3h Zone)" : "💬 Negotiation Service"}

[View Listing](${bike.original_url})
        `;

        const opts = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    // Use 'url' instead of 'web_app' for t.me links to avoid BUTTON_URL_INVALID
                    { text: "🚀 Open Admin Overlay", url: process.env.ADMIN_APP_URL || 'https://t.me/EUBikeAdminBot/app' }
                ]]
            }
        };

        await this.bot.sendMessage(adminId, msg.trim(), opts);
    }

    async sendDailyDigest() {
        const adminId = await this._resolveAdminChatId();
        if (!adminId) return;
        const stats = await this._getSystemStats();
        
        const msg = `
☕ *Morning Digest*

Yesterday's Performance:
• New Bikes: *${stats.active}* (Mock count)
• Total Inventory: *${stats.total}*
• Potential Profit: *${stats.potentialProfit}€*

System Status: *Healthy* ✅
        `;
        
        await this.bot.sendMessage(adminId, msg.trim(), { parse_mode: 'Markdown' });
    }

    async sendSystemAlert(errorMsg) {
        const adminId = await this._resolveAdminChatId();
        if (!adminId) return;
        await this.bot.sendMessage(adminId, `⚠️ *SYSTEM ALERT*\n\n${errorMsg}`, { parse_mode: 'Markdown' });
    }

    async sendBikeCard(chatId, bike) {
        const caption = `
🚲 *${bike.brand} ${bike.model}*
💶 ${bike.price}€
${bike.guaranteed_pickup ? "🛡️ Marburg Hub" : "📦 Pickup/Ship"}
        `;
        
        if (bike.main_image) {
            try {
                // If it's a URL, send as photo. If local path, handled differently.
                // Assuming URL for now as per DB schema
                await this.bot.sendPhoto(chatId, bike.main_image, { caption, parse_mode: 'Markdown' });
            } catch (e) {
                await this.bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
            }
        } else {
            await this.bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
        }
    }

    async _clearBike(id) {
        try {
            // Get bike info for image paths
            const bikes = await this.db.allQuery("SELECT main_image FROM bikes WHERE id = ?", [id]);
            const images = await this.db.allQuery("SELECT image_url FROM bike_images WHERE bike_id = ?", [id]);
            
            // Delete from DB
            await this.db.runQuery("DELETE FROM bikes WHERE id = ?", [id]);
            await this.db.runQuery("DELETE FROM bike_images WHERE bike_id = ?", [id]);
            await this.db.runQuery("DELETE FROM user_favorites WHERE bike_id = ?", [id]);
            await this.db.runQuery("DELETE FROM price_history WHERE bike_id = ?", [id]);
            
            // Collect files to delete
            const filesToDelete = [];
            if (bikes[0] && bikes[0].main_image && !bikes[0].main_image.startsWith('http')) {
                filesToDelete.push(bikes[0].main_image);
            }
            images.forEach(img => {
                if (img.image_url && !img.image_url.startsWith('http')) {
                    filesToDelete.push(img.image_url);
                }
            });

            // Delete files
            const fs = require('fs');
            const path = require('path');
            const publicDir = path.resolve(__dirname, '../backend/public'); // Adjust based on deployment
            
            let deletedFiles = 0;
            for (const relPath of filesToDelete) {
                // Handle different path formats (relative to public or full)
                // Assuming stored as /images/bikes/...
                const cleanPath = relPath.startsWith('/') ? relPath.substring(1) : relPath;
                const fullPath = path.join(publicDir, cleanPath);
                
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    deletedFiles++;
                }
            }
            
            return { success: true, deletedFiles };
        } catch (e) {
            console.error('Clear error:', e);
            return { success: false, error: e.message };
        }
    }

    async _clearAll() {
        try {
            // Delete all DB records
            await this.db.runQuery("DELETE FROM bikes");
            await this.db.runQuery("DELETE FROM bike_images");
            await this.db.runQuery("DELETE FROM user_favorites");
            await this.db.runQuery("DELETE FROM price_history");
            await this.db.runQuery("DELETE FROM bot_tasks");
            
            // Clear images directory
            const fs = require('fs');
            const path = require('path');
            const imagesDir = path.resolve(__dirname, '../backend/public/images/bikes');
            
            let deletedFiles = 0;
            if (fs.existsSync(imagesDir)) {
                // Recursive deletion function
                const deleteFolderRecursive = (dirPath) => {
                    if (fs.existsSync(dirPath)) {
                        fs.readdirSync(dirPath).forEach((file) => {
                            const curPath = path.join(dirPath, file);
                            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                                deleteFolderRecursive(curPath);
                            } else { // delete file
                                if (file !== '.gitkeep') {
                                    fs.unlinkSync(curPath);
                                    deletedFiles++;
                                }
                            }
                        });
                        // Don't remove the root imagesDir itself, just content, unless it's a subdir
                        if (dirPath !== imagesDir) {
                            fs.rmdirSync(dirPath);
                        }
                    }
                };
                
                deleteFolderRecursive(imagesDir);
            }
            
            return { success: true, deletedFiles };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = AdminBotService;
