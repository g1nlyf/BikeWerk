const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const { Telegraf, Markup } = require('telegraf');
const { DatabaseManager } = require('../js/mysql-config');
const { normalizeOrderStatus } = require('../domain/orderLifecycle');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const STATUS_LABELS = Object.freeze({
    booked: 'Booking created',
    reserve_payment_pending: 'Booking payment pending',
    reserve_paid: 'Booking paid',
    seller_check_in_progress: 'Seller check in progress',
    check_ready: 'Seller check ready',
    awaiting_client_decision: 'Awaiting client decision',
    full_payment_pending: 'Full payment pending',
    full_payment_received: 'Full payment received',
    bike_buyout_completed: 'Bike buyout completed',
    seller_shipped: 'Seller shipped',
    expert_received: 'Expert received',
    expert_inspection_in_progress: 'Expert inspection in progress',
    expert_report_ready: 'Expert report ready',
    awaiting_client_decision_post_inspection: 'Awaiting decision after inspection',
    warehouse_received: 'Warehouse received',
    warehouse_repacked: 'Warehouse repacked',
    shipped_to_russia: 'Shipped',
    delivered: 'Delivered',
    closed: 'Closed',
    cancelled: 'Cancelled'
});

function htmlEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

class TelegramHubService {
    constructor() {
        this.db = null;
        this.aiRopAutopilot = null;
        this.managerKpiService = null;

        this.started = false;
        this.startPromise = null;
        this.pollingRoles = new Set();
        this.bots = new Map();

        this.chatStates = new Map();
        this.preferenceCache = new Map();

        this.reminderTimer = null;
        this.digestTimer = null;
        this.lastDigestDay = null;

        this.supportChatId = process.env.SUPPORT_CHAT_ID || process.env.ADMIN_CHAT_ID || '';
        this.adminChatId = process.env.ADMIN_CHAT_ID || '';
        this.publicBaseUrl = process.env.PUBLIC_WEB_URL || process.env.PUBLIC_URL || 'http://localhost:5173';
        this.backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 8082}`;

        this.allowedManagerIds = this._parseIdList(process.env.MANAGER_ALLOWED_IDS);
        this.clientBotUsername = process.env.CLIENT_BOT_USERNAME || '';
    }

    bindServices({ db = null, aiRopAutopilot = null, managerKpiService = null } = {}) {
        if (db) this.db = db;
        if (aiRopAutopilot) this.aiRopAutopilot = aiRopAutopilot;
        if (managerKpiService) this.managerKpiService = managerKpiService;
    }

    _parseIdList(raw) {
        if (!raw) return new Set();
        return new Set(
            String(raw)
                .split(',')
                .map((value) => String(value).trim())
                .filter(Boolean)
        );
    }

    _normalizeRole(value) {
        const role = String(value || '').trim().toLowerCase();
        if (role === 'admin' || role === 'manager' || role === 'client' || role === 'support') {
            return role;
        }
        return '';
    }

    _parseRoles(raw) {
        if (!raw) return [];
        return String(raw)
            .split(',')
            .map((item) => this._normalizeRole(item))
            .filter(Boolean);
    }

    _isValidToken(token) {
        const value = String(token || '').trim();
        if (!value || value.toUpperCase().includes('MOCK')) return false;
        return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value);
    }

    _tokenForRole(role) {
        switch (role) {
            case 'admin':
                return process.env.ADMIN_BOT_TOKEN || process.env.TG_ADMIN_BOT_TOKEN || '';
            case 'manager':
                return process.env.MANAGER_BOT_TOKEN || process.env.TG_MANAGER_BOT_TOKEN || '';
            case 'client':
                return process.env.TG_CLIENT_BOT_TOKEN || process.env.CLIENT_BOT_TOKEN || '';
            case 'support':
                return process.env.SUPPORT_BOT_TOKEN || process.env.TG_SUPPORT_BOT_TOKEN || '';
            default:
                return '';
        }
    }

    _statusText(statusRaw) {
        const status = normalizeOrderStatus(statusRaw) || String(statusRaw || '').trim().toLowerCase();
        const mapped = STATUS_LABELS[status];
        if (mapped) return mapped;
        return status || 'unknown';
    }

    _parseJson(value, fallback = null) {
        if (value == null) return fallback;
        if (typeof value === 'object') return value;
        if (typeof value !== 'string') return fallback;
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    _signatureSecret() {
        return process.env.BOT_LINK_SECRET || process.env.JWT_SECRET || 'eubike-telegram-link-secret';
    }

    createStartPayload({ orderId, userId = null, expiresAt = null } = {}) {
        const payload = {
            order_id: String(orderId || ''),
            user_id: userId == null ? null : String(userId),
            exp: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = crypto
            .createHmac('sha256', this._signatureSecret())
            .update(payloadB64)
            .digest('base64url')
            .slice(0, 24);
        return `v1.${payloadB64}.${sig}`;
    }

    consumeStartPayload(rawPayload) {
        const payload = String(rawPayload || '').trim();
        if (!payload) return null;

        if (payload.startsWith('v1.')) {
            const parts = payload.split('.');
            if (parts.length !== 3) return null;

            const payloadB64 = parts[1];
            const sig = parts[2];
            const expected = crypto
                .createHmac('sha256', this._signatureSecret())
                .update(payloadB64)
                .digest('base64url')
                .slice(0, 24);

            if (sig !== expected) return null;

            try {
                const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
                if (!parsed?.order_id) return null;
                if (parsed.exp && new Date(parsed.exp).getTime() < Date.now()) return null;
                return {
                    order_id: String(parsed.order_id),
                    user_id: parsed.user_id == null ? null : String(parsed.user_id)
                };
            } catch {
                return null;
            }
        }

        const fallback = payload.match(/(\d{2,})/);
        if (fallback) {
            return { order_id: fallback[1], user_id: null };
        }
        return null;
    }

    _defaultPreferences(role = 'client') {
        const normalizedRole = this._normalizeRole(role) || 'client';
        const isClient = normalizedRole === 'client';
        const isSupport = normalizedRole === 'support';
        return {
            channels: {
                status_updates: true,
                tracking_updates: true,
                support_updates: true,
                ai_tips: !isClient,
                broadcasts: !isClient && !isSupport,
                reminders: true,
                promo: false
            },
            quiet_hours: {
                enabled: false,
                start: 23,
                end: 8,
                utc_offset: Number(process.env.TELEGRAM_QUIET_DEFAULT_UTC_OFFSET || 3)
            },
            snooze_until: null
        };
    }

    _clampInt(value, min, max, fallback) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        if (n < min) return min;
        if (n > max) return max;
        return Math.trunc(n);
    }

    _normalizePreferences(raw, role = 'client') {
        const base = this._defaultPreferences(role);
        const input = raw && typeof raw === 'object' ? raw : {};
        const channelsInput = input.channels && typeof input.channels === 'object' ? input.channels : {};

        const channels = {
            status_updates: channelsInput.status_updates ?? input.status_updates ?? base.channels.status_updates,
            tracking_updates: channelsInput.tracking_updates ?? input.tracking_updates ?? base.channels.tracking_updates,
            support_updates: channelsInput.support_updates ?? input.support_updates ?? base.channels.support_updates,
            ai_tips: channelsInput.ai_tips ?? input.ai_tips ?? base.channels.ai_tips,
            broadcasts: channelsInput.broadcasts ?? input.broadcasts ?? base.channels.broadcasts,
            reminders: channelsInput.reminders ?? input.reminders ?? base.channels.reminders,
            promo: channelsInput.promo ?? input.promo ?? base.channels.promo
        };

        const quietInput = input.quiet_hours && typeof input.quiet_hours === 'object' ? input.quiet_hours : {};
        const quiet_hours = {
            enabled: Boolean(quietInput.enabled ?? base.quiet_hours.enabled),
            start: this._clampInt(quietInput.start, 0, 23, base.quiet_hours.start),
            end: this._clampInt(quietInput.end, 0, 23, base.quiet_hours.end),
            utc_offset: this._clampInt(quietInput.utc_offset, -12, 14, base.quiet_hours.utc_offset)
        };

        let snooze_until = null;
        if (input.snooze_until) {
            const parsed = new Date(input.snooze_until);
            if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
                snooze_until = parsed.toISOString();
            }
        }

        for (const key of Object.keys(channels)) {
            channels[key] = channels[key] !== false;
        }

        return { channels, quiet_hours, snooze_until };
    }

    _channelForCategory(category) {
        const value = String(category || '').trim().toLowerCase();
        if (!value) return null;
        if (['status_update', 'status', 'delivery', 'new_order'].includes(value)) return 'status_updates';
        if (['tracking', 'tracking_update'].includes(value)) return 'tracking_updates';
        if (['support', 'support_reply', 'support_thread'].includes(value)) return 'support_updates';
        if (['ai', 'ai_tip', 'ai_signal', 'digest'].includes(value)) return 'ai_tips';
        if (['broadcast', 'announcement'].includes(value)) return 'broadcasts';
        if (['reminder', 'task_reminder'].includes(value)) return 'reminders';
        if (['promo', 'marketing'].includes(value)) return 'promo';
        return null;
    }

    _isInQuietHours(prefs) {
        const quiet = prefs?.quiet_hours;
        if (!quiet?.enabled) return false;

        const start = this._clampInt(quiet.start, 0, 23, 23);
        const end = this._clampInt(quiet.end, 0, 23, 8);
        const offset = this._clampInt(quiet.utc_offset, -12, 14, 0);

        const shifted = new Date(Date.now() + offset * 60 * 60 * 1000);
        const hour = shifted.getUTCHours();

        if (start === end) return true;
        if (start < end) return hour >= start && hour < end;
        return hour >= start || hour < end;
    }

    async _getDb() {
        if (this.db && typeof this.db.query === 'function') return this.db;
        this.db = new DatabaseManager();
        if (typeof this.db.initialize === 'function') {
            await this.db.initialize();
        }
        return this.db;
    }

    async ensureSchema() {
        const db = await this._getDb();

        await db.query(`
            CREATE TABLE IF NOT EXISTS telegram_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                order_id TEXT NOT NULL,
                user_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(chat_id, order_id)
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS telegram_preferences (
                chat_id TEXT PRIMARY KEY,
                preferences TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS telegram_user_roles (
                chat_id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                user_id TEXT,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS telegram_support_threads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_chat_id TEXT NOT NULL,
                order_id TEXT,
                message_text TEXT NOT NULL,
                direction TEXT NOT NULL DEFAULT 'inbound',
                author_role TEXT NOT NULL DEFAULT 'client',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS telegram_reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_role TEXT NOT NULL,
                chat_id TEXT NOT NULL,
                title TEXT,
                message_text TEXT NOT NULL,
                remind_at DATETIME NOT NULL,
                payload TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sent_at DATETIME,
                error TEXT
            )
        `);

        await db.query('CREATE INDEX IF NOT EXISTS idx_tg_subscriptions_chat ON telegram_subscriptions(chat_id, created_at)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_tg_subscriptions_order ON telegram_subscriptions(order_id, created_at)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_tg_reminders_due ON telegram_reminders(status, remind_at)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_tg_support_client ON telegram_support_threads(client_chat_id, created_at)');
    }

    async start({ pollingRoles = null } = {}) {
        if (this.startPromise) return this.startPromise;
        this.startPromise = this._startInternal({ pollingRoles }).finally(() => {
            this.startPromise = null;
        });
        return this.startPromise;
    }

    async _startInternal({ pollingRoles = null } = {}) {
        await this.ensureSchema();

        const envRoles = this._parseRoles(process.env.TELEGRAM_HUB_POLLING_ROLES || '');
        const chosenRoles = Array.isArray(pollingRoles)
            ? pollingRoles.map((item) => this._normalizeRole(item)).filter(Boolean)
            : envRoles;

        this.pollingRoles = new Set(chosenRoles);

        const startupErrors = [];
        for (const role of ['admin', 'manager', 'client', 'support']) {
            try {
                await this._initRoleBot(role);
            } catch (error) {
                const message = String(error?.message || error);
                startupErrors.push({ role, message });
                console.warn(`[TelegramHub] ${role} startup failed: ${message}`);
            }
        }

        this._startReminderWorker();
        this._startDigestWorker();
        this.started = true;

        return {
            started: true,
            polling_roles: Array.from(this.pollingRoles),
            bots: Array.from(this.bots.keys()),
            failed_roles: startupErrors
        };
    }

    async stop() {
        if (this.reminderTimer) {
            clearInterval(this.reminderTimer);
            this.reminderTimer = null;
        }
        if (this.digestTimer) {
            clearInterval(this.digestTimer);
            this.digestTimer = null;
        }

        for (const entry of this.bots.values()) {
            if (entry.bot) {
                try {
                    await entry.bot.stop();
                } catch (_) {
                    // ignore
                }
            }
        }

        this.bots.clear();
        this.started = false;
    }

    _bot(role) {
        return this.bots.get(role)?.bot || null;
    }

    async _telegramCallWithTimeout(promise, timeoutMs = 12000, timeoutLabel = 'telegram_call_timeout') {
        let timeoutRef = null;
        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    timeoutRef = setTimeout(() => reject(new Error(timeoutLabel)), timeoutMs);
                })
            ]);
        } finally {
            if (timeoutRef) clearTimeout(timeoutRef);
        }
    }

    async _launchWithTimeout(bot, timeoutMs = 70000) {
        let timeoutRef = null;
        try {
            await Promise.race([
                bot.launch({
                    dropPendingUpdates: false,
                    allowedUpdates: ['message', 'callback_query']
                }),
                new Promise((_, reject) => {
                    timeoutRef = setTimeout(() => reject(new Error('telegram_launch_timeout')), timeoutMs);
                })
            ]);
        } finally {
            if (timeoutRef) clearTimeout(timeoutRef);
        }
    }

    async _initRoleBot(role) {
        const token = this._tokenForRole(role);
        if (!this._isValidToken(token)) return;

        const bot = new Telegraf(token, { handlerTimeout: 30000 });
        bot.catch((error) => {
            console.warn(`[TelegramHub] ${role} bot handler error:`, error?.message || error);
        });

        this.bots.set(role, { bot, launched: false });

        if (!this.pollingRoles.has(role)) return;

        if (role === 'admin') this._setupAdminHandlers(bot);
        if (role === 'manager') this._setupManagerHandlers(bot);
        if (role === 'client') this._setupClientHandlers(bot);
        if (role === 'support') this._setupSupportHandlers(bot);

        const commands = this._commandsForRole(role);
        if (commands.length) {
            try {
                await this._telegramCallWithTimeout(
                    bot.telegram.setMyCommands(commands),
                    10000,
                    'telegram_set_commands_timeout'
                );
            } catch (error) {
                console.warn(`[TelegramHub] ${role} setMyCommands warning:`, error?.message || error);
            }
        }

        try {
            await this._telegramCallWithTimeout(
                bot.telegram.deleteWebhook({ drop_pending_updates: false }),
                10000,
                'telegram_delete_webhook_timeout'
            );
        } catch (error) {
            console.warn(`[TelegramHub] ${role} deleteWebhook warning:`, error?.message || error);
        }

        const entry = this.bots.get(role);
        try {
            entry.launchPromise = bot.launch({
                dropPendingUpdates: false,
                allowedUpdates: ['message', 'callback_query']
            });
            entry.launched = true;
            console.log(`[TelegramHub] ${role} polling started`);
            entry.launchPromise.catch((error) => {
                entry.launched = false;
                const message = String(error?.message || error);
                console.warn(`[TelegramHub] ${role} polling launch failed: ${message}`);
            });
        } catch (error) {
            entry.launched = false;
            const message = String(error?.message || error);
            console.warn(`[TelegramHub] ${role} polling launch failed: ${message}`);
            throw error;
        }
    }

    async _resolveRoleByChatId(chatId, fallbackRole = 'client') {
        const fallback = this._normalizeRole(fallbackRole) || 'client';
        try {
            const db = await this._getDb();
            const rows = await db.query(
                `SELECT role
                 FROM telegram_user_roles
                 WHERE chat_id = ?
                 LIMIT 1`,
                [String(chatId)]
            );
            const resolved = this._normalizeRole(rows?.[0]?.role);
            return resolved || fallback;
        } catch {
            return fallback;
        }
    }

    async getPreferences(chatId) {
        const db = await this._getDb();
        const rows = await db.query(
            'SELECT preferences FROM telegram_preferences WHERE chat_id = ? LIMIT 1',
            [String(chatId)]
        );
        const raw = rows?.[0]?.preferences;
        return this._parseJson(raw, {}) || {};
    }

    async getPreferencesNormalized(chatId, fallbackRole = 'client') {
        const key = String(chatId);
        if (this.preferenceCache.has(key)) {
            return this.preferenceCache.get(key);
        }
        const role = await this._resolveRoleByChatId(key, fallbackRole);
        const raw = await this.getPreferences(key);
        const normalized = this._normalizePreferences(raw, role);
        this.preferenceCache.set(key, normalized);
        return normalized;
    }

    async setPreferences({ chatId, preferences = {}, fallbackRole = 'client' } = {}) {
        const key = String(chatId || '');
        if (!key) return { success: false, reason: 'chat_id_required' };

        const db = await this._getDb();
        const role = await this._resolveRoleByChatId(key, fallbackRole);
        const normalized = this._normalizePreferences(preferences, role);

        await db.query(
            `INSERT INTO telegram_preferences (chat_id, preferences, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(chat_id) DO UPDATE SET
                preferences = excluded.preferences,
                updated_at = CURRENT_TIMESTAMP`,
            [key, JSON.stringify(normalized)]
        );

        this.preferenceCache.set(key, normalized);
        return { success: true };
    }

    async patchPreferences(chatId, fallbackRole, mutate) {
        const key = String(chatId);
        const current = await this.getPreferencesNormalized(key, fallbackRole);
        const draft = this._normalizePreferences(current, fallbackRole);
        mutate(draft);
        await this.setPreferences({ chatId: key, preferences: draft, fallbackRole });
        return draft;
    }

    _preferencesText(prefs) {
        const channels = prefs?.channels || {};
        const mark = (value) => (value === false ? 'OFF' : 'ON');
        const quiet = prefs?.quiet_hours || {};
        const quietLine = quiet.enabled
            ? `${String(quiet.start).padStart(2, '0')}:00-${String(quiet.end).padStart(2, '0')}:00 (UTC${quiet.utc_offset >= 0 ? '+' : ''}${quiet.utc_offset})`
            : 'off';
        const snoozeLine = prefs?.snooze_until || 'off';
        return [
            '<b>Notification settings</b>',
            `status_updates: ${mark(channels.status_updates)}`,
            `tracking_updates: ${mark(channels.tracking_updates)}`,
            `support_updates: ${mark(channels.support_updates)}`,
            `ai_tips: ${mark(channels.ai_tips)}`,
            `broadcasts: ${mark(channels.broadcasts)}`,
            `reminders: ${mark(channels.reminders)}`,
            `quiet_hours: ${quietLine}`,
            `snooze_until: ${snoozeLine}`
        ].join('\n');
    }

    async _shouldDeliver({ chatId, roleHint, category = null, priority = 'normal', bypassPreferences = false } = {}) {
        if (bypassPreferences) return { allowed: true };

        const normalizedPriority = String(priority || 'normal').toLowerCase();
        if (normalizedPriority === 'critical') return { allowed: true };

        const prefs = await this.getPreferencesNormalized(String(chatId), roleHint || 'client');

        const snoozeMs = prefs?.snooze_until ? new Date(prefs.snooze_until).getTime() : 0;
        if (snoozeMs && snoozeMs > Date.now() && normalizedPriority !== 'high') {
            return { allowed: false, reason: 'snoozed' };
        }

        const channelKey = this._channelForCategory(category);
        if (channelKey && prefs?.channels?.[channelKey] === false) {
            return { allowed: false, reason: `channel_disabled:${channelKey}` };
        }

        if (this._isInQuietHours(prefs) && normalizedPriority !== 'high') {
            return { allowed: false, reason: 'quiet_hours' };
        }

        return { allowed: true };
    }

    async sendMessage(role, chatId, text, extra = {}, meta = {}) {
        if (!chatId || !text) return { ok: false, skipped: true };
        if (!this.started) await this.start({ pollingRoles: [] });

        const gate = await this._shouldDeliver({
            chatId: String(chatId),
            roleHint: role,
            category: meta?.category || null,
            priority: meta?.priority || 'normal',
            bypassPreferences: Boolean(meta?.bypassPreferences)
        });
        if (!gate.allowed) {
            return { ok: false, skipped: true, reason: gate.reason || 'preferences' };
        }

        const preferred = this._bot(role);
        const fallback = preferred || this._bot('admin') || this._bot('manager') || this._bot('client') || this._bot('support');
        if (!fallback) return { ok: false, skipped: true, reason: 'no_bot_initialized' };

        try {
            await fallback.telegram.sendMessage(String(chatId), String(text), {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...extra
            });
            return { ok: true };
        } catch (error) {
            const msg = String(error?.message || error);
            console.warn(`[TelegramHub] sendMessage failed (${role}:${chatId}):`, msg);
            return { ok: false, error: msg };
        }
    }

    async registerUserRole({ chatId, role, userId = null, username = null, firstName = null, lastName = null } = {}) {
        const key = String(chatId || '');
        if (!key) return;

        const db = await this._getDb();
        await db.query(
            `INSERT INTO telegram_user_roles (chat_id, role, user_id, username, first_name, last_name, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(chat_id) DO UPDATE SET
                role = excluded.role,
                user_id = excluded.user_id,
                username = excluded.username,
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                updated_at = CURRENT_TIMESTAMP`,
            [
                key,
                this._normalizeRole(role) || 'client',
                userId == null ? null : String(userId),
                username || null,
                firstName || null,
                lastName || null
            ]
        );
        this.preferenceCache.delete(key);
    }

    async subscribeOrder({ chatId, orderId, userId = null } = {}) {
        const db = await this._getDb();
        await db.query(
            `INSERT OR IGNORE INTO telegram_subscriptions (chat_id, order_id, user_id)
             VALUES (?, ?, ?)`,
            [String(chatId), String(orderId), userId == null ? null : String(userId)]
        );
        return { success: true };
    }

    async unsubscribeOrder({ chatId, orderId } = {}) {
        const db = await this._getDb();
        await db.query(
            'DELETE FROM telegram_subscriptions WHERE chat_id = ? AND order_id = ?',
            [String(chatId), String(orderId)]
        );
        return { success: true };
    }

    async getSubscriptions(chatId) {
        const db = await this._getDb();
        return db.query(
            `SELECT id, chat_id, order_id, user_id, created_at
             FROM telegram_subscriptions
             WHERE chat_id = ?
             ORDER BY datetime(created_at) DESC`,
            [String(chatId)]
        );
    }

    async createReminder({ role = 'manager', chatId, title = '', messageText, remindAt, payload = null } = {}) {
        if (!chatId || !messageText || !remindAt) return { success: false, reason: 'invalid_payload' };

        const db = await this._getDb();
        await db.query(
            `INSERT INTO telegram_reminders (bot_role, chat_id, title, message_text, remind_at, payload, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
            [
                this._normalizeRole(role) || 'manager',
                String(chatId),
                String(title || ''),
                String(messageText),
                new Date(remindAt).toISOString(),
                payload ? JSON.stringify(payload) : null
            ]
        );
        return { success: true };
    }

    _startReminderWorker() {
        if (this.reminderTimer) return;
        this.reminderTimer = setInterval(async () => {
            try {
                const db = await this._getDb();
                const rows = await db.query(
                    `SELECT id, bot_role, chat_id, title, message_text
                     FROM telegram_reminders
                     WHERE status = 'pending'
                       AND datetime(remind_at) <= datetime('now')
                     ORDER BY datetime(remind_at) ASC
                     LIMIT 25`
                );

                for (const row of rows || []) {
                    const role = this._normalizeRole(row.bot_role) || 'manager';
                    const title = String(row.title || '').trim();
                    const body = String(row.message_text || '').trim();
                    const text = title ? `<b>${htmlEscape(title)}</b>\n${htmlEscape(body)}` : htmlEscape(body);
                    const result = await this.sendMessage(role, row.chat_id, text, {}, { category: 'reminder', priority: 'high' });

                    if (result.ok) {
                        await db.query(
                            `UPDATE telegram_reminders
                             SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error = NULL
                             WHERE id = ?`,
                            [row.id]
                        );
                    } else {
                        await db.query(
                            `UPDATE telegram_reminders
                             SET status = 'failed', sent_at = CURRENT_TIMESTAMP, error = ?
                             WHERE id = ?`,
                            [String(result.error || result.reason || 'send_failed').slice(0, 400), row.id]
                        );
                    }
                }
            } catch (error) {
                console.warn('[TelegramHub] reminder worker error:', error?.message || error);
            }
        }, 30 * 1000);
    }

    _startDigestWorker() {
        if (this.digestTimer) return;

        const enabled = String(process.env.TELEGRAM_AI_DIGEST_ENABLED || '1') !== '0';
        if (!enabled) return;

        this.digestTimer = setInterval(async () => {
            const digestHour = Number(process.env.TELEGRAM_AI_DIGEST_HOUR_UTC || 7);
            const now = new Date();
            if (now.getUTCHours() !== digestHour) return;
            if (now.getUTCMinutes() > 8) return;

            const dayKey = now.toISOString().slice(0, 10);
            if (this.lastDigestDay === dayKey) return;
            this.lastDigestDay = dayKey;

            try {
                await this.sendAdminDigest({ includeAiRop: true });
            } catch (error) {
                console.warn('[TelegramHub] digest worker error:', error?.message || error);
            }
        }, 60 * 1000);
    }

    _mainClientKeyboard() {
        return Markup.keyboard([
            ['My orders', 'Track order'],
            ['Support', 'Settings']
        ]).resize();
    }

    _mainManagerKeyboard() {
        return Markup.keyboard([
            ['My orders', 'AI signals'],
            ['Tasks', 'KPI'],
            ['Brief', 'Remind'],
            ['Help', 'Settings']
        ]).resize();
    }

    _mainAdminKeyboard() {
        return Markup.keyboard([
            ['Digest', 'Brief'],
            ['AI-ROP', 'Signals'],
            ['Broadcast', 'Settings']
        ]).resize();
    }

    _commandsForRole(role) {
        if (role === 'client') {
            return [
                { command: 'track', description: 'Track order by ID' },
                { command: 'orders', description: 'My tracked orders' },
                { command: 'prefs', description: 'Notification settings' },
                { command: 'help', description: 'Client help' }
            ];
        }
        if (role === 'manager') {
            return [
                { command: 'link', description: 'Link corporate account' },
                { command: 'my', description: 'My active orders' },
                { command: 'tasks', description: 'My open tasks' },
                { command: 'brief', description: 'Manager daily brief' },
                { command: 'kpi', description: 'My KPI snapshot' }
            ];
        }
        if (role === 'admin') {
            return [
                { command: 'digest', description: 'Daily CRM digest' },
                { command: 'brief', description: 'Executive brief' },
                { command: 'signals', description: 'Open AI signals' },
                { command: 'broadcast', description: 'Broadcast to managers' }
            ];
        }
        if (role === 'support') {
            return [
                { command: 'open', description: 'Open support threads' },
                { command: 'threads', description: 'Recent inbound threads' },
                { command: 'thread', description: 'Thread by client chat_id' },
                { command: 'reply', description: 'Reply to client thread' }
            ];
        }
        return [];
    }

    async _resolveOrder(orderIdRaw) {
        const orderId = String(orderIdRaw || '').trim();
        if (!orderId) return null;

        const db = await this._getDb();
        const rows = await db.query(
            `SELECT id, order_code, status, final_price_eur, total_price_rub, bike_name, bike_snapshot, assigned_manager, created_at
             FROM orders
             WHERE CAST(id AS TEXT) = ? OR order_code = ?
             LIMIT 1`,
            [orderId, orderId]
        );
        const order = rows?.[0] || null;
        if (!order) return null;

        const snapshot = this._parseJson(order.bike_snapshot, {}) || {};
        const bikeName = order.bike_name || snapshot.title || `${snapshot.brand || ''} ${snapshot.model || ''}`.trim() || 'Bike';

        let shipment = null;
        try {
            const shipmentRows = await db.query(
                `SELECT tracking_number, provider, delivery_status, estimated_delivery_date
                 FROM shipments
                 WHERE CAST(order_id AS TEXT) = ? OR CAST(order_id AS TEXT) = ?
                 ORDER BY datetime(created_at) DESC
                 LIMIT 1`,
                [String(order.id), String(order.order_code || '')]
            );
            shipment = shipmentRows?.[0] || null;
        } catch (_) {
            shipment = null;
        }

        return {
            ...order,
            bike_name: bikeName,
            snapshot,
            shipment
        };
    }

    _orderCardText(order, opts = {}) {
        const title = opts.title || `Order #${order.order_code || order.id}`;
        const lines = [
            `<b>${htmlEscape(title)}</b>`,
            `Status: <b>${htmlEscape(this._statusText(order.status))}</b>`,
            `Bike: ${htmlEscape(order.bike_name || 'Bike')}`
        ];

        if (order.final_price_eur != null) {
            lines.push(`Price: ${Number(order.final_price_eur).toFixed(0)} EUR`);
        } else if (order.total_price_rub != null) {
            lines.push(`Price: ${Number(order.total_price_rub).toLocaleString('ru-RU')} RUB`);
        }

        if (order.shipment?.tracking_number) {
            lines.push(`Tracking: <code>${htmlEscape(order.shipment.tracking_number)}</code>`);
        }

        if (opts.note) lines.push(String(opts.note));
        return lines.join('\n');
    }

    async _resolveManagerByTelegram(chatId) {
        try {
            const db = await this._getDb();
            const rows = await db.query(
                `SELECT id, name, email, role, telegram_id
                 FROM users
                 WHERE CAST(telegram_id AS TEXT) = ?
                 LIMIT 1`,
                [String(chatId)]
            );
            const row = rows?.[0] || null;
            if (row && ['manager', 'admin'].includes(String(row.role || '').toLowerCase())) return row;
            return null;
        } catch {
            return null;
        }
    }

    async _resolveManagerChatIdByManagerId(managerId) {
        if (managerId == null || String(managerId).trim() === '') return null;
        try {
            const db = await this._getDb();
            const rows = await db.query(
                'SELECT telegram_id FROM users WHERE CAST(id AS TEXT) = ? LIMIT 1',
                [String(managerId)]
            );
            const value = rows?.[0]?.telegram_id;
            return value == null ? null : String(value);
        } catch {
            return null;
        }
    }

    async _resolveAdminByTelegram(chatId) {
        try {
            const db = await this._getDb();
            const rows = await db.query(
                `SELECT id, name, email, role
                 FROM users
                 WHERE CAST(telegram_id AS TEXT) = ?
                 LIMIT 1`,
                [String(chatId)]
            );
            const row = rows?.[0] || null;
            if (row && String(row.role || '').toLowerCase() === 'admin') return row;
            return null;
        } catch {
            return null;
        }
    }

    async _resolveManagersForBroadcast() {
        try {
            const db = await this._getDb();
            return db.query(
                `SELECT CAST(id AS TEXT) AS id, name, telegram_id, role
                 FROM users
                 WHERE role IN ('manager', 'admin')
                   AND telegram_id IS NOT NULL`
            );
        } catch {
            return [];
        }
    }

    _isAdminChat(chatId) {
        return Boolean(this.adminChatId) && String(this.adminChatId) === String(chatId);
    }

    async sendAdminDigest({ includeAiRop = false } = {}) {
        const db = await this._getDb();
        const [orders, tasks, signals] = await Promise.all([
            db.query('SELECT status, COUNT(*) AS c FROM orders GROUP BY status'),
            db.query('SELECT COUNT(*) AS c FROM tasks WHERE COALESCE(completed, 0) = 0'),
            db.query(
                `SELECT
                    SUM(CASE WHEN status IN ('open','in_progress','snoozed') THEN 1 ELSE 0 END) AS open_signals,
                    SUM(CASE WHEN severity IN ('critical','high') AND status IN ('open','in_progress','snoozed') THEN 1 ELSE 0 END) AS critical_signals
                 FROM ai_signals`
            )
        ]);

        const statusTop = (orders || [])
            .sort((a, b) => Number(b.c || 0) - Number(a.c || 0))
            .slice(0, 6)
            .map((row) => `${htmlEscape(this._statusText(row.status))}: <b>${Number(row.c || 0)}</b>`)
            .join('\n');

        const openTasks = Number(tasks?.[0]?.c || 0);
        const openSignals = Number(signals?.[0]?.open_signals || 0);
        const highSignals = Number(signals?.[0]?.critical_signals || 0);

        const lines = [
            '<b>Daily CRM Digest</b>',
            statusTop || 'No order status data',
            `Open tasks: <b>${openTasks}</b>`,
            `Open AI signals: <b>${openSignals}</b> (high/critical: <b>${highSignals}</b>)`
        ];

        if (includeAiRop && this.aiRopAutopilot && typeof this.aiRopAutopilot.getStatus === 'function') {
            const state = this.aiRopAutopilot.getStatus();
            lines.push(`AI-ROP: <b>${state?.is_running ? 'running' : 'idle'}</b>`);
            if (state?.last_summary?.finished_at) {
                lines.push(`AI-ROP last run: ${htmlEscape(String(state.last_summary.finished_at))}`);
            }
        }

        if (this.adminChatId) {
            await this.sendMessage('admin', this.adminChatId, lines.join('\n'), {}, { category: 'digest', priority: 'high' });
        }
    }

    async notifyNewOrder(order, bike, customer, options = {}) {
        const managerId = options?.manager?.id || order?.assigned_manager || null;
        const managerChatId = await this._resolveManagerChatIdByManagerId(managerId);

        const orderCode = order?.order_code || order?.order_number || order?.id;
        const bikeName = order?.bike_name || bike?.title || bike?.name || `${bike?.brand || ''} ${bike?.model || ''}`.trim() || 'Bike';
        const priceEur = Number(order?.final_price_eur || bike?.final_price_eur || bike?.price || 0) || null;
        const contact = customer?.contact_value || customer?.phone || customer?.email || 'n/a';
        const tasksCount = Array.isArray(options?.tasks) ? options.tasks.length : 0;

        const msg = [
            `<b>New order #${htmlEscape(orderCode)}</b>`,
            `Bike: ${htmlEscape(bikeName)}`,
            priceEur ? `Price: ${priceEur.toFixed(0)} EUR` : null,
            `Client: ${htmlEscape(customer?.full_name || customer?.name || 'Client')}`,
            `Contact: ${htmlEscape(contact)}`,
            `AI tasks: <b>${tasksCount}</b>`,
            `CRM: ${htmlEscape(`${this.publicBaseUrl}/crm/orders/${encodeURIComponent(String(orderCode))}`)}`
        ].filter(Boolean).join('\n');

        if (managerChatId) {
            const sendResult = await this.sendMessage(
                'manager',
                managerChatId,
                msg,
                {
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('Take in work', `mgr_take:${orderCode}`)],
                        [Markup.button.url('Open CRM', `${this.publicBaseUrl}/crm/orders/${encodeURIComponent(String(orderCode))}`)]
                    ])
                },
                { category: 'new_order', priority: 'high' }
            );
            return { success: Boolean(sendResult?.ok), target: 'manager', chat_id: String(managerChatId) };
        }

        if (this.adminChatId) {
            const sendResult = await this.sendMessage('admin', this.adminChatId, msg, {}, { category: 'new_order', priority: 'high' });
            return { success: Boolean(sendResult?.ok), target: 'admin', chat_id: String(this.adminChatId) };
        }

        return { success: false, reason: 'target_not_found' };
    }

    async notifyManagerClientQuestion({ orderCode, question, managerId = null, managerChatId = null, customerName = null } = {}) {
        const resolvedManagerChatId = managerChatId || (managerId ? await this._resolveManagerChatIdByManagerId(managerId) : null);
        const target = resolvedManagerChatId || this.adminChatId || null;
        if (!target) return { success: false, reason: 'target_not_found' };

        const msg = [
            '<b>Client question</b>',
            `Order: <b>${htmlEscape(orderCode || 'n/a')}</b>`,
            customerName ? `Client: ${htmlEscape(customerName)}` : null,
            '',
            htmlEscape(question || ''),
            '',
            `Open: ${htmlEscape(`${this.publicBaseUrl}/crm/orders/${encodeURIComponent(String(orderCode || ''))}`)}`
        ].filter((line) => line !== null).join('\n');

        await this.sendMessage('manager', target, msg, {}, { category: 'support', priority: 'high' });
        return { success: true };
    }

    async notifyDeliveryUpdate({ orderCode, method, totalEur, totalRub, managerId = null } = {}) {
        const managerChatId = managerId ? await this._resolveManagerChatIdByManagerId(managerId) : null;
        const target = managerChatId || this.adminChatId || null;
        if (!target) return { success: false, reason: 'target_not_found' };

        const msg = [
            '<b>Delivery updated</b>',
            `Order: <b>${htmlEscape(orderCode || 'n/a')}</b>`,
            `Method: <b>${htmlEscape(method || 'n/a')}</b>`,
            totalEur != null ? `Total: <b>${Number(totalEur).toFixed(0)} EUR</b>` : null,
            totalRub != null ? `(${Number(totalRub).toLocaleString('ru-RU')} RUB)` : null
        ].filter(Boolean).join('\n');

        await this.sendMessage('manager', target, msg, {}, { category: 'status_update', priority: 'normal' });
        return { success: true };
    }

    async sendTrackingNotification({ orderId, chatId = null, includeStatus = true } = {}) {
        const order = await this._resolveOrder(orderId);
        if (!order) return { success: false, reason: 'order_not_found' };

        let targets = [];
        if (chatId) {
            targets = [String(chatId)];
        } else {
            const db = await this._getDb();
            const rows = await db.query(
                `SELECT DISTINCT chat_id
                 FROM telegram_subscriptions
                 WHERE order_id IN (?, ?)`,
                [String(order.id), String(order.order_code || '')]
            );
            targets = (rows || []).map((row) => String(row.chat_id));
        }

        if (!targets.length) return { success: false, reason: 'no_subscribers' };

        const text = this._orderCardText(order, {
            title: `Tracking update for #${order.order_code || order.id}`,
            note: includeStatus ? null : 'Status updated'
        });

        let delivered = 0;
        for (const target of targets) {
            const result = await this.sendMessage(
                'client',
                target,
                text,
                {
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('Open tracking', `${this.publicBaseUrl}/order-tracking/${encodeURIComponent(String(order.order_code || order.id))}`)]
                    ])
                },
                { category: 'tracking_update', priority: 'normal' }
            );
            if (result.ok) delivered += 1;
        }

        return { success: true, delivered };
    }

    async notifyOrderStatusSubscribers({ orderId, oldStatus = null, newStatus = null, note = null } = {}) {
        const order = await this._resolveOrder(orderId);
        if (!order) return { success: false, reason: 'order_not_found' };

        const db = await this._getDb();
        const rows = await db.query(
            `SELECT DISTINCT chat_id
             FROM telegram_subscriptions
             WHERE order_id IN (?, ?)`,
            [String(order.id), String(order.order_code || '')]
        );
        const targets = (rows || []).map((row) => String(row.chat_id));

        if (!targets.length) return { success: false, reason: 'no_subscribers' };

        const transition = oldStatus && newStatus
            ? `${this._statusText(oldStatus)} -> ${this._statusText(newStatus)}`
            : this._statusText(newStatus || order.status);

        const text = this._orderCardText(order, {
            title: `Order status update #${order.order_code || order.id}`,
            note: [
                `Status: <b>${htmlEscape(transition)}</b>`,
                note ? `Note: ${htmlEscape(note)}` : null
            ].filter(Boolean).join('\n')
        });

        let delivered = 0;
        for (const target of targets) {
            const result = await this.sendMessage(
                'client',
                target,
                text,
                {
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('Open tracking', `${this.publicBaseUrl}/order-tracking/${encodeURIComponent(String(order.order_code || order.id))}`)]
                    ])
                },
                { category: 'status_update', priority: 'normal' }
            );
            if (result.ok) delivered += 1;
        }

        return { success: true, delivered };
    }

    async _saveSupportThread({ clientChatId, orderId = null, messageText, direction = 'inbound', authorRole = 'client' } = {}) {
        const db = await this._getDb();
        await db.query(
            `INSERT INTO telegram_support_threads (client_chat_id, order_id, message_text, direction, author_role, created_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [String(clientChatId), orderId == null ? null : String(orderId), String(messageText), String(direction), String(authorRole)]
        );
    }

    async _sendSupportThreadToOps({ clientChatId, orderId = null, messageText, clientMeta = {} } = {}) {
        const target = this.supportChatId || this.adminChatId;
        if (!target) return;

        const profile = [
            clientMeta?.username ? `@${clientMeta.username}` : null,
            clientMeta?.first_name || null,
            `chat_id=${clientChatId}`
        ].filter(Boolean).join(' ');

        const body = [
            '<b>New support request</b>',
            `Client: ${htmlEscape(profile)}`,
            orderId ? `Order: <b>${htmlEscape(orderId)}</b>` : null,
            '',
            htmlEscape(messageText),
            '',
            `<code>/reply ${htmlEscape(clientChatId)} your answer</code>`
        ].filter((line) => line !== null).join('\n');

        await this.sendMessage('support', target, body, {}, { category: 'support', priority: 'high', bypassPreferences: true });
    }

    async _buildManagerBrief(managerId) {
        const db = await this._getDb();
        const [orderRows, overdueRows, signalRows, next24Rows] = await Promise.all([
            db.query(
                `SELECT status, COUNT(*) AS c
                 FROM orders
                 WHERE CAST(assigned_manager AS TEXT) = ?
                   AND status NOT IN ('delivered', 'closed', 'cancelled')
                 GROUP BY status
                 ORDER BY COUNT(*) DESC
                 LIMIT 5`,
                [String(managerId)]
            ),
            db.query(
                `SELECT COUNT(*) AS c
                 FROM tasks
                 WHERE CAST(COALESCE(completed, 0) AS INTEGER) = 0
                   AND CAST(assigned_to AS TEXT) = ?
                   AND due_at IS NOT NULL
                   AND datetime(due_at) < datetime('now')`,
                [String(managerId)]
            ),
            db.query(
                `SELECT
                    SUM(CASE WHEN severity IN ('critical','high') THEN 1 ELSE 0 END) AS high_c,
                    COUNT(*) AS total_c
                 FROM ai_signals
                 WHERE status IN ('open','in_progress','snoozed')
                   AND (assigned_to IS NULL OR CAST(assigned_to AS TEXT) = ?)`,
                [String(managerId)]
            ),
            db.query(
                `SELECT COUNT(*) AS c
                 FROM tasks
                 WHERE CAST(COALESCE(completed, 0) AS INTEGER) = 0
                   AND CAST(assigned_to AS TEXT) = ?
                   AND due_at IS NOT NULL
                   AND datetime(due_at) <= datetime('now', '+24 hours')`,
                [String(managerId)]
            )
        ]);

        const topStatuses = (orderRows || [])
            .map((row) => `${htmlEscape(this._statusText(row.status))}: <b>${Number(row.c || 0)}</b>`)
            .join('\n');

        const overdue = Number(overdueRows?.[0]?.c || 0);
        const highSignals = Number(signalRows?.[0]?.high_c || 0);
        const totalSignals = Number(signalRows?.[0]?.total_c || 0);
        const due24h = Number(next24Rows?.[0]?.c || 0);

        const actions = [];
        if (overdue > 0) actions.push(`- Close overdue tasks: <b>${overdue}</b>`);
        if (highSignals > 0) actions.push(`- Work high/critical AI signals: <b>${highSignals}</b>`);
        if (due24h > overdue) actions.push(`- Prepare upcoming tasks (24h): <b>${due24h - overdue}</b>`);
        if (!actions.length) actions.push('- No urgent blockers. Focus on lead conversion and updates.');

        return [
            '<b>Manager brief</b>',
            topStatuses || 'No active orders',
            `Overdue tasks: <b>${overdue}</b>`,
            `AI signals open: <b>${totalSignals}</b> (high/critical: <b>${highSignals}</b>)`,
            '',
            '<b>Recommended actions</b>',
            ...actions
        ].join('\n');
    }

    async _buildAdminBrief() {
        const db = await this._getDb();
        const [orders, tasks, signals, supportQueue] = await Promise.all([
            db.query(
                `SELECT status, COUNT(*) AS c
                 FROM orders
                 GROUP BY status
                 ORDER BY COUNT(*) DESC
                 LIMIT 6`
            ),
            db.query(
                `SELECT
                    SUM(CASE WHEN CAST(COALESCE(completed, 0) AS INTEGER) = 0 THEN 1 ELSE 0 END) AS open_c,
                    SUM(CASE WHEN CAST(COALESCE(completed, 0) AS INTEGER) = 0 AND due_at IS NOT NULL AND datetime(due_at) < datetime('now') THEN 1 ELSE 0 END) AS overdue_c
                 FROM tasks`
            ),
            db.query(
                `SELECT
                    SUM(CASE WHEN status IN ('open','in_progress','snoozed') THEN 1 ELSE 0 END) AS open_c,
                    SUM(CASE WHEN severity IN ('critical','high') AND status IN ('open','in_progress','snoozed') THEN 1 ELSE 0 END) AS high_c
                 FROM ai_signals`
            ),
            db.query(
                `SELECT COUNT(*) AS c
                 FROM telegram_support_threads t
                 WHERE t.direction = 'inbound'
                   AND NOT EXISTS (
                     SELECT 1
                     FROM telegram_support_threads r
                     WHERE r.client_chat_id = t.client_chat_id
                       AND r.direction = 'outbound'
                       AND datetime(r.created_at) >= datetime(t.created_at)
                   )`
            )
        ]);

        const statusTop = (orders || [])
            .map((row) => `${htmlEscape(this._statusText(row.status))}: <b>${Number(row.c || 0)}</b>`)
            .join('\n');

        const openTasks = Number(tasks?.[0]?.open_c || 0);
        const overdueTasks = Number(tasks?.[0]?.overdue_c || 0);
        const openSignals = Number(signals?.[0]?.open_c || 0);
        const highSignals = Number(signals?.[0]?.high_c || 0);
        const supportPending = Number(supportQueue?.[0]?.c || 0);

        return [
            '<b>Executive brief</b>',
            statusTop || 'No order status data',
            `Open tasks: <b>${openTasks}</b> (overdue: <b>${overdueTasks}</b>)`,
            `Open AI signals: <b>${openSignals}</b> (high/critical: <b>${highSignals}</b>)`,
            `Support queue pending: <b>${supportPending}</b>`
        ].join('\n');
    }

    _setupClientHandlers(bot) {
        const showPrefs = async (ctx) => {
            const chatId = String(ctx.chat.id);
            const prefs = await this.getPreferencesNormalized(chatId, 'client');
            await ctx.reply(this._preferencesText(prefs), {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('Toggle status updates', 'pref_toggle:status_updates')],
                    [Markup.button.callback('Toggle tracking updates', 'pref_toggle:tracking_updates')],
                    [Markup.button.callback('Toggle support updates', 'pref_toggle:support_updates')],
                    [Markup.button.callback('Snooze 60 min', 'pref_snooze:60'), Markup.button.callback('Snooze OFF', 'pref_snooze:off')]
                ])
            });
        };

        const parseHours = (value) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23) return null;
            return Math.trunc(parsed);
        };

        bot.start(async (ctx) => {
            const chatId = String(ctx.chat.id);
            await this.registerUserRole({
                chatId,
                role: 'client',
                username: ctx.from?.username || null,
                firstName: ctx.from?.first_name || null,
                lastName: ctx.from?.last_name || null
            });

            if (ctx.startPayload) {
                const consumed = this.consumeStartPayload(ctx.startPayload);
                if (consumed?.order_id) {
                    await this.subscribeOrder({ chatId, orderId: consumed.order_id, userId: consumed.user_id || null });
                    const order = await this._resolveOrder(consumed.order_id);
                    if (order) {
                        await ctx.reply(
                            this._orderCardText(order, { title: `Subscribed to order #${order.order_code || order.id}` }),
                            {
                                parse_mode: 'HTML',
                                ...Markup.inlineKeyboard([
                                    [Markup.button.url('Open tracking', `${this.publicBaseUrl}/order-tracking/${encodeURIComponent(String(order.order_code || order.id))}`)]
                                ])
                            }
                        );
                    }
                }
            }

            await ctx.reply('Welcome to EUBike client bot. Choose an action:', this._mainClientKeyboard());
        });

        bot.command('track', async (ctx) => {
            const targetId = String(ctx.message?.text || '').split(/\s+/)[1];
            if (!targetId) {
                await ctx.reply('Usage: /track <order_id>');
                return;
            }

            const order = await this._resolveOrder(targetId);
            if (!order) {
                await ctx.reply('Order not found.');
                return;
            }

            await this.subscribeOrder({ chatId: String(ctx.chat.id), orderId: order.order_code || order.id });
            await ctx.reply(this._orderCardText(order), { parse_mode: 'HTML' });
        });

        bot.command('orders', async (ctx) => {
            const rows = await this.getSubscriptions(String(ctx.chat.id));
            if (!rows.length) {
                await ctx.reply('No active subscriptions yet.');
                return;
            }
            for (const row of rows.slice(0, 10)) {
                const order = await this._resolveOrder(row.order_id);
                if (order) {
                    await ctx.reply(this._orderCardText(order), { parse_mode: 'HTML' });
                } else {
                    await ctx.reply(`Order ${row.order_id}`);
                }
            }
        });

        bot.command('prefs', async (ctx) => {
            await showPrefs(ctx);
        });

        bot.command('mute', async (ctx) => {
            const minutes = Number(String(ctx.message?.text || '').split(/\s+/)[1]);
            if (!Number.isFinite(minutes) || minutes <= 0) {
                await ctx.reply('Usage: /mute <minutes>');
                return;
            }
            const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
            await this.patchPreferences(String(ctx.chat.id), 'client', (prefs) => {
                prefs.snooze_until = until;
            });
            await ctx.reply(`Muted non-critical notifications until ${until}`);
        });

        bot.command('unmute', async (ctx) => {
            await this.patchPreferences(String(ctx.chat.id), 'client', (prefs) => {
                prefs.snooze_until = null;
            });
            await ctx.reply('Notifications unmuted.');
        });

        bot.command('quiet', async (ctx) => {
            const arg = String(ctx.message?.text || '').split(/\s+/)[1] || '';
            if (!arg) {
                await ctx.reply('Usage: /quiet <start-end> or /quiet off');
                return;
            }

            if (arg.toLowerCase() === 'off') {
                await this.patchPreferences(String(ctx.chat.id), 'client', (prefs) => {
                    prefs.quiet_hours.enabled = false;
                });
                await ctx.reply('Quiet hours disabled.');
                return;
            }

            const match = arg.match(/^(\d{1,2})-(\d{1,2})$/);
            if (!match) {
                await ctx.reply('Format: /quiet 23-8');
                return;
            }

            const start = parseHours(match[1]);
            const end = parseHours(match[2]);
            if (start == null || end == null) {
                await ctx.reply('Hours must be in range 0..23');
                return;
            }

            await this.patchPreferences(String(ctx.chat.id), 'client', (prefs) => {
                prefs.quiet_hours.enabled = true;
                prefs.quiet_hours.start = start;
                prefs.quiet_hours.end = end;
            });

            await ctx.reply(`Quiet hours set: ${String(start).padStart(2, '0')}:00-${String(end).padStart(2, '0')}:00`);
        });

        bot.command('help', async (ctx) => {
            await ctx.reply([
                'Commands:',
                '/track <id> - track order',
                '/orders - my subscriptions',
                '/prefs - notification settings',
                '/mute <minutes> - mute non-critical notifications',
                '/unmute - unmute notifications',
                '/quiet <start-end> - quiet hours',
                '/quiet off - disable quiet hours'
            ].join('\n'));
        });

        bot.hears(['My orders', '\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b'], async (ctx) => {
            ctx.message.text = '/orders';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/orders' } });
        });

        bot.hears(['Track order', '\u0422\u0440\u0435\u043a\u0438\u043d\u0433'], async (ctx) => {
            this.chatStates.set(String(ctx.chat.id), { mode: 'await_track' });
            await ctx.reply('Send order id or order code.');
        });

        bot.hears(['Support', '\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430'], async (ctx) => {
            this.chatStates.set(String(ctx.chat.id), { mode: 'await_support' });
            await ctx.reply('Send your message and we will pass it to support.');
        });

        bot.hears(['Settings', '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438'], async (ctx) => {
            await showPrefs(ctx);
        });

        bot.on('callback_query', async (ctx) => {
            const data = ctx.callbackQuery?.data || '';
            const chatId = String(ctx.chat.id);

            if (data.startsWith('pref_toggle:')) {
                const key = data.replace('pref_toggle:', '').trim();
                const allowed = new Set(['status_updates', 'tracking_updates', 'support_updates', 'ai_tips', 'broadcasts', 'reminders', 'promo']);
                if (!allowed.has(key)) {
                    await ctx.answerCbQuery('Unknown key');
                    return;
                }

                await this.patchPreferences(chatId, 'client', (prefs) => {
                    prefs.channels[key] = !(prefs.channels?.[key] !== false);
                });
                await ctx.answerCbQuery(`Toggled: ${key}`);
                return;
            }

            if (data.startsWith('pref_snooze:')) {
                const arg = data.replace('pref_snooze:', '').trim();
                if (arg === 'off') {
                    await this.patchPreferences(chatId, 'client', (prefs) => {
                        prefs.snooze_until = null;
                    });
                    await ctx.answerCbQuery('Snooze OFF');
                    return;
                }

                const minutes = Number(arg);
                if (!Number.isFinite(minutes) || minutes <= 0) {
                    await ctx.answerCbQuery('Invalid value');
                    return;
                }

                const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
                await this.patchPreferences(chatId, 'client', (prefs) => {
                    prefs.snooze_until = until;
                });
                await ctx.answerCbQuery(`Snoozed ${minutes}m`);
                return;
            }

            await ctx.answerCbQuery();
        });

        bot.on('text', async (ctx) => {
            const chatId = String(ctx.chat.id);
            const state = this.chatStates.get(chatId);
            if (!state) return;

            const text = String(ctx.message?.text || '').trim();
            if (!text) return;

            if (state.mode === 'await_track') {
                this.chatStates.delete(chatId);
                const order = await this._resolveOrder(text);
                if (!order) {
                    await ctx.reply('Order not found.');
                    return;
                }
                await this.subscribeOrder({ chatId, orderId: order.order_code || order.id });
                await ctx.reply(this._orderCardText(order), { parse_mode: 'HTML' });
                return;
            }

            if (state.mode === 'await_support') {
                this.chatStates.delete(chatId);
                const orderMatch = text.match(/#?(\d{2,})/);
                const maybeOrderId = orderMatch ? orderMatch[1] : null;

                await this._saveSupportThread({
                    clientChatId: chatId,
                    orderId: maybeOrderId,
                    messageText: text,
                    direction: 'inbound',
                    authorRole: 'client'
                });

                await this._sendSupportThreadToOps({
                    clientChatId: chatId,
                    orderId: maybeOrderId,
                    messageText: text,
                    clientMeta: ctx.from || {}
                });

                await ctx.reply('Message sent to support. Reply will come to this chat.');
            }
        });
    }

    _setupManagerHandlers(bot) {
        const ensureManager = async (ctx, { allowAdmin = true } = {}) => {
            const chatId = String(ctx.chat.id);
            const manager = await this._resolveManagerByTelegram(chatId);
            if (manager) return manager;
            if (this.allowedManagerIds.has(chatId)) {
                return { id: null, name: ctx.from?.first_name || 'Manager', role: 'manager', telegram_id: chatId };
            }
            const admin = allowAdmin ? await this._resolveAdminByTelegram(chatId) : null;
            if (admin) return admin;
            return null;
        };

        bot.start(async (ctx) => {
            const manager = await ensureManager(ctx, { allowAdmin: true });
            if (!manager) {
                await ctx.reply('Access denied. Use /link <email> with your corporate account email.');
                return;
            }

            await this.registerUserRole({
                chatId: String(ctx.chat.id),
                role: 'manager',
                userId: manager.id,
                username: ctx.from?.username || null,
                firstName: ctx.from?.first_name || null,
                lastName: ctx.from?.last_name || null
            });

            await ctx.reply(`Hello, ${manager.name || 'manager'}!`, this._mainManagerKeyboard());
        });

        bot.command('link', async (ctx) => {
            const email = String(ctx.message?.text || '').split(/\s+/)[1];
            if (!email || !email.includes('@')) {
                await ctx.reply('Usage: /link <email>');
                return;
            }

            const db = await this._getDb();
            const rows = await db.query(
                `SELECT id, name, role
                 FROM users
                 WHERE lower(email) = lower(?)
                   AND role IN ('manager', 'admin')
                 LIMIT 1`,
                [email]
            );
            const user = rows?.[0] || null;
            if (!user) {
                await ctx.reply('Manager/admin with this email was not found.');
                return;
            }

            await db.query('UPDATE users SET telegram_id = ? WHERE id = ?', [String(ctx.chat.id), String(user.id)]);
            await this.registerUserRole({
                chatId: String(ctx.chat.id),
                role: 'manager',
                userId: String(user.id),
                username: ctx.from?.username || null,
                firstName: ctx.from?.first_name || null,
                lastName: ctx.from?.last_name || null
            });

            await ctx.reply(`Linked successfully: ${user.name || user.id}`);
        });

        bot.command('my', async (ctx) => {
            const manager = await ensureManager(ctx);
            if (!manager || !manager.id) {
                await ctx.reply('Use /link <email> first.');
                return;
            }

            const db = await this._getDb();
            const rows = await db.query(
                `SELECT id, order_code, status, bike_name
                 FROM orders
                 WHERE CAST(assigned_manager AS TEXT) = ?
                   AND status NOT IN ('delivered', 'closed', 'cancelled')
                 ORDER BY datetime(created_at) DESC
                 LIMIT 12`,
                [String(manager.id)]
            );

            if (!rows.length) {
                await ctx.reply('No active orders.');
                return;
            }

            const lines = ['<b>My active orders</b>'];
            for (const row of rows) {
                lines.push(`- #${htmlEscape(row.order_code || row.id)} | ${htmlEscape(this._statusText(row.status))} | ${htmlEscape(row.bike_name || 'Bike')}`);
            }
            await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        });

        bot.command('tasks', async (ctx) => {
            const manager = await ensureManager(ctx);
            if (!manager || !manager.id) {
                await ctx.reply('Use /link <email> first.');
                return;
            }

            const db = await this._getDb();
            const rows = await db.query(
                `SELECT title, order_id
                 FROM tasks
                 WHERE CAST(COALESCE(completed, 0) AS INTEGER) = 0
                   AND CAST(assigned_to AS TEXT) = ?
                 ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, datetime(COALESCE(due_at, created_at)) ASC
                 LIMIT 12`,
                [String(manager.id)]
            );

            if (!rows.length) {
                await ctx.reply('No open tasks.');
                return;
            }

            const lines = ['<b>Open tasks</b>'];
            for (const row of rows) {
                lines.push(`- ${htmlEscape(row.title || 'Task')} (order: ${htmlEscape(String(row.order_id || '-'))})`);
            }
            await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        });

        bot.command('brief', async (ctx) => {
            const manager = await ensureManager(ctx);
            if (!manager || !manager.id) {
                await ctx.reply('Use /link <email> first.');
                return;
            }
            const briefing = await this._buildManagerBrief(manager.id);
            await ctx.reply(briefing, { parse_mode: 'HTML' });
        });

        bot.command('coach', async (ctx) => {
            const manager = await ensureManager(ctx);
            if (!manager || !manager.id) {
                await ctx.reply('Use /link <email> first.');
                return;
            }

            const brief = await this._buildManagerBrief(manager.id);
            const aiStatus = this.aiRopAutopilot && typeof this.aiRopAutopilot.getStatus === 'function'
                ? this.aiRopAutopilot.getStatus()
                : null;

            const aiLine = aiStatus
                ? `\n\n<b>AI-ROP</b>\nstate: <b>${aiStatus?.is_running ? 'running' : 'idle'}</b>`
                : '';

            await ctx.reply(`${brief}${aiLine}`, { parse_mode: 'HTML' });
        });

        bot.command('prefs', async (ctx) => {
            const chatId = String(ctx.chat.id);
            const prefs = await this.getPreferencesNormalized(chatId, 'manager');
            await ctx.reply(this._preferencesText(prefs), {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('Toggle ai_tips', 'mgr_pref_toggle:ai_tips')],
                    [Markup.button.callback('Toggle broadcasts', 'mgr_pref_toggle:broadcasts')],
                    [Markup.button.callback('Snooze 30 min', 'mgr_pref_snooze:30'), Markup.button.callback('Snooze OFF', 'mgr_pref_snooze:off')]
                ])
            });
        });

        bot.command('signals', async (ctx) => {
            const manager = await ensureManager(ctx);
            if (!manager || !manager.id) {
                await ctx.reply('Use /link <email> first.');
                return;
            }

            const db = await this._getDb();
            const rows = await db.query(
                `SELECT severity, title, status
                 FROM ai_signals
                 WHERE status IN ('open','in_progress','snoozed')
                   AND (assigned_to IS NULL OR CAST(assigned_to AS TEXT) = ?)
                 ORDER BY
                    CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
                    datetime(COALESCE(last_seen_at, created_at)) DESC
                 LIMIT 10`,
                [String(manager.id)]
            );

            if (!rows.length) {
                await ctx.reply('No open AI signals.');
                return;
            }

            const lines = ['<b>AI signals</b>'];
            for (const row of rows) {
                lines.push(`- [${htmlEscape(row.severity)}] ${htmlEscape(row.title || 'signal')} (${htmlEscape(row.status || 'open')})`);
            }
            await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        });

        bot.command('kpi', async (ctx) => {
            const manager = await ensureManager(ctx);
            if (!manager || !manager.id) {
                await ctx.reply('Use /link <email> first.');
                return;
            }

            if (!this.managerKpiService || typeof this.managerKpiService.getScorecard !== 'function') {
                await ctx.reply('KPI service unavailable.');
                return;
            }

            try {
                const payload = await this.managerKpiService.getScorecard(String(manager.id), null);
                const score = Number(payload?.scorecard?.score_pct || 0);
                const payout = Number(payload?.scorecard?.payout_multiplier || 1);
                await ctx.reply(
                    `KPI: <b>${score.toFixed(1)}%</b>\nMultiplier: <b>x${payout.toFixed(2)}</b>\nPeriod: ${htmlEscape(payload?.periodKey || 'n/a')}`,
                    { parse_mode: 'HTML' }
                );
            } catch (error) {
                await ctx.reply(`KPI error: ${String(error?.message || error)}`);
            }
        });

        bot.command('airop', async (ctx) => {
            if (!this.aiRopAutopilot || typeof this.aiRopAutopilot.runOnce !== 'function') {
                await ctx.reply('AI-ROP service unavailable.');
                return;
            }

            await ctx.reply('Starting AI-ROP run...');
            const result = await this.aiRopAutopilot.runOnce({
                trigger: `tg_manager:${ctx.from?.id || 'unknown'}`,
                syncLocal: false
            });

            await ctx.reply(
                [
                    '<b>AI-ROP completed</b>',
                    `success: <b>${result?.success ? 'yes' : 'no'}</b>`,
                    `assigned: <b>${Number(result?.assigned || 0)}</b>`,
                    `sla_alerts: <b>${Number(result?.sla_alerts || 0)}</b>`
                ].join('\n'),
                { parse_mode: 'HTML' }
            );
        });

        bot.command('remind', async (ctx) => {
            const manager = await ensureManager(ctx);
            if (!manager) {
                await ctx.reply('No access.');
                return;
            }

            const [, orderCode, minutesRaw] = String(ctx.message?.text || '').split(/\s+/);
            const minutes = Number(minutesRaw);
            if (!orderCode || !Number.isFinite(minutes) || minutes <= 0) {
                await ctx.reply('Usage: /remind <order_code> <minutes>');
                return;
            }

            await this.createReminder({
                role: 'manager',
                chatId: String(ctx.chat.id),
                title: `Reminder for order ${orderCode}`,
                messageText: `Check order #${orderCode} and update status.`,
                remindAt: new Date(Date.now() + minutes * 60 * 1000),
                payload: { order_code: orderCode }
            });

            await ctx.reply(`Reminder set for ${minutes} minutes.`);
        });

        bot.command('mute', async (ctx) => {
            const minutes = Number(String(ctx.message?.text || '').split(/\s+/)[1]);
            if (!Number.isFinite(minutes) || minutes <= 0) {
                await ctx.reply('Usage: /mute <minutes>');
                return;
            }
            const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
            await this.patchPreferences(String(ctx.chat.id), 'manager', (prefs) => {
                prefs.snooze_until = until;
            });
            await ctx.reply(`Focus mode enabled until ${until}`);
        });

        bot.command('unmute', async (ctx) => {
            await this.patchPreferences(String(ctx.chat.id), 'manager', (prefs) => {
                prefs.snooze_until = null;
            });
            await ctx.reply('Focus mode disabled.');
        });

        bot.hears(['My orders', '\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b'], async (ctx) => {
            ctx.message.text = '/my';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/my' } });
        });

        bot.hears(['Tasks', '\u0417\u0430\u0434\u0430\u0447\u0438'], async (ctx) => {
            ctx.message.text = '/tasks';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/tasks' } });
        });

        bot.hears(['AI signals', 'AI \u0441\u0438\u0433\u043d\u0430\u043b\u044b'], async (ctx) => {
            ctx.message.text = '/signals';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/signals' } });
        });

        bot.hears(['KPI'], async (ctx) => {
            ctx.message.text = '/kpi';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/kpi' } });
        });

        bot.hears(['Brief'], async (ctx) => {
            ctx.message.text = '/brief';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/brief' } });
        });

        bot.hears(['Settings', '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438'], async (ctx) => {
            ctx.message.text = '/prefs';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/prefs' } });
        });

        bot.hears(['Help', '\u041f\u043e\u043c\u043e\u0449\u044c'], async (ctx) => {
            await ctx.reply('Commands: /my /tasks /brief /coach /signals /kpi /airop /remind /prefs /mute /unmute');
        });

        bot.on('callback_query', async (ctx) => {
            const data = ctx.callbackQuery?.data || '';
            const chatId = String(ctx.chat.id);

            if (data.startsWith('mgr_pref_toggle:')) {
                const key = data.replace('mgr_pref_toggle:', '').trim();
                const allowed = new Set(['ai_tips', 'broadcasts', 'reminders']);
                if (!allowed.has(key)) {
                    await ctx.answerCbQuery('Unknown key');
                    return;
                }
                await this.patchPreferences(chatId, 'manager', (prefs) => {
                    prefs.channels[key] = !(prefs.channels?.[key] !== false);
                });
                await ctx.answerCbQuery(`Toggled: ${key}`);
                return;
            }

            if (data.startsWith('mgr_pref_snooze:')) {
                const arg = data.replace('mgr_pref_snooze:', '').trim();
                if (arg === 'off') {
                    await this.patchPreferences(chatId, 'manager', (prefs) => {
                        prefs.snooze_until = null;
                    });
                    await ctx.answerCbQuery('Snooze OFF');
                    return;
                }
                const minutes = Number(arg);
                if (!Number.isFinite(minutes) || minutes <= 0) {
                    await ctx.answerCbQuery('Invalid value');
                    return;
                }
                const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
                await this.patchPreferences(chatId, 'manager', (prefs) => {
                    prefs.snooze_until = until;
                });
                await ctx.answerCbQuery(`Snoozed ${minutes}m`);
                return;
            }

            if (String(data).startsWith('mgr_take:')) return;
            await ctx.answerCbQuery();
        });

        bot.action(/^mgr_take:(.+)$/, async (ctx) => {
            await ctx.answerCbQuery('Open CRM order card and update status.');
        });
    }

    _setupAdminHandlers(bot) {
        const ensureAdmin = async (ctx) => {
            if (this._isAdminChat(ctx.chat.id)) return { id: null, name: 'Admin' };
            return this._resolveAdminByTelegram(String(ctx.chat.id));
        };

        bot.start(async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Admin access only.');
                return;
            }

            await this.registerUserRole({
                chatId: String(ctx.chat.id),
                role: 'admin',
                userId: admin.id || null,
                username: ctx.from?.username || null,
                firstName: ctx.from?.first_name || null,
                lastName: ctx.from?.last_name || null
            });

            await ctx.reply('Admin center online.', this._mainAdminKeyboard());
        });

        bot.command('digest', async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Access denied.');
                return;
            }
            await this.sendAdminDigest({ includeAiRop: true });
            await ctx.reply('Digest sent.');
        });

        bot.command('brief', async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Access denied.');
                return;
            }
            const briefing = await this._buildAdminBrief();
            await ctx.reply(briefing, { parse_mode: 'HTML' });
        });

        bot.command('signals', async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Access denied.');
                return;
            }

            const db = await this._getDb();
            const rows = await db.query(
                `SELECT severity, title, status, assigned_to
                 FROM ai_signals
                 WHERE status IN ('open','in_progress','snoozed')
                 ORDER BY
                    CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
                    datetime(COALESCE(last_seen_at, created_at)) DESC
                 LIMIT 12`
            );

            if (!rows.length) {
                await ctx.reply('No open signals.');
                return;
            }

            const lines = ['<b>Open AI signals</b>'];
            for (const row of rows) {
                lines.push(`- [${htmlEscape(row.severity)}] ${htmlEscape(row.title || 'signal')} -> ${htmlEscape(row.status || 'open')} (assignee: ${htmlEscape(row.assigned_to || 'none')})`);
            }
            await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        });

        bot.command('airop', async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Access denied.');
                return;
            }
            if (!this.aiRopAutopilot || typeof this.aiRopAutopilot.runOnce !== 'function') {
                await ctx.reply('AI-ROP service unavailable.');
                return;
            }

            await ctx.reply('Starting AI-ROP run...');
            const result = await this.aiRopAutopilot.runOnce({
                trigger: `tg_admin:${ctx.from?.id || 'unknown'}`,
                syncLocal: true
            });

            await ctx.reply(
                [
                    '<b>AI-ROP done</b>',
                    `success: <b>${result?.success ? 'yes' : 'no'}</b>`,
                    `assigned: <b>${Number(result?.assigned || 0)}</b>`,
                    `blocked: <b>${Number(result?.blocked_out_of_policy || 0)}</b>`
                ].join('\n'),
                { parse_mode: 'HTML' }
            );
        });

        bot.command('prefs', async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Access denied.');
                return;
            }
            const chatId = String(ctx.chat.id);
            const prefs = await this.getPreferencesNormalized(chatId, 'admin');
            await ctx.reply(this._preferencesText(prefs), {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('Toggle ai_tips', 'adm_pref_toggle:ai_tips')],
                    [Markup.button.callback('Toggle broadcasts', 'adm_pref_toggle:broadcasts')],
                    [Markup.button.callback('Snooze 20 min', 'adm_pref_snooze:20'), Markup.button.callback('Snooze OFF', 'adm_pref_snooze:off')]
                ])
            });
        });

        bot.command('mute', async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Access denied.');
                return;
            }
            const minutes = Number(String(ctx.message?.text || '').split(/\s+/)[1]);
            if (!Number.isFinite(minutes) || minutes <= 0) {
                await ctx.reply('Usage: /mute <minutes>');
                return;
            }
            const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
            await this.patchPreferences(String(ctx.chat.id), 'admin', (prefs) => {
                prefs.snooze_until = until;
            });
            await ctx.reply(`Notifications muted until ${until}`);
        });

        bot.command('unmute', async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Access denied.');
                return;
            }
            await this.patchPreferences(String(ctx.chat.id), 'admin', (prefs) => {
                prefs.snooze_until = null;
            });
            await ctx.reply('Notifications unmuted.');
        });

        bot.command('broadcast', async (ctx) => {
            const admin = await ensureAdmin(ctx);
            if (!admin) {
                await ctx.reply('Access denied.');
                return;
            }

            const text = String(ctx.message?.text || '').replace('/broadcast', '').trim();
            if (!text) {
                await ctx.reply('Usage: /broadcast <text>');
                return;
            }

            const managers = await this._resolveManagersForBroadcast();
            let delivered = 0;
            for (const manager of managers || []) {
                const chatId = manager.telegram_id == null ? null : String(manager.telegram_id);
                if (!chatId) continue;
                const result = await this.sendMessage(
                    'manager',
                    chatId,
                    `<b>Broadcast</b>\n${htmlEscape(text)}`,
                    {},
                    { category: 'broadcast', priority: 'high' }
                );
                if (result.ok) delivered += 1;
            }

            await ctx.reply(`Delivered: ${delivered}`);
        });

        bot.on('callback_query', async (ctx) => {
            const data = ctx.callbackQuery?.data || '';
            const chatId = String(ctx.chat.id);

            if (data.startsWith('adm_pref_toggle:')) {
                const key = data.replace('adm_pref_toggle:', '').trim();
                const allowed = new Set(['ai_tips', 'broadcasts', 'reminders']);
                if (!allowed.has(key)) {
                    await ctx.answerCbQuery('Unknown key');
                    return;
                }
                await this.patchPreferences(chatId, 'admin', (prefs) => {
                    prefs.channels[key] = !(prefs.channels?.[key] !== false);
                });
                await ctx.answerCbQuery(`Toggled: ${key}`);
                return;
            }

            if (data.startsWith('adm_pref_snooze:')) {
                const arg = data.replace('adm_pref_snooze:', '').trim();
                if (arg === 'off') {
                    await this.patchPreferences(chatId, 'admin', (prefs) => {
                        prefs.snooze_until = null;
                    });
                    await ctx.answerCbQuery('Snooze OFF');
                    return;
                }
                const minutes = Number(arg);
                if (!Number.isFinite(minutes) || minutes <= 0) {
                    await ctx.answerCbQuery('Invalid value');
                    return;
                }
                const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
                await this.patchPreferences(chatId, 'admin', (prefs) => {
                    prefs.snooze_until = until;
                });
                await ctx.answerCbQuery(`Snoozed ${minutes}m`);
                return;
            }

            await ctx.answerCbQuery();
        });

        bot.hears(['Digest', '\u0414\u0430\u0439\u0434\u0436\u0435\u0441\u0442'], async (ctx) => {
            ctx.message.text = '/digest';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/digest' } });
        });

        bot.hears(['Brief'], async (ctx) => {
            ctx.message.text = '/brief';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/brief' } });
        });

        bot.hears(['AI-ROP'], async (ctx) => {
            ctx.message.text = '/airop';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/airop' } });
        });

        bot.hears(['Signals', '\u0421\u0438\u0433\u043d\u0430\u043b\u044b'], async (ctx) => {
            ctx.message.text = '/signals';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/signals' } });
        });

        bot.hears(['Settings', '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438'], async (ctx) => {
            ctx.message.text = '/prefs';
            await bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/prefs' } });
        });
    }

    _setupSupportHandlers(bot) {
        bot.start(async (ctx) => {
            await this.registerUserRole({
                chatId: String(ctx.chat.id),
                role: 'support',
                userId: null,
                username: ctx.from?.username || null,
                firstName: ctx.from?.first_name || null,
                lastName: ctx.from?.last_name || null
            });
            await ctx.reply('Support bot online. Commands: /open, /threads, /thread <chat_id>, /reply <chat_id> <message>');
        });

        bot.command('reply', async (ctx) => {
            const parts = String(ctx.message?.text || '').split(/\s+/);
            const targetChat = parts[1];
            const text = parts.slice(2).join(' ').trim();
            if (!targetChat || !text) {
                await ctx.reply('Usage: /reply <chat_id> <message>');
                return;
            }

            await this.sendMessage('client', targetChat, `<b>Support reply</b>\n${htmlEscape(text)}`, {}, { category: 'support_reply', priority: 'high' });
            await this._saveSupportThread({
                clientChatId: targetChat,
                orderId: null,
                messageText: text,
                direction: 'outbound',
                authorRole: 'support'
            });
            await ctx.reply('Reply sent.');
        });

        bot.command('open', async (ctx) => {
            const db = await this._getDb();
            const rows = await db.query(
                `SELECT t.client_chat_id, t.order_id, t.message_text
                 FROM telegram_support_threads t
                 WHERE t.direction = 'inbound'
                   AND NOT EXISTS (
                     SELECT 1
                     FROM telegram_support_threads r
                     WHERE r.client_chat_id = t.client_chat_id
                       AND r.direction = 'outbound'
                       AND datetime(r.created_at) >= datetime(t.created_at)
                   )
                 ORDER BY datetime(t.created_at) DESC
                 LIMIT 12`
            );

            if (!rows.length) {
                await ctx.reply('No open support threads.');
                return;
            }

            const lines = ['<b>Open support threads</b>'];
            for (const row of rows) {
                lines.push(`- ${htmlEscape(row.client_chat_id)} ${row.order_id ? `(order #${htmlEscape(row.order_id)})` : ''}: ${htmlEscape(String(row.message_text || '').slice(0, 80))}`);
            }
            await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        });

        bot.command('thread', async (ctx) => {
            const chatId = String(ctx.message?.text || '').split(/\s+/)[1];
            if (!chatId) {
                await ctx.reply('Usage: /thread <chat_id>');
                return;
            }

            const db = await this._getDb();
            const rows = await db.query(
                `SELECT direction, message_text
                 FROM telegram_support_threads
                 WHERE client_chat_id = ?
                 ORDER BY datetime(created_at) DESC
                 LIMIT 15`,
                [chatId]
            );

            if (!rows.length) {
                await ctx.reply('Thread history not found.');
                return;
            }

            const lines = [`<b>Thread ${htmlEscape(chatId)}</b>`];
            for (const row of rows.reverse()) {
                lines.push(`${row.direction === 'outbound' ? 'support' : 'client'}: ${htmlEscape(String(row.message_text || '').slice(0, 140))}`);
            }
            await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        });

        bot.command('threads', async (ctx) => {
            const db = await this._getDb();
            const rows = await db.query(
                `SELECT client_chat_id, order_id, message_text
                 FROM telegram_support_threads
                 WHERE direction = 'inbound'
                 ORDER BY datetime(created_at) DESC
                 LIMIT 12`
            );
            if (!rows.length) {
                await ctx.reply('No inbound threads.');
                return;
            }
            const lines = ['<b>Latest support requests</b>'];
            for (const row of rows) {
                lines.push(`- ${htmlEscape(row.client_chat_id)} ${row.order_id ? `(order #${htmlEscape(row.order_id)})` : ''}: ${htmlEscape(String(row.message_text || '').slice(0, 80))}`);
            }
            await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        });
    }
}

module.exports = new TelegramHubService();
