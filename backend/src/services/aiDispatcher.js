// @ts-check
const axios = require('axios');
const ValuationService = require('./ValuationService');

class AIDispatcher {
    constructor(dbManager, geminiClient = null, config = {}) {
        this.db = dbManager;
        this.geminiClient = geminiClient;
        this.config = {
            sentimentThresholds: {
                critical: 0.3,
                warning: 0.5,
                positive: 0.8
            },
            adminPushUrl: config.adminPushUrl || 'http://localhost:8081/api/admin/push',
            ...config
        };
    }

    setGeminiClient(client) {
        this.geminiClient = client;
    }

    /**
     * Main entry point for processing user messages
     * @param {string|number} userId
     * @param {string} userMessage
     * @returns {Promise<{text: string, options: any, sentiment: number}>}
     */
    async handleUserMessage(userId, userMessage) {
        if (!this.geminiClient) {
            return { text: "⚠️ AI Service Unavailable (No Client)", options: {}, sentiment: 0.5 };
        }

        const startedAt = Date.now();
        console.log(`🧠 Brain: Processing message from ${userId}: "${userMessage}"`);

        // 1. Fetch Full Context (The "Inject Context" Step)
        const context = await this.fetchFullContext(userId, userMessage);
        console.log(`🧠 Brain: Context ready`, {
            hasSession: !!context.session,
            bikes: Array.isArray(context.bikes) ? context.bikes.length : 0,
            topCategories: Array.isArray(context.topCategories) ? context.topCategories.length : 0,
            settings: context.settings ? Object.keys(context.settings).length : 0
        });
        
        // 2. Generate System Prompt (The "Persona" Step)
        const systemPrompt = this.generateSystemPrompt(context, userMessage);
        console.log(`🧠 Brain: Prompt ready`, {
            chars: typeof systemPrompt === 'string' ? systemPrompt.length : 0
        });

        // 3. Call LLM
        let responseText = "";
        try {
            const result = await this.geminiClient.generateContent(systemPrompt);
            responseText = (typeof result === 'string' ? result : result?.text) || "Извините, я задумался. Можете повторить?";
        } catch (e) {
            console.error('❌ Brain LLM Error:', {
                message: e?.message,
                name: e?.name
            });
            const fallbackText = this.buildFallbackReply(context, userMessage);
            return {
                text: fallbackText,
                options: {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👤 Позвать человека', callback_data: 'call_human' }]
                        ]
                    }
                },
                sentiment: 0.5
            };
        }

        // 4. Parse Response (Extract Sentiment & Prefs)
        const { replyText, sentimentScore, newPrefs } = this.parseLLMResponse(responseText);

        // 5. Update Memory (The "Structured Memory" Step)
        try {
            await this.updateMemory(userId, context, userMessage, replyText, sentimentScore, newPrefs);
            console.log(`🧠 Brain: Memory updated`, { userId, sentimentScore });
        } catch (e) {
            console.error('❌ Brain: Memory update failed', { message: e?.message, userId });
        }

        // 6. Check Dispatch Logic (Handover/Briefing)
        const dispatchAction = await this.dispatch(userId, sentimentScore, userMessage, context.orderId, context);

        let options = {};
        if (dispatchAction.action === 'suggest_human') {
            options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👤 Позвать человека', callback_data: 'call_human' }]
                    ]
                }
            };
        }

        return {
            text: replyText,
            options,
            sentiment: sentimentScore
        };
    }

    buildFallbackReply(context, userMessage) {
        const msg = String(userMessage || '').toLowerCase();
        const settings = context?.settings || {};
        const deliveryDays = settings.delivery_days || "14-21 день";
        const commission = settings.commission_rate || "5% (минимум 500€)";
        const eurRate = settings.eur_rate || "около 100 руб";

        const bikes = Array.isArray(context?.bikes) ? context.bikes : [];
        if (bikes.length > 0) {
            const bikesStr = bikes.slice(0, 5).join('\n');
            return `Сейчас есть временные ограничения по AI, но я уже нашёл варианты по вашему запросу:\n\n${bikesStr}\n\nЕсли скажете рост/стиль катания/бюджет и желаемую ростовку, я сужу выбор.`;
        }

        if (msg.includes('достав') || msg.includes('доставка') || msg.includes('срок')) {
            return `По доставке обычно ориентируемся на ${deliveryDays}.\nКомиссия сервиса: ${commission}.\nКурс для расчётов: 1 EUR ~ ${eurRate}.\n\nЕсли назовёте город и бюджет, подберу варианты.`;
        }

        if (msg.includes('цена') || msg.includes('стоим') || msg.includes('сколько')) {
            return `Если речь про стоимость “под ключ”, обычно добавляется комиссия (${commission}) и доставка.\nКурс для расчётов: 1 EUR ~ ${eurRate}.\n\nНапишите бюджет в € и какой тип велосипеда ищете.`;
        }

        return "Извините, сейчас есть временные ограничения по AI. Я уже вижу ваш запрос и могу продолжить: напишите бренд/модель или тип велосипеда, рост и бюджет — и я подберу варианты из каталога.";
    }

    /**
     * Fetch all relevant context for the user
     */
    async fetchFullContext(userId, message) {
        const context = {
            session: null,
            bikes: [],
            orderId: null,
            userPreferences: {},
            topCategories: [],
            settings: {}
        };

        console.log(`🔍 [AIDispatcher] Fetching context for user ${userId}...`);

        // A. Get Session & Prefs
        try {
            const session = await this.db.getSession(userId);
            if (session) {
                context.session = session;
                context.orderId = session.order_id;
                try {
                    context.userPreferences = session.user_preferences ? JSON.parse(session.user_preferences) : {};
                } catch (e) { context.userPreferences = {}; }
            }
        } catch (e) { console.warn('Brain: Session fetch failed', e.message); }

        // B. Search Bikes (Intelligent Keyword Search)
        try {
            // Extract keywords that look like bike brands or models (2+ chars)
            // This is a naive extraction, but better than splitting by space
            // Common bike brands: Trek, Specialized, Canyon, Scott, Cube, Giant, etc.
            // We can also check against a hardcoded list or DB brands if needed.
            // For now, let's look for capitalized words or words > 3 chars in the message
            
            // Simple approach: Get words > 2 chars
            const words = message.replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => w.length > 2);
            
            if (words.length > 0) {
                // Construct a search query
                // We want to find bikes where Brand OR Model matches any of the words
                const conditions = [];
                const params = [];
                
                for (const word of words) {
                    conditions.push(`brand LIKE ? OR model LIKE ? OR name LIKE ?`);
                    const term = `%${word}%`;
                    params.push(term, term, term);
                }
                
                if (conditions.length > 0) {
                    const sql = `SELECT id, brand, model, price, category, size, condition_status, description FROM bikes WHERE (${conditions.join(' OR ')}) AND is_active = 1 LIMIT 5`;
                    const bikes = await this.db.allQuery(sql, params);
                    context.bikes = bikes.map(b => this.formatBikeForPrompt(b));
                    if (bikes.length > 0) {
                        console.log(`🚲 [AIDispatcher] Found ${bikes.length} relevant bikes.`);
                    }
                }
            }
        } catch (e) { console.warn('Brain: Bike search failed', e.message); }

        // C. Fetch Behavior Metrics (Top Categories)
        try {
            // Assuming we have user_id in metric_events, or we use session_id if we have it
            // For now, if we have userId (which might be session ID for web users), we can try to join
            // Actually, server.js uses `bike_behavior_metrics` which is aggregated per bike.
            // We need per-user metrics. `metric_events` table has `user_id` or `session_id`.
            // Let's assume userId passed here matches `user_id` or `session_id` in metric_events.
            
            // Try matching user_id first (if integer), then session_id
            let userIdentifier = userId;
            let userCol = 'user_id';
            if (String(userId).length > 10) { // Likely a session ID string
                 userCol = 'session_id';
            }

            const sql = `
                SELECT b.category, COUNT(*) as count 
                FROM metric_events m
                JOIN bikes b ON m.bike_id = b.id
                WHERE m.${userCol} = ?
                GROUP BY b.category
                ORDER BY count DESC
                LIMIT 3
            `;
            const rows = await this.db.allQuery(sql, [userIdentifier]);
            context.topCategories = rows.map(r => r.category);
        } catch (e) { console.warn('Brain: Metrics fetch failed', e.message); }

        // D. Fetch System Settings (Rules)
        try {
            // If system_settings table exists, fetch relevant keys
            // Otherwise use defaults
            const rows = await this.db.allQuery("SELECT key, value FROM system_settings WHERE key IN ('delivery_days', 'commission_rate', 'eur_rate')");
            const settings = {};
            rows.forEach(r => settings[r.key] = r.value);
            context.settings = settings;
        } catch (e) { console.warn('Brain: Settings fetch failed', e.message); }

        return context;
    }

    formatBikeForPrompt(bike) {
        return `[ID:${bike.id}] ${bike.brand} ${bike.model} (${bike.category}) - ${bike.price}€
Specs: Size ${bike.size || 'N/A'}, Condition: ${bike.condition_status || 'Used'}.
Desc: ${bike.description ? bike.description.substring(0, 100).replace(/\n/g, ' ') + '...' : ''}`;
    }

    /**
     * Generate the Persona System Prompt
     */
    generateSystemPrompt(context, userMessage) {
        const { session, bikes, userPreferences, topCategories, settings } = context;
        
        const history = session ? session.last_context : "Нет истории.";
        const prefsStr = Object.keys(userPreferences).length ? JSON.stringify(userPreferences) : "Неизвестно";
        const bikesStr = bikes.length > 0 ? bikes.join('\n') : "Нет конкретных велосипедов, найденных по запросу.";
        const categoriesStr = topCategories.length > 0 ? topCategories.join(', ') : "Неизвестно";
        
        // Default settings if not in DB
        const deliveryDays = settings.delivery_days || "14-21 день";
        const commission = settings.commission_rate || "5% (минимум 500€)";
        const eurRate = settings.eur_rate || "около 100 руб";

        return `
Role: You are the "Senior Concierge" at EUBike (Premium Bicycle Marketplace).
Tone: Expert, Calm, Helpful, Proactive. You are not a robot, you are a bicycle expert.
Language: Russian (Русский).

Global Knowledge (System Settings):
- Delivery Time: ${deliveryDays} to Russia.
- Service Fee: ${commission}.
- Currency: 1 EUR ~ ${eurRate}.
- We check every bike physically before shipping.

User Context:
- Preferences (from previous chats): ${prefsStr}
- Interested Categories (based on clicks): ${categoriesStr}

Database Results (Relevant to "${userMessage}"):
${bikesStr}

Dialogue History:
${history}

User Input: "${userMessage}"

Task:
1. Answer the user's question expertly.
2. If they ask about a specific bike found in "Database Results", recommend it citing its specs (ID, Price, Specs).
3. If they ask about delivery or price, use the Global Knowledge.
4. If the user shares new personal details (height, riding style, budget), EXTRACT them in a JSON block at the end.
5. Analyze sentiment (0.0 - 1.0).

Output Format:
Your answer to the user here...

[DATA_SECTION]
SENTIMENT: 0.X
PREFS: {"height": "...", "style": "...", "budget": "..."} (Only if new info found, otherwise {})
[/DATA_SECTION]
`;
    }

    parseLLMResponse(text) {
        let replyText = text;
        let sentimentScore = 0.5;
        let newPrefs = {};

        // Extract DATA_SECTION
        const match = text.match(/\[DATA_SECTION\]([\s\S]*?)\[\/DATA_SECTION\]/);
        if (match) {
            const dataContent = match[1];
            replyText = text.replace(match[0], '').trim();

            // Extract Sentiment
            const sentMatch = dataContent.match(/SENTIMENT:\s*([0-9.]+)/);
            if (sentMatch) sentimentScore = parseFloat(sentMatch[1]);

            // Extract Prefs
            const prefsMatch = dataContent.match(/PREFS:\s*(\{.*\})/);
            if (prefsMatch) {
                try {
                    newPrefs = JSON.parse(prefsMatch[1]);
                } catch (e) { console.error('Brain: Failed to parse extracted prefs', e); }
            }
        } else {
             // Fallback for old format or if LLM fails
             const oldMatch = text.match(/\[SENTIMENT:\s*([0-9.]+)\]/);
             if (oldMatch) {
                 sentimentScore = parseFloat(oldMatch[1]);
                 replyText = text.replace(/\[SENTIMENT:\s*[0-9.]+\]/, '').trim();
             }
        }

        return { replyText, sentimentScore, newPrefs };
    }

    async updateMemory(userId, context, userMessage, replyText, sentimentScore, newPrefs) {
        // Merge prefs
        const currentPrefs = context.userPreferences || {};
        const updatedPrefs = { ...currentPrefs, ...newPrefs };
        
        // Update History
        let lastContext = context.session ? context.session.last_context : "";
        let newHistory = lastContext + `\nUser: ${userMessage}\nAssistant: ${replyText}`;
        const lines = newHistory.split('\n');
        if (lines.length > 12) {
            newHistory = lines.slice(-12).join('\n');
        }

        await this.db.saveSession(userId, context.orderId, newHistory, sentimentScore, updatedPrefs);
    }

    // --- Dispatcher Logic (Handover) ---

    // Sync Logic
    generateSyncCode() {
        // Generate a 6-digit random code
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async mergeSessions(telegramUserId, webSessionId) {
        try {
            const webSession = await this.db.getSession(webSessionId);
            const tgSession = await this.db.getSession(telegramUserId);

            if (!webSession) return { success: false, message: 'Web session not found' };

            // Merge Logic:
            // 1. Combine context (history)
            // 2. Merge preferences
            // 3. Delete web session (or mark as merged)
            // 4. Update tg session

            const combinedContext = (tgSession ? tgSession.last_context : '') + '\n' + (webSession.last_context || '');
            
            let combinedPrefs = {};
            try {
                const webPrefs = webSession.user_preferences ? JSON.parse(webSession.user_preferences) : {};
                const tgPrefs = tgSession && tgSession.user_preferences ? JSON.parse(tgSession.user_preferences) : {};
                combinedPrefs = { ...tgPrefs, ...webPrefs };
            } catch (e) {}

            await this.db.saveSession(telegramUserId, tgSession ? tgSession.order_id : null, combinedContext, 0.8, combinedPrefs);
            
            // Optional: You might want to delete the web session or link it.
            // For now, we just leave it, but the web client should update its ID to the telegram ID if possible, 
            // or we just rely on the user moving to Telegram.
            
            return { success: true, message: 'Sessions merged successfully' };
        } catch (e) {
            console.error('Session merge failed:', e);
            return { success: false, message: e.message };
        }
    }

    async dispatch(userId, sentimentScore, lastMessage, orderId, context) {
        // 1. Critical Negative Sentiment
        if (sentimentScore < this.config.sentimentThresholds.critical) {
            await this.handleCriticalSentiment(userId, sentimentScore, lastMessage, orderId, context);
            return { action: 'escalate', priority: 'high' };
        }

        // 2. Warning / Neutral
        if (sentimentScore < this.config.sentimentThresholds.positive) {
            return { action: 'suggest_human', priority: 'medium' };
        }

        // 3. Positive -> Auto-pilot
        return { action: 'autopilot', priority: 'low' };
    }

    async handleCriticalSentiment(userId, score, lastMessage, orderId, context) {
        const briefing = await this.generateBriefing(userId, context, lastMessage, "Negative Sentiment");
        
        const alertPayload = {
            type: 'CRITICAL_SENTIMENT',
            title: `🔥 Срочно! Негатив (Score: ${score})`,
            body: briefing, // Briefing is the body now
            data: { userId, orderId, sentimentScore: score }
        };

        await this.sendPushToAdmin(alertPayload);
        await this.logDispatchEvent(userId, 'critical_alert', score);
    }

    async notifyHumanNeeded(userId, orderId) {
        // We need to fetch context again if called from outside
        const session = await this.db.getSession(userId);
        const context = {
             session,
             bikes: [], // Can't fetch bikes easily here without message, that's ok
             userPreferences: session && session.user_preferences ? JSON.parse(session.user_preferences) : {}
        };
        
        const briefing = await this.generateBriefing(userId, context, "Human Requested", "User clicked 'Call Human'");

        const alertPayload = {
            type: 'HUMAN_REQUESTED',
            title: `👤 Клиент просит человека`,
            body: briefing,
            data: { userId, orderId }
        };

        await this.sendPushToAdmin(alertPayload);
        await this.logDispatchEvent(userId, 'human_requested', null);
    }

    /**
     * Generate structured briefing for admin
     */
    async generateBriefing(userId, context, lastMessage, reason) {
        // If we have an LLM, we can ask it to summarize.
        // For speed/reliability, we can try LLM, or fallback to template.
        
        if (this.geminiClient) {
            const prompt = `
Task: Create a 4-bullet briefing for a Support Agent about this user.
User ID: ${userId}
Reason: ${reason}
Last Message: "${lastMessage}"
User Prefs: ${JSON.stringify(context.userPreferences)}
History:
${context.session ? context.session.last_context : ''}

Format:
📌 Суть: ...
🔍 Контекст: ...
🔥 Проблема: ...
💡 Совет: ...
`;
            try {
                const res = await this.geminiClient.generateContent(prompt);
                return (typeof res === 'string' ? res : res?.text) || '';
            } catch (e) {
                console.warn('Briefing generation failed, using fallback');
            }
        }

        // Fallback
        return `
📌 Суть: Клиент требует внимания (${reason}).
🔍 Контекст: ${lastMessage}
🔥 Проблема: Низкий сентимент или прямой вызов.
💡 Совет: Проверьте историю диалога.
`;
    }

    // --- Helpers ---

    async sendPushToAdmin(payload) {
        try {
            console.log('🔔 PUSH TO ADMIN:', JSON.stringify(payload, null, 2));
            // In production: Web Push API / Firebase / OneSignal
             await axios.post(this.config.adminPushUrl, payload).catch(() => {}); 
        } catch (e) {
            console.error('Failed to send push:', e.message);
        }
    }

    async logDispatchEvent(userId, type, score) {
        try {
            await this.db.runQuery(
                'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
                ['warn', 'AIDispatcher', `Event: ${type}, User: ${userId}, Score: ${score}`]
            );
        } catch (e) {
            console.log(`[AIDispatcher Log] ${type}: User ${userId}, Score ${score}`);
        }
    }
}

module.exports = { AIDispatcher };
