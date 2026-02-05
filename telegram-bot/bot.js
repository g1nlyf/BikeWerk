// Telegram Bot для автоматического добавления велосипедов в каталог BikeEU
// Обрабатывает ссылки с Kleinanzeigen и добавляет велосипеды в базу данных
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
require('ts-node').register({ transpileOnly: true }); // Register ts-node with transpileOnly to ignore type errors
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

// Импортируем наши модули
const KleinanzeigenParser = require('./kleinanzeigen-parser');
const UnifiedHunter = require('./unified-hunter');
const GeminiProcessor = require('./gemini-processor');
const GroqIntegration = require('./groq-integration');
const GroqToCatalogAdapter = require('./groq-to-catalog-adapter');
const ImageHandler = require('./image-handler');
const BikesDatabase = require('./bikes-database-node');
const PostProcessor = require('./post-processor');
const { AIDispatcher } = require('../backend/src/services/aiDispatcher');
const supabaseService = require('../backend/src/services/supabase');
const { checkKleinanzeigenStatus } = require('./status-checker');
// New robust analyzer
// require('ts-node/register'); // Removed duplicate registration
const { analyzeWithLLM } = require('./llm-analyzer');
const { performAndSaveConditionAnalysis } = require('./analysis-integration');
const { geminiClient } = require('./autocat-klein/dist/autocat-klein/src/lib/geminiClient.js');
const { runTestAutocat } = require('./test-autocat');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Конфигурация
const CONFIG = {
    BOT_TOKEN: '8457657822:AAF0qWyj5SztKkUXrnAJbk2X8JV87SsC6cY',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    CATALOG_DB_PATH: path.resolve(__dirname, '../src/js/bikes-database.js'),
    IMAGES_DIR: path.resolve(__dirname, '../src/images/bikes'),
    API_PORT: process.env.API_PORT || '8082',
    EUR_RATE_URL: 'https://www.otpbank.ru/retail/currency/',
    RATE_STATE_PATH: path.resolve(__dirname, 'rate-state.json')
};

// Инициализируем модули
const parser = new KleinanzeigenParser();
const geminiProcessor = new GeminiProcessor(CONFIG.GEMINI_API_KEY, CONFIG.GEMINI_API_URL);
const groqIntegration = new GroqIntegration();
// Enable multi-key Gemini for all GeminiProcessor calls
try { geminiProcessor.setMultiKeyClient(geminiClient); } catch (_) {}
const groqAdapter = new GroqToCatalogAdapter();
const imageHandler = new ImageHandler();
const bikesDB = new BikesDatabase();
const aiDispatcher = new AIDispatcher(bikesDB, geminiClient);

const bot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: true });
const AutonomousOrchestrator = require('./AutonomousOrchestrator');
const orchestrator = new AutonomousOrchestrator(bot);

// Start Cron immediately
orchestrator.startCron().catch(e => console.error('Cron Init Error:', e));

// Command: /hunt [n]
bot.onText(/\/hunt(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const count = match[1] ? parseInt(match[1]) : 10;
    
    bot.sendMessage(chatId, `🚀 Запускаю Автономного Охотника за ${count} велосипедами...`);
    
    try {
        const added = await orchestrator.replenishCatalog(count, (logMsg) => {
            // Send important updates to chat (filter out too verbose debugs)
            if (logMsg.includes('Added') || logMsg.includes('Starting') || logMsg.includes('Error') || logMsg.includes('Cycle Complete')) {
                 // Translate common log messages if possible, or send as is
                 let ruMsg = logMsg;
                 if (logMsg.includes('Added')) ruMsg = logMsg.replace('Added', 'Добавлен').replace('bikes', 'велосипедов');
                 if (logMsg.includes('Cycle Complete')) ruMsg = '✅ Цикл завершен';
                 bot.sendMessage(chatId, ruMsg);
            }
        });
        
        bot.sendMessage(chatId, `✅ Охота завершена. Всего добавлено: ${added}`);
    } catch (e) {
        bot.sendMessage(chatId, `❌ Ошибка Охотника: ${e.message}`);
    }
});

// --- Euphoria Pipeline: CRM God Mode ---

// Manager IDs (Allowed to use CRM commands)
const ADMIN_IDS = [
    process.env.ADMIN_CHAT_ID, 
    '183921355', 
    '632483838'
].filter(Boolean);

function isManager(chatId) {
    return ADMIN_IDS.includes(String(chatId)) || ADMIN_IDS.includes(Number(chatId));
}

// Command: /order [code]
bot.onText(/\/order\s+(\w+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isManager(chatId)) return; // Strict check enabled for role separation

    const orderCode = match[1];
    bot.sendMessage(chatId, `🔍 Ищу заказ #${orderCode} в Supabase CRM...`);

    const order = await supabaseService.getOrder(orderCode);
    
    if (!order) {
        return bot.sendMessage(chatId, `❌ Заказ #${orderCode} не найден.`);
    }

    const customer = order.customers || {};
    const events = order.timeline_events || [];
    const lastEvent = events.length > 0 ? events[events.length - 1] : { title: 'Нет событий' };

    const message = `
📦 **ЗАКАЗ #${order.order_code}**
━━━━━━━━━━━━━━━━
👤 **Клиент:** ${customer.full_name || 'Не указан'}
📧 ${customer.email || '-'}
📱 ${customer.phone || '-'}
🔗 [Telegram](tg://user?id=${customer.telegram_id})

🚲 **Байк ID:** ${order.bike_id}
💰 **Сумма:** €${order.total_amount}
📊 **Статус:** ${order.status.toUpperCase()}

🔗 **Трекер для клиента:**
https://bikeflip.ru/track/${order.magic_link_token}

📅 **Последнее событие:**
${lastEvent.date ? new Date(lastEvent.date).toLocaleString('ru-RU') : ''}
📌 *${lastEvent.title}*
${lastEvent.description || ''}

📝 **Заметки менеджера:**
${order.manager_notes || 'Нет заметок'}
    `;

    const opts = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📞 Связался', callback_data: `crm_status_${order.order_code}_negotiation` },
                    { text: '📸 Фото', callback_data: `crm_status_${order.order_code}_inspection` }
                ],
                [
                    { text: '💳 Оплачено', callback_data: `crm_status_${order.order_code}_payment` },
                    { text: '🚚 Отправлено', callback_data: `crm_status_${order.order_code}_logistics` }
                ],
                [
                    { text: '📎 Прикрепить фото', callback_data: `crm_attach_${order.order_code}` },
                    { text: '📝 AI Отчет', callback_data: `crm_report_${order.order_code}` }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, message, opts);
});

// Handle Callbacks
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;

    if (data.startsWith('crm_report_')) {
        const orderCode = data.split('_')[2];
        bot.answerCallbackQuery(callbackQuery.id, { text: '🤖 Генерирую отчет...' });
        bot.sendMessage(chatId, `⏳ Gemini анализирует хронологию заказа #${orderCode}...`);
        
        const order = await supabaseService.getOrder(orderCode);
        const report = await geminiProcessor.generateReport(order);
        
        bot.sendMessage(chatId, `📝 **Черновик сообщения клиенту:**\n\n${report}\n\n_Нажмите "Forward" чтобы отправить клиенту._`, { parse_mode: 'Markdown' });

    } else if (data.startsWith('crm_status_')) {
        const parts = data.split('_');
        const orderCode = parts[2];
        const newStatus = parts[3];
        
        // Define standard events for statuses
        const statusEvents = {
            'negotiation': { title: 'Переговоры начаты', description: 'Менеджер связался с продавцом.' },
            'inspection': { title: 'Инспекция', description: 'Получены дополнительные фото и видео.' },
            'payment': { title: 'Оплата получена', description: 'Средства поступили на счет.' },
            'logistics': { title: 'Логистика', description: 'Велосипед передан в транспортную компанию.' }
        };

        const event = statusEvents[newStatus] || { title: 'Статус обновлен', description: `Новый статус: ${newStatus}` };
        event.status = newStatus;

        await supabaseService.addTimelineEvent(orderCode, event);
        
        bot.answerCallbackQuery(callbackQuery.id, { text: `✅ Статус обновлен на ${newStatus}` });
        bot.sendMessage(chatId, `✅ Заказ #${orderCode}: Статус изменен на ${newStatus}`);
    } else if (data.startsWith('crm_attach_')) {
        const orderCode = data.split('_')[2];
        bot.sendMessage(chatId, `📸 Отправьте фото для заказа #${orderCode} (как обычное изображение). В подписи (caption) укажите описание, если нужно. \n\n⚠️ **Важно:** Ответьте на это сообщение (Reply), чтобы я понял, к какому заказу прикрепить.`);
    }
});

// Handle Photos (Reply logic)
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const photo = msg.photo[msg.photo.length - 1]; // Get highest resolution
    
    // Check if it's a reply to a "Send photo" prompt
    if (msg.reply_to_message && msg.reply_to_message.text && msg.reply_to_message.text.includes('Отправьте фото для заказа #')) {
        const match = msg.reply_to_message.text.match(/#(\w+)/);
        if (match) {
            const orderCode = match[1];
            bot.sendMessage(chatId, `⏳ Загружаю фото для заказа #${orderCode}...`);

            try {
                const fileLink = await bot.getFileLink(photo.file_id);
                const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);
                
                const fileName = `telegram_${photo.file_id}.jpg`;
                const publicUrl = await supabaseService.uploadInspectionPhoto(orderCode, buffer, fileName);

                if (publicUrl) {
                    await supabaseService.addTimelineEvent(orderCode, {
                        title: 'Фото инспекции',
                        description: msg.caption || 'Фото загружено через Telegram Bot',
                        photoUrl: publicUrl
                    });
                    bot.sendMessage(chatId, `✅ Фото сохранено в CRM! \n🔗 ${publicUrl}`);
                } else {
                    bot.sendMessage(chatId, `❌ Ошибка сохранения в Supabase.`);
                }
            } catch (e) {
                console.error(e);
                bot.sendMessage(chatId, `❌ Ошибка загрузки: ${e.message}`);
            }
        }
    }
});


const crypto = require('crypto');

// --- Admin TMA API Endpoints ---

// Middleware: Validate Telegram InitData
const validateTelegramAuth = (req, res, next) => {
    // In dev mode or if explicitly disabled, skip validation
    if (process.env.NODE_ENV === 'development' && !process.env.ADMIN_CHAT_ID) {
        return next();
    }

    const initData = req.headers['x-telegram-init-data'];
    if (!initData) {
        return res.status(401).json({ error: 'Missing initData' });
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    // Sort keys
    const dataCheckString = Array.from(urlParams.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, val]) => `${key}=${val}`)
        .join('\n');
        
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(CONFIG.BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    if (calculatedHash !== hash) {
        return res.status(403).json({ error: 'Invalid hash' });
    }
    
    // Check if user is admin
    const user = JSON.parse(urlParams.get('user') || '{}');
    if (String(user.id) !== process.env.ADMIN_CHAT_ID) {
        return res.status(403).json({ error: 'Unauthorized user' });
    }
    
    next();
};

// GET /api/admin/stats
bot.onText(/\/admin_stats/, async (msg) => {
    // Legacy text command
});

// Express Routes for TMA (Mounted on internal API_PORT)
// Since we don't have a separate Express app variable exposed easily in this file structure 
// (it might be in a different file or just not here), we need to see where the API is served.
// Looking at previous context, `server.js` is the main backend. 
// `bot.js` runs the bot logic.
// If TMA frontend calls `/api/admin/...`, it goes to `server.js`.
// So we should put these routes in `server.js` (Backend) or `bot.js` if it runs an HTTP server.
// `bot.js` does NOT seem to run `app.listen`.
// BUT `backend/server.js` DOES.
// So I will move this logic to `backend/server.js` and ensure it can talk to the bot components if needed.
// Wait, the user prompt said: "Backend (API): Создание защищенных эндпоинтов".
// I will revert this change in `bot.js` and apply it to `backend/server.js`.
// I'll just add a comment here for now.

function resolveLocalImagePath(webUrl) {
    try {
        if (typeof webUrl !== 'string') return webUrl;
        if (!webUrl.startsWith('/images/')) return webUrl; // не наш формат — возвращаем как есть
        const relative = webUrl.replace(/^\/?images\//, '');
        const localPath = path.resolve(__dirname, '../backend/public/images', relative);
        console.log(`🧩 Конвертация веб-URL в локальный путь: ${webUrl} → ${localPath}`);
        return localPath;
    } catch (e) {
        console.error('❌ Ошибка конвертации веб-URL в локальный путь:', e.message);
        return webUrl;
    }
}

// Хелперы свободной эвристики по HTML, без строгих шаблонов
function normalizeText(...parts) {
    return parts.filter(Boolean).join(' \n ').toLowerCase();
}

function detectNegotiable(text) {
    return /(\bvb\b|verhandlungsbasis|verhandelbar|торг)/i.test(text);
}

function detectDelivery(text) {
    if (/nur\s+abholung|nur\s+selbstabholung|только\s+самовывоз/i.test(text)) return 'pickup-only';
    if (/versand\s+möglich|versand|доставка\s+возможна|shipping/i.test(text)) return 'available';
    return 'unknown';
}

function detectFrameSize(text) {
    const mEnum = text.match(/\b(xs|s|m|l|xl|xxl)(\/[xsml]+)?\b/i);
    if (mEnum) return mEnum[0].toUpperCase();
    const mCm = text.match(/(\d{2,3})\s*(cm|см)/i);
    if (mCm) return `${mCm[1]} cm`;
    const mIn = text.match(/(\d{2})\s*"|\b(\d{2})\s*(in|inch)\b/i);
    if (mIn) return `${mIn[1] || mIn[2]}"`;
    const mLabel = text.match(/rahmengr(ö|o)ße\s*[:\-]?\s*([a-z\/\d\s"']+)/i);
    if (mLabel) return mLabel[2].trim();
    return null;
}

function detectWheelDiameter(text) {
    const mIn = text.match(/\b(20|24|26|27\.5|27,5|28|29)\s*"\b/ig);
    if (mIn && mIn[0]) return mIn[0].replace(/\s+/g, '');
    const mC = text.match(/\b(650b|700c)\b/i);
    if (mC) return mC[0].toLowerCase();
    const mWords = text.match(/\b(20|24|26|27\.5|27,5|28|29)\b\s*(дюйм|zoll|inch|in)\b/i);
    if (mWords) return `${mWords[1]}"`;
    return null;
}

function detectYear(text) {
    const years = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m => parseInt(m[1], 10));
    const plausible = years.find(y => y >= 1990 && y <= 2035);
    return plausible || null;
}

function detectDiscipline(text) {
    if (/downhill|dh|даунхилл/i.test(text)) return 'DH';
    if (/enduro|эндуро/i.test(text)) return 'Enduro';
    if (/trail|all\s*mountain/i.test(text)) return 'Trail';
    if (/xc|cross\s*country/i.test(text)) return 'XC';
    if (/gravel|гравий/i.test(text)) return 'Gravel';
    if (/road|шоссеи|rennrad/i.test(text)) return 'Road';
    return null;
}

function htmlFallbackEnhance(rawBikeData, processed) {
    const textAll = normalizeText(rawBikeData.title, rawBikeData.description, rawBikeData.rawHtmlContent);
    const brand = processed.brand || rawBikeData.brand || null;
    const model = processed.model || rawBikeData.model || null;
    const price = typeof processed.price === 'number' && processed.price > 0 ? processed.price : (rawBikeData.price || 0);
    const frameSize = processed.frameSize || detectFrameSize(textAll) || rawBikeData.frameSize || null;
    const year = processed.year || detectYear(textAll) || rawBikeData.year || null;
    const wheelDiameter = processed.wheelDiameter || detectWheelDiameter(textAll) || rawBikeData.wheelDiameter || null;
    const isNegotiable = typeof processed.isNegotiable === 'boolean' ? processed.isNegotiable : detectNegotiable(textAll);
    const deliveryOption = processed.deliveryOption || detectDelivery(textAll);
    const discipline = processed.discipline || detectDiscipline(textAll);
    const location = processed.location || rawBikeData.location || '';
    const description = processed.description || rawBikeData.description || '';
    return {
        ...processed,
        brand,
        model,
        price,
        frameSize,
        year,
        wheelDiameter,
        isNegotiable,
        deliveryOption,
        discipline,
        location,
        description
    };
}

async function readRateState() {
    try {
        const txt = await fs.readFile(CONFIG.RATE_STATE_PATH, 'utf-8');
        return JSON.parse(txt);
    } catch (_) {
        return null;
    }
}

async function writeRateState(state) {
    try {
        await fs.writeFile(CONFIG.RATE_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (_) {}
}

async function updateEurRateSilent(url) {
    try {
        const vis = await checkKleinanzeigenStatus(url, { headless: true, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000 });
        let slices = Array.isArray(vis.slices) ? vis.slices : [];
        if (slices.length === 0 && vis.telegramPhotoPath) {
            slices = [vis.telegramPhotoPath];
        }
        const result = await geminiProcessor.extractEurSellRateFromImages(slices);
        const rate = Number(result && result.eur_sell_rate);
        if (!Number.isFinite(rate) || rate <= 0) return false;
        const resp = await axios.post(`http://localhost:${CONFIG.API_PORT}/api/rates/eur`, { value: rate, source: 'otpbank' }, { timeout: 8000 }).catch(() => null);
        if (!resp || !resp.data || !resp.data.success) return false;
        const today = new Date().toDateString();
        await writeRateState({ last_day: today, last_value: rate, updated_at: new Date().toISOString() });
        return true;
    } catch (_) {
        return false;
    }
}

async function ensureDailyRateUpdate() {
    const st = await readRateState();
    const today = new Date().toDateString();
    if (!st || st.last_day !== today) {
        await updateEurRateSilent(CONFIG.EUR_RATE_URL);
    }
}

// Система очередей для обработки множественных ссылок
class ProcessingQueue {
    constructor() {
        this.queues = new Map(); // chatId -> queue
        this.processing = new Map(); // chatId -> boolean
        this.discountInfo = new Map(); // chatId -> discountInfo
    }

    addLinks(chatId, links, discountInfo = null) {
        if (!this.queues.has(chatId)) {
            this.queues.set(chatId, []);
        }
        this.queues.get(chatId).push(...links);
        
        // Сохраняем информацию о скидке для этого чата
        if (discountInfo) {
            this.discountInfo.set(chatId, discountInfo);
        }
        
        // Запускаем обработку если она не идет
        if (!this.processing.get(chatId)) {
            this.processQueue(chatId);
        }
    }

    async processQueue(chatId) {
        this.processing.set(chatId, true);
        const queue = this.queues.get(chatId) || [];
        const discountInfo = this.discountInfo.get(chatId) || null;
        const total = queue.length;
        let processed = 0;
        if (total > 0) {
            await bot.sendMessage(chatId, `📋 Обнаружено ссылок — ${total}.`);
        }
        while (queue.length > 0) {
            const link = queue.shift();
            processed += 1;
            try {
                await bot.sendMessage(chatId, `🚀 Приступаю к обработке ${processed}/${total}`);
                await handleKleinanzeigenLink(chatId, link, queue.length + 1, discountInfo, { current: processed, total });
                if (queue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                console.error(`❌ Ошибка обработки ссылки ${link}:`, error.message);
                await bot.sendMessage(chatId, `❌ Ошибка обработки ссылки:\n${link}\n\nОшибка: ${error.message}`);
            }
        }

        this.processing.set(chatId, false);
        
        // Очищаем пустую очередь и информацию о скидке
        if (queue.length === 0) {
            this.queues.delete(chatId);
            this.discountInfo.delete(chatId);
        }
    }

    getQueueStatus(chatId) {
        const queue = this.queues.get(chatId) || [];
        const isProcessing = this.processing.get(chatId) || false;
        return {
            remaining: queue.length,
            isProcessing
        };
    }
}

const processingQueue = new ProcessingQueue();
let stopRequested = false;

const pendingConditionResolvers = new Map();


// Components already initialized above

// Обработчик текстовых сообщений (AI Support)
bot.on('message', async (msg) => {
    // Игнорируем команды, они обрабатываются onText
    if (!msg.text || msg.text.startsWith('/')) return;

    // Проверяем наличие ссылок
    const links = extractKleinanzeigenLinks(msg.text);
    if (links.length > 0) {
        const chatId = msg.chat.id;
        const discountInfo = extractDiscountPercentage(msg.text);
        
        if (links.length === 1) {
            await handleKleinanzeigenLink(chatId, links[0], 0, discountInfo);
        } else {
            await handleMultipleLinks(chatId, links, discountInfo);
        }
        return;
    }

    // AI Support Logic (Brain)
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userMessage = msg.text;

    try {
        await bot.sendChatAction(chatId, 'typing');
        
        // Delegate to Brain
        const result = await aiDispatcher.handleUserMessage(userId, userMessage);
        
        await bot.sendMessage(chatId, result.text, result.options);

    } catch (error) {
        console.error('AI Support Error:', error);
    }
});

// Обработчик callback_query (для кнопок)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'call_human') {
        await bot.answerCallbackQuery(query.id, { text: 'Вызываю оператора...' });
        await bot.sendMessage(chatId, '👨‍💻 Оператор уведомлен и подключится к диалогу в ближайшее время.');
        
        try {
             await aiDispatcher.notifyHumanNeeded(query.from.id, null);
        } catch (e) {
            console.error('Failed to notify admin on human call:', e);
        }
    }
});

console.log('🤖 Telegram бот запущен!');
console.log(`📁 Путь к базе данных: ${bikesDB.dbPath}`);
console.log(`🖼️ Директория изображений: ${imageHandler.imageDir}`);
ensureDailyRateUpdate().catch(() => {});
setInterval(() => { ensureDailyRateUpdate().catch(() => {}); }, 60 * 60 * 1000);

// Обработчик команды /test_llm для проверки нового клиента
bot.onText(/\/test_llm/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, '🧪 Начинаю тест LLM клиента (v2.0-flash-exp)...');

    try {
        // 1. Simple Request
        await bot.sendMessage(chatId, '1️⃣ Проверка одиночного запроса...');
        const start = Date.now();
        const response = await geminiClient.generateContent("Привет! Это тест интеграции. Ответь коротко: 'Система работает'.");
        const duration = Date.now() - start;
        
        await bot.sendMessage(chatId, `✅ Ответ (${duration}ms):\n${response.text}`);

        // 2. Burst Request (Rate Limit)
        await bot.sendMessage(chatId, '2️⃣ Проверка очереди (5 запросов подряд)...');
        const promises = [];
        for (let i = 1; i <= 5; i++) {
            promises.push(geminiClient.generateContent(`Запрос ${i}. Ответь только числом ${i}.`));
        }
        
        const burstStart = Date.now();
        const results = await Promise.all(promises);
        const burstDuration = Date.now() - burstStart;
        
        const answers = results.map(r => r.text).join(', ');
        await bot.sendMessage(chatId, `✅ Все 5 запросов выполнены за ${burstDuration}ms.\nОтветы: ${answers}`);

        await bot.sendMessage(chatId, 'ℹ️ Тест завершен. Клиент успешно обрабатывает запросы и rate limits.');

    } catch (error) {
        console.error('LLM Test Error:', error);
        await bot.sendMessage(chatId, `❌ Ошибка теста: ${error.message}`);
    }
});

 

// Обработчик команды /start
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const payload = match[1] ? match[1].trim() : null;

    if (payload) {
        try {
            await bot.sendMessage(chatId, '🔄 Подключаю отслеживание заказа...');
            const resp = await axios.post(`http://localhost:${CONFIG.API_PORT}/api/tg/subscribe`, {
                chat_id: String(chatId),
                payload: payload
            }, { timeout: 5000 });
            if (resp.data && resp.data.success) {
                 await bot.sendMessage(chatId, '✅ Вы успешно подписались на уведомления о заказе!');
                 return;
            } else {
                 await bot.sendMessage(chatId, '⚠️ Не удалось подписаться. Возможно, ссылка устарела.');
            }
        } catch (e) {
             console.error('Subscribe error:', e.message);
             // Fallback to consume-link if subscribe endpoint fails or logic differs
             try {
                 const resp = await axios.post(`http://localhost:${CONFIG.API_PORT}/api/tg/consume-link`, { payload }, { timeout: 5000 });
                 if (resp.data && resp.data.success) {
                     const { order_id } = resp.data;
                     await axios.post(`http://localhost:${CONFIG.API_PORT}/api/tg/subscribe`, { chat_id: String(chatId), order_id }, { timeout: 5000 });
                     await bot.sendMessage(chatId, `✅ Вы успешно подписались на уведомления о заказе ${order_id}!`);
                     return;
                 }
             } catch (e2) {
                 await bot.sendMessage(chatId, '❌ Ошибка при подключении отслеживания.');
             }
        }
    }

    const welcomeMessage = `
🚴‍♂️ Добро пожаловать в EUBike Bot!

Отправьте мне ссылку на велосипед с Kleinanzeigen, и я автоматически добавлю его в каталог.

✨ Новые возможности:
• 🔍 Распознавание ссылок в тексте
• 📋 Обработка нескольких ссылок одновременно
• ⏱️ Умная очередь с защитой от перегрузки API

Поддерживаемые ссылки:
• https://www.kleinanzeigen.de/s-anzeige/...

📋 Список всех команд:
• /help - Помощь и инструкции
• /stats - Статистика бота и БД
• /queue - Статус очереди обработки
• /check [ссылка] - Проверка объявления (скрин + инфо)
• /discheck [число] - Массовая проверка и исправление дисциплин (AI)
• /groq [ссылка] - Тест парсинга через Groq (без сохр.)
• /groq_card [ссылка] - Создать карточку через Groq
• /gemini [ссылка] - Создать карточку через Gemini
• /test [текст] - Тест распознавания ссылок
• /test_llm - Тест LLM клиента
• /delete [ID] - Удалить велосипед по ID
• /cleanup - Очистка старых изображений
• /cleanall - Полная очистка базы данных
    `;
    
    bot.sendMessage(chatId, welcomeMessage);
});

// Обработчик команды /admin - открытие TMA
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    if (String(chatId) === process.env.ADMIN_CHAT_ID) {
        bot.sendMessage(chatId, "🚀 *EUBike Admin Panel*", {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: "Open Admin Overlay", web_app: { url: 'https://t.me/EUBikeAdminBot/app' } }
                ]]
            }
        });
    } else {
        bot.sendMessage(chatId, "⛔️ Access Denied");
    }
});

// Обработчик команды /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
📖 Помощь по использованию бота:

🤖 *AI Обработка:*
• По умолчанию используется Groq AI (быстрый и точный)
• Для Gemini AI используйте команду /gemini

🔍 *Распознавание ссылок:*
• Просто отправьте ссылку на велосипед - бот создаст карточку
• Поддерживается любой текст, содержащий ссылки
• Автоматическое создание карточек в каталоге

💰 *Поддержка скидок:*
• Добавьте процент скидки после ссылки: "20%"
• Скидка будет применена к цене велосипеда

📋 *Множественная обработка:*
• Отправьте несколько ссылок в одном сообщении
• Обработка по очереди с интервалом 3 сек (Groq) / 2 сек (Gemini)

🔗 *Примеры использования:*
\`\`\`
https://www.kleinanzeigen.de/s-anzeige/... 20%

/gemini https://www.kleinanzeigen.de/s-anzeige/...

Несколько ссылок:
https://www.kleinanzeigen.de/s-anzeige/bike1/...
https://www.kleinanzeigen.de/s-anzeige/bike2/...
\`\`\`

    🛠️ *Специальные команды:*
    • /groq [ссылка] - отладочный режим (без создания карточки)
    • /groq_card [ссылка] - принудительное создание карточки через Groq
    • /test [текст] - тестовая обработка без записи, показывает вставку и отображение
    • /gemini [ссылка] - обработка через Gemini AI
    • /check [ссылка] - проверка объявления (скриншот + верификация), удаление неактивных
    • /stats - статистика бота и базы данных
    • /queue - проверка статуса очереди обработки
    • /delete [ID] - удаление велосипеда по ID (например: /delete 51)
    • /cleanup - очистка старых изображений
• /cleanall - очистка базы данных (с выбором)

⚠️ Поддерживаются только ссылки с kleinanzeigen.de

🤖 Статус API:
• Groq AI: ✅ Подключен
• Gemini API: ${CONFIG.GEMINI_API_KEY ? '✅ Подключен' : '❌ Не настроен'}
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Обработчик команды /groq - парсинг через Groq AI
bot.onText(/\/groq (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    // Проверяем, что это ссылка на Kleinanzeigen
    if (!url.includes('kleinanzeigen.de')) {
        bot.sendMessage(chatId, '❌ Пожалуйста, отправьте ссылку на объявление с kleinanzeigen.de');
        return;
    }
    
    try {
        // Отправляем сообщение о начале обработки
        const processingMsg = await bot.sendMessage(chatId, '🤖 Обрабатываю объявление с помощью Groq AI...');
        
        // Парсим URL с помощью Groq
        const result = await groqIntegration.parseUrl(url);
        
        // Удаляем сообщение о обработке
        await bot.deleteMessage(chatId, processingMsg.message_id);
        
        if (result.success) {
            // РЕЖИМ ОТЛАДКИ: Показываем сырые данные от Groq
            await bot.sendMessage(chatId, '🔍 *РЕЖИМ ОТЛАДКИ - Ответ от Groq AI:*', { parse_mode: 'Markdown' });
            
            // Форматируем JSON для читаемости
            const debugData = {
                title: result.title,
                brand: result.brand,
                model: result.model,
                price: result.price,
                condition: result.condition,
                frameSize: result.frameSize,
                wheelDiameter: result.wheelDiameter,
                year: result.year,
                location: result.location,
                description: result.description,
                category: result.category,
                isNegotiable: result.isNegotiable,
                deliveryOption: result.deliveryOption,
                specifications: result.specifications,
                seller: result.seller,
                url: result.url
            };
            
            // Отправляем сырые данные
            await bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(debugData, null, 2)}\`\`\``, { 
                parse_mode: 'Markdown' 
            });
            
            // Также показываем форматированную версию
            const formattedMessage = groqIntegration.formatBikeData(result);
            await bot.sendMessage(chatId, '📋 *Форматированный вид:*\n\n' + formattedMessage, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            });

            // Информируем о том, что это отладочный режим
            await bot.sendMessage(chatId, '💡 *Это отладочный режим.* Для создания карточки в каталоге просто отправьте ссылку без команды или используйте `/groq_card`', {
                parse_mode: 'Markdown'
            });
            
        } else {
            await bot.sendMessage(chatId, `❌ Ошибка при парсинге: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Ошибка в команде /groq:', error);
        await bot.sendMessage(chatId, `❌ Произошла ошибка: ${error.message}`);
    }
});

// Команда /gemini для использования Gemini AI
bot.onText(/\/gemini (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageText = match[1].trim();
    
    const links = extractUrlsFromText(messageText);
    const discountInfo = extractDiscountPercentage(messageText);
    
    if (links.length === 0) {
        return bot.sendMessage(chatId, '❌ Пожалуйста, отправьте корректную ссылку после команды /gemini.');
    }
    
    if (discountInfo) {
        await bot.sendMessage(chatId, `🎯 Обнаружена скидка ${discountInfo.originalPercentage}%!\n💰 Применяю случайную скидку ${discountInfo.appliedDiscount}% (±5% от указанной)`);
    }
    
    if (links.length === 1) {
        await handleKleinanzeigenLink(chatId, links[0], 0, discountInfo, { current: 1, total: 1 });
    } else {
        await handleMultipleLinks(chatId, links, discountInfo);
    }
});

// Алиас /geimini для того же полного процесса Gemini
bot.onText(/\/geimini (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageText = match[1].trim();
    const links = extractUrlsFromText(messageText);
    const discountInfo = extractDiscountPercentage(messageText);
    if (links.length === 0) {
        return bot.sendMessage(chatId, '❌ Пожалуйста, отправьте корректную ссылку после команды /geimini.');
    }
    if (discountInfo) {
        await bot.sendMessage(chatId, `🎯 Обнаружена скидка ${discountInfo.originalPercentage}%!\n💰 Применяю случайную скидку ${discountInfo.appliedDiscount}% (±5% от указанной)`);
    }
    if (links.length === 1) {
        await handleKleinanzeigenLink(chatId, links[0], 0, discountInfo);
    } else {
        await handleMultipleLinks(chatId, links, discountInfo);
    }
});

// Команда /discheck — массовая проверка и исправление дисциплин
bot.onText(/\/discheck (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageText = match[1].trim();
    const count = parseInt(messageText);

    if (isNaN(count) || count <= 0) {
        return bot.sendMessage(chatId, '❌ Использование: /discheck [количество]\nПример: /discheck 50\n\nКоманда проверит указанное количество последних велосипедов (начиная с тех, что давно не проверялись) и исправит их дисциплины с помощью AI.\n\nЭто полезно для исправления "пустых" категорий в каталоге.');
    }

    const BATCH_SIZE = 20; // Максимум 25, берем 20 для надежности
    const batches = [];
    
    try {
        await bot.sendMessage(chatId, `🔎 Получаю ${count} велосипедов для проверки дисциплин...`);
        
        // 1. Получаем велосипеды (давно не проверенные)
        const bikes = await bikesDB.getLeastRecentlyCheckedBikes(count);
        
        if (!bikes.length) {
            return bot.sendMessage(chatId, 'ℹ️ Нет велосипедов для проверки.');
        }

        await bot.sendMessage(chatId, `🚀 Найдено ${bikes.length} велосипедов. Формирую запросы к Gemini...`);

        // 2. Разбиваем на батчи
        for (let i = 0; i < bikes.length; i += BATCH_SIZE) {
            batches.push(bikes.slice(i, i + BATCH_SIZE));
        }

        const resultsLog = [];
        
        for (let index = 0; index < batches.length; index++) {
            const batch = batches[index];
            if (stopRequested) {
                await bot.sendMessage(chatId, '🛑 Проверка дисциплин прервана.');
                break;
            }

            // Only notify every 5th batch to reduce noise, or for the first one
            if (index === 0 || (index + 1) % 5 === 0) {
                await bot.sendMessage(chatId, `⏳ Обрабатываю батч ${index + 1}/${batches.length}...`);
            }
            
            try {
                // Формируем промпт
                const bikesList = batch.map(b => `${b.id} ${b.brand} ${b.model}`).join('\n');
                const prompt = `
You are a precise bicycle discipline classifier for a catalog.
Your task is to determine the strict discipline for each bike based on its Brand and Model.

**Classification Rules:**
1. **Main Category** must be one of: Road, Gravel, MTB, eMTB, Kids.
2. **Subcategory** is CRITICAL. You MUST provide a specific subcategory.
   - **MTB**: Enduro, DH, Trail, XC
   - **Road**: Aero, Climbing, Endurance, TT
   - **Gravel**: Race, Allroad, Bikepacking
   - **eMTB**: eMTB (Only one option allowed!)
   - **Kids**: Balance, 14", 16", 20", 24"
3. **Strict Output Values** (Use EXACTLY these strings for Category and Subcategory):
   - MTB Enduro
   - MTB DH
   - MTB Trail
   - MTB XC
   - ROAD Aero (Note: ROAD is all caps)
   - ROAD Endurance
   - ROAD Climbing
   - ROAD TT
   - GRAVEL Race (Note: GRAVEL is all caps)
   - GRAVEL Allroad
   - GRAVEL Bikepacking
   - eMTB eMTB
   - Kids Balance, Kids 14", Kids 16", Kids 20", Kids 24"
4. If the subcategory is absolutely unclear, use "MTB Trail" for MTB, "ROAD Endurance" for Road, "GRAVEL Allroad" for Gravel.
5. **Output Format** must be STRICTLY (one per line):
   id Category Subcategory
6. **NO** other text, no markdown, no headers, no explanations.

**Input:**
${bikesList}
`;
                // Отправляем запрос (пробуем Gemini, затем Groq)
                let responseText;
                try {
                    responseText = await geminiClient.generateContent(prompt);
                } catch (geminiErr) {
                    console.log(`⚠️ Gemini failed (${geminiErr.message}), trying Groq...`);
                    try {
                        const completion = await groq.chat.completions.create({
                            messages: [{ role: 'user', content: prompt }],
                            model: 'llama-3.3-70b-versatile',
                        });
                        responseText = completion.choices[0]?.message?.content || "";
                    } catch (groqErr) {
                        throw new Error(`All models failed. Gemini: ${geminiErr.message}. Groq: ${groqErr.message}`);
                    }
                }
                
                console.log('Gemini Raw Response:', responseText); // LOGGING

                let parsedItems = [];

                // 1. Пытаемся распарсить как JSON (Gemini иногда любит возвращать JSON вопреки инструкциям)
                try {
                    // Очищаем от markdown ```json ... ```
                    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                    // Ищем начало массива или объекта
                    const jsonStart = cleanJson.indexOf('[');
                    const jsonEnd = cleanJson.lastIndexOf(']');
                    
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        const jsonStr = cleanJson.substring(jsonStart, jsonEnd + 1);
                        const json = JSON.parse(jsonStr);
                        if (Array.isArray(json)) {
                            parsedItems = json.map(item => ({
                                id: parseInt(item.id || item.ID),
                                category: item.Category || item.category,
                                subCategory: item.Subcategory || item.subcategory || item.subCategory
                            }));
                        }
                    }
                } catch (e) {
                    console.log('JSON parsing failed, trying text parsing...');
                }

                // 2. Если JSON не сработал или пуст, парсим построчно
                if (parsedItems.length === 0) {
                    const lines = responseText.split('\n').map(l => l.trim()).filter(l => l);
                    
                    for (const line of lines) {
                        // Очищаем от маркдауна в начале строки
                        const cleanLine = line.replace(/^[\*\-\s]+/, '');
                        
                        // Игнорируем явные части JSON
                        if (cleanLine.match(/^[[{\]}]/)) continue;
                        if (cleanLine.match(/"id":/)) continue;

                        // Регулярка: (id)?(\d+) (Category) (Subcategory)
                        const match = cleanLine.match(/^(?:id)?(\d+)\s+(\S+)\s+(.+)$/i);
                        
                        if (match) {
                            parsedItems.push({
                                id: parseInt(match[1]),
                                category: match[2],
                                subCategory: match[3].trim()
                            });
                        } else {
                             // Логируем только если это похоже на строку с данными, а не мусор
                             if (/\d+/.test(cleanLine) && cleanLine.length < 100) {
                                 resultsLog.push(`⚠️ Не удалось разобрать строку: "${cleanLine}"`);
                             }
                        }
                    }
                }

                // 3. Обрабатываем результаты
                if (parsedItems.length === 0 && resultsLog.length === 0) {
                     resultsLog.push(`⚠️ Gemini вернул ответ, но ни одной строки не распознано:\n${responseText}`);
                }

                for (const item of parsedItems) {
                    const { id, category, subCategory } = item;
                    
                    if (!id || !category || !subCategory) {
                        resultsLog.push(`⚠️ Неполные данные для ID ${id || '?'}: ${JSON.stringify(item)}`);
                        continue;
                    }

                    const discipline = `${category} ${subCategory}`;
                    
                    // Находим байк в батче
                    const bike = batch.find(b => b.id === id);
                    if (bike) {
                        const oldDiscipline = bike.discipline || 'Не указано';
                        
                        // FIX: Убираем дублирование категории, если она уже есть в подкатегории
                        // Например, если Gemini вернул Category="GRAVEL", Subcategory="GRAVEL Race" -> результат "GRAVEL Race"
                        // Если Category="MTB", Subcategory="Enduro" -> результат "MTB Enduro"
                        let finalDiscipline = discipline;
                        if (subCategory.toLowerCase().startsWith(category.toLowerCase())) {
                            finalDiscipline = subCategory; // Используем подкатегорию как полную строку, если она уже содержит категорию
                        } else {
                            finalDiscipline = `${category} ${subCategory}`; // Иначе склеиваем
                        }

                        // Дополнительная защита от дублей (на всякий случай)
                        // "GRAVEL GRAVEL Race" -> "GRAVEL Race"
                        const parts = finalDiscipline.split(/\s+/);
                        if (parts.length >= 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
                            parts.shift();
                            finalDiscipline = parts.join(' ');
                        }

                        // Сравниваем (нормализуем для сравнения)
                        const normalize = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
                        const isDifferent = normalize(oldDiscipline) !== normalize(finalDiscipline);
                        
                        // Map Gemini category to DB category
                        const categoryMap = {
                            'Road': 'Шоссейный',
                            'Gravel': 'Гравийный',
                            'MTB': 'Горный',
                            'eMTB': 'Электро',
                            'Kids': 'Детский'
                        };
                        const newCategory = categoryMap[category] || bike.category;
                        const isCategoryDifferent = newCategory !== bike.category;

                        if (isDifferent || isCategoryDifferent) {
                            // Обновляем в БД
                            await bikesDB.updateBike(id, { 
                                discipline: finalDiscipline,
                                category: newCategory 
                            });
                            const changeLog = [];
                            if (isDifferent) changeLog.push(`Disc: ${oldDiscipline} -> ${finalDiscipline}`);
                            if (isCategoryDifferent) changeLog.push(`Cat: ${bike.category} -> ${newCategory}`);
                            
                            resultsLog.push(`id${id} - [✓] ${changeLog.join(', ')}`);
                        } else {
                            resultsLog.push(`id${id} - ${finalDiscipline} [✗] (Нет изменений)`);
                        }
                        // Отмечаем, что проверили
                        await bikesDB.markBikeChecked(id);
                    } else {
                         resultsLog.push(`⚠️ ID ${id} не найден в текущем батче`);
                    }
                }
            } catch (e) {
                console.error(`Batch ${index + 1} error:`, e);
                // Логируем ошибку для всего батча
                batch.forEach(b => resultsLog.push(`id${b.id} - Ошибка обработки: ${e.message} [!]`));
                await bot.sendMessage(chatId, `❌ Ошибка в батче ${index+1}: ${e.message}`);
            }

            // Delay between batches to respect rate limits
            if (index < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Отправляем отчет
        // Разбиваем отчет на части, если он слишком длинный
        const fullReport = resultsLog.join('\n');
        if (fullReport.length > 4000) {
            const chunks = [];
            for (let i = 0; i < fullReport.length; i += 4000) {
                chunks.push(fullReport.substring(i, i + 4000));
            }
            for (const chunk of chunks) {
                await bot.sendMessage(chatId, `📋 Результаты проверки дисциплин:\n${chunk}`);
            }
        } else {
            await bot.sendMessage(chatId, `📋 Результаты проверки дисциплин:\n${fullReport || 'Нет данных'}`);
        }
        
        await bot.sendMessage(chatId, `✅ Проверка завершена. Обработано ${bikes.length} велосипедов.`);

    } catch (error) {
        console.error('Global /discheck error:', error);
        await bot.sendMessage(chatId, `❌ Произошла фатальная ошибка: ${error.message}`);
    }
});

// Команда /stop — экстренная остановка
bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    stopRequested = true;
    // Clear queues if any
    if (processingQueue) {
        if (processingQueue.queues) processingQueue.queues.clear();
        if (processingQueue.processing) processingQueue.processing.clear();
        if (processingQueue.discountInfo) processingQueue.discountInfo.clear();
    }
    await bot.sendMessage(chatId, '🛑 Экстренная остановка всех операций! Очереди очищены, циклы прерваны.');
});

// Команда /check — проверка объявлений или последних N байков; удаление удалённых, отметка резерва
bot.onText(/\/check (.+)/, async (msg, match) => {
    stopRequested = false;
    const chatId = msg.chat.id;
    const messageText = match[1].trim();
    const isCountOnly = /^\d+$/.test(messageText);
    if (isCountOnly) {
        const count = Math.max(1, parseInt(messageText));
        
        const tgLogger = async (text) => {
             try {
                 await bot.sendMessage(chatId, text, { disable_notification: true });
             } catch (e) {
                 console.error('Failed to send TG log:', e.message);
             }
        };

        try {
            const hunter = new UnifiedHunter({ logger: tgLogger });
            await hunter.ensureInitialized();
            await hunter.checkAndCleanup({ limit: count, onProgress: tgLogger });
            await bot.sendMessage(chatId, '✅ Проверка завершена.');
        } catch (e) {
             await bot.sendMessage(chatId, `❌ Ошибка проверки: ${e.message}`);
        }
        return;
    }
    const links = extractKleinanzeigenLinks(messageText);
    if (links.length === 0) {
        return bot.sendMessage(chatId, '❌ Пожалуйста, отправьте корректную ссылку на Kleinanzeigen после команды /check или укажите количество.');
    }
    const results = [];
    for (let i = 0; i < links.length; i++) {
        if (stopRequested) {
            await bot.sendMessage(chatId, '🛑 Проверка прервана командой /stop.');
            break;
        }
        const url = links[i];
        const statusMsg = await bot.sendMessage(chatId, `🔍 Проверяю объявление (${i + 1}/${links.length})...\n\n🔗 ${url}`);
        try {
            await bot.editMessageText('📸 Делаю скриншоты страницы...', { chat_id: chatId, message_id: statusMsg.message_id });
            let vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000 });
            let slices = Array.isArray(vis.slices) ? vis.slices : [];
            if (!slices || slices.length < 2) {
                vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000, slowMo: 50 });
                slices = Array.isArray(vis.slices) ? vis.slices : [];
            }
            if (slices.length === 0 && vis.telegramPhotoPath) {
                slices = [vis.telegramPhotoPath];
            }
            const deleted = Boolean(vis && vis.dom && vis.dom.hasGelöscht);
            const reserved = Boolean(vis && vis.dom && vis.dom.hasReserviert);
            let priceStatus = 'цена в порядке';
            let existingId = null;
            try { const existing0 = await bikesDB.getBikeByOriginalUrl(url); existingId = existing0?.id || null; } catch {}
            try {
                const parsed = await parser.parseKleinanzeigenLink(url);
                const newPrice = Number(parsed && parsed.price);
                if (existingId && Number.isFinite(newPrice) && newPrice > 0) {
                    const existing = await bikesDB.getBikeById(existingId);
                    const currentPrice = Number(existing?.price || 0);
                    const oldPrice = Number(existing?.original_price || 0);
                    const parsedOriginalPrice = Number(parsed && parsed.originalPrice);
                    let finalPrice = currentPrice;
                    let finalOriginal = oldPrice;
                    let priceChanged = false;
                    let originalChanged = false;

                    if (Number.isFinite(newPrice) && newPrice > 0 && newPrice !== currentPrice) {
                        finalPrice = newPrice;
                        priceChanged = true;
                        priceStatus = `новая цена - ${Math.round(newPrice)}€`;
                    }

                    {
                        const candidates = [];
                        if (Number.isFinite(oldPrice) && oldPrice > 0) candidates.push(oldPrice);
                        if (Number.isFinite(parsedOriginalPrice) && parsedOriginalPrice > 0) candidates.push(parsedOriginalPrice);
                        if (Number.isFinite(currentPrice) && currentPrice > 0) candidates.push(currentPrice);
                        if (Number.isFinite(newPrice) && newPrice > 0) candidates.push(newPrice);
                        if (candidates.length) {
                            const maxObserved = Math.max.apply(null, candidates);
                            if (!finalOriginal || maxObserved > finalOriginal) {
                                finalOriginal = maxObserved;
                                originalChanged = true;
                            }
                        }
                    }

                    if (priceChanged || originalChanged) {
                        const discount = finalOriginal && finalOriginal > finalPrice 
                            ? Math.max(0, Math.round((1 - (finalPrice / finalOriginal)) * 100)) 
                            : 0;
                        
                        await bikesDB.updateBike(existingId, { 
                            price: finalPrice, 
                            original_price: finalOriginal, 
                            discount 
                        });

                        if (priceChanged) {
                             if (finalPrice < currentPrice) {
                                 await bot.sendMessage(chatId, `💸 Обновление цены для ID ${existingId}: было ${Math.round(currentPrice)}€, стало ${Math.round(finalPrice)}€ (скидка ${discount}%)`);
                             } else {
                                 await bot.sendMessage(chatId, `💸 Цена для ID ${existingId} повышена: было ${Math.round(currentPrice)}€, стало ${Math.round(finalPrice)}€`);
                             }
                        }
                        if (originalChanged && !priceChanged) {
                             await bot.sendMessage(chatId, `🏷️ Обновлена старая цена для ID ${existingId}: ${Math.round(finalOriginal)}€ (скидка ${discount}%)`);
                        }
                    }
                }
            } catch (_) { /* silent */ }
            if (deleted) {
                try {
                    if (existingId) {
                        const existingFull = await bikesDB.getBikeById(existingId);
                        let recentPrice2 = Number(existingFull?.price || 0);
                        try { recentPrice2 = Number.isFinite(Number(newPrice)) && Number(newPrice) > 0 ? Math.round(Number(newPrice)) : Math.round(recentPrice2); } catch {}
                        const imgs2 = await bikesDB.getBikeImages(existingId);
                        const mainImg2 = (existingFull && existingFull.main_image) || (Array.isArray(imgs2) && imgs2.length ? imgs2[0] : null);
                        const modelStr2 = `${(existingFull?.brand || '')} ${(existingFull?.model || '')}`.trim();
                        const cityStr2 = existingFull?.location || null;
                        await bikesDB.addRecentDelivery({ bikeId: existingId, model: modelStr2, city: cityStr2, price: recentPrice2, mainImage: mainImg2, status: 'Снято' });
                        await bikesDB.setBikeActive(existingId, false);
                        await bikesDB.removeBike(existingId);
                        await bot.sendMessage(chatId, `📦 Отправлено в недавние доставки: ID ${existingId}`);
                        results.push(`id${existingId} отправлено в недавние доставки — ${priceStatus}`);
                    } else {
                        await bot.sendMessage(chatId, `📦 Отправлено в недавние доставки: запись в базе не найдена`);
                        results.push(`(без id) отправлено в недавние доставки — ${priceStatus}`);
                    }
                } catch (e) {
                    await bot.sendMessage(chatId, `⚠️ Ошибка обработки записи: ${e.message}`);
                    results.push(existingId ? `id${existingId} ошибка обработки — ${priceStatus}` : `(без id) ошибка обработки — ${priceStatus}`);
                }
                continue;
            }
            if (reserved) {
                try {
                    if (existingId) {
                        await bikesDB.updateBike(existingId, { is_reserviert: 1 });
                        await bot.sendMessage(chatId, `⛔️ Зарезервирован: ID ${existingId} — флаг is_reserviert=1 установлен.`);
                        results.push(`id${existingId} зарезервирован — ${priceStatus}`);
                    } else {
                        await bot.sendMessage(chatId, `⛔️ Зарезервирован: запись в базе не найдена.`);
                        results.push(`(без id) зарезервирован — ${priceStatus}`);
                    }
                } catch (e) {
                    await bot.sendMessage(chatId, `⚠️ Ошибка обновления резерва: ${e.message}`);
                    results.push(existingId ? `id${existingId} ошибка резерва — ${priceStatus}` : `(без id) ошибка резерва — ${priceStatus}`);
                }
            }
            try {
                if (existingId) {
                    const existingFull = await bikesDB.getBikeById(existingId);
                    const isFirstCheck = !existingFull || !existingFull.last_checked_at;
                    if (!deleted && isFirstCheck) {
                        let parserData2 = {};
                        try { parserData2 = await parser.parseKleinanzeigenLink(url); } catch {}
                        const ctx = {
                            originalUrl: url,
                            title: parserData2.title || null,
                            description: parserData2.description || null,
                            price: Number(parserData2.price || 0) || null,
                            location: parserData2.location || null
                        };
                        let imgData2 = {};
                        if (slices.length >= 2) {
                            imgData2 = await geminiProcessor.processBikeDataFromTwoShots(slices[0], slices[1], ctx);
                        } else {
                            imgData2 = await geminiProcessor.processBikeDataFromImages(slices, ctx);
                        }
                        const finalData2 = await geminiProcessor.finalizeUnifiedData(parserData2 || {}, imgData2);
                        const updatePayload2 = {
                            brand: finalData2.brand || existingFull.brand,
                            model: finalData2.model || existingFull.model,
                            size: finalData2.frameSize || existingFull.size,
                            category: finalData2.category || existingFull.category,
                            year: finalData2.year || existingFull.year,
                            wheel_diameter: finalData2.wheelDiameter || existingFull.wheel_diameter,
                            location: finalData2.location || existingFull.location,
                            is_negotiable: typeof finalData2.isNegotiable === 'boolean' ? (finalData2.isNegotiable ? 1 : 0) : existingFull.is_negotiable,
                            discipline: finalData2.discipline || existingFull.discipline,
                            seller_name: finalData2.sellerName || existingFull.seller_name,
                            seller_type: finalData2.sellerType || existingFull.seller_type,
                            seller_member_since: finalData2.sellerMemberSince || existingFull.seller_member_since,
                            seller_badges_json: finalData2.sellerBadges || existingFull.seller_badges_json,
                            source_ad_id: finalData2.sourceAdId || existingFull.source_ad_id,
                            is_bike: typeof finalData2.isBike === 'boolean' ? (finalData2.isBike ? 1 : 0) : existingFull.is_bike
                        };
                        await bikesDB.updateBike(existingId, updatePayload2);
                        const jsonText2 = JSON.stringify(finalData2, null, 2);
                        const limit2 = 3800;
                        if (jsonText2.length > limit2) {
                            await bot.sendMessage(chatId, `\`\`\`json\n${jsonText2.substring(0, limit2)}\n\`\`\``, { parse_mode: 'Markdown' });
                            await bot.sendMessage(chatId, '... (truncated)');
                        } else {
                            await bot.sendMessage(chatId, `\`\`\`json\n${jsonText2}\n\`\`\``, { parse_mode: 'Markdown' });
                        }
                    }
                }
            } catch (_) {}
            await bot.sendMessage(chatId, `🖼️ Получено скриншотов: ${slices.length}`);
            if (!deleted && !reserved) {
                if (existingId) results.push(`id${existingId} все ок — ${priceStatus}`);
                else results.push(`(без id) все ок — ${priceStatus}`);
            }
            if (existingId) await bikesDB.markBikeChecked(existingId);
        } catch (err) {
            await bot.editMessageText(`❌ Ошибка проверки: ${err.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
            results.push(`(ошибка проверки)`);
        }
    }
    if (results.length) {
        await bot.sendMessage(chatId, `📋 Результаты:\n${results.join('\n')}`);
    }
});

// Новая команда для полной обработки с созданием карточки
bot.onText(/\/groq_card (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    // Проверяем, что это ссылка на Kleinanzeigen
    if (!url.includes('kleinanzeigen.de')) {
        bot.sendMessage(chatId, '❌ Пожалуйста, отправьте ссылку на объявление с kleinanzeigen.de');
        return;
    }
    
    await handleGroqWithCardCreation(chatId, url);
});

bot.onText(/\/test (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageText = match[1].trim();
    const links = extractKleinanzeigenLinks(messageText);
    const discountInfo = extractDiscountPercentage(messageText);
    if (links.length === 0) {
        return bot.sendMessage(chatId, '❌ Пожалуйста, отправьте корректную ссылку на Kleinanzeigen после команды /test.');
    }
    const url = links[0];
    try {
        const t0 = Date.now();
        const statusMsg = await bot.sendMessage(chatId, `🔄 Тестовая обработка ссылки...\n\n🔗 ${url}`);
        await bot.editMessageText('🌐 Получаю данные с сайта...', { chat_id: chatId, message_id: statusMsg.message_id });
        const t1 = Date.now();
        const rawBikeData = await parser.parseKleinanzeigenLink(url);
        const t2 = Date.now();
        await bot.sendMessage(chatId, `📊 Исходные данные:\n\n\`\`\`json\n${JSON.stringify(rawBikeData, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
        await bot.editMessageText('📸 Захватываю скриншоты объявления...', { chat_id: chatId, message_id: statusMsg.message_id });
        const vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000 });
        const t3 = Date.now();
        let slices = Array.isArray(vis.slices) ? vis.slices : [];
        if (slices.length === 0 && vis.telegramPhotoPath) {
            slices = [vis.telegramPhotoPath];
        }
        await bot.sendMessage(chatId, `🖼️ Скриншотов: ${slices.length}`, { parse_mode: 'Markdown' });
        await bot.editMessageText('🤖 Обрабатываю скриншоты через Gemini (2 шага)...', { chat_id: chatId, message_id: statusMsg.message_id });
        const t4 = Date.now();
        let processedBikeData;
        if (slices.length >= 2) {
            processedBikeData = await geminiProcessor.processBikeDataFromTwoShots(slices[0], slices[1], { originalUrl: url, title: rawBikeData.title, price: rawBikeData.price, location: rawBikeData.location });
        } else {
            processedBikeData = await geminiProcessor.processBikeDataFromImages(slices, { originalUrl: url, title: rawBikeData.title, price: rawBikeData.price, location: rawBikeData.location });
        }
        if (processedBikeData && processedBikeData.processedMode === 'text_fallback') {
            await bot.sendMessage(chatId, '⚠️ Мультимодальный анализ не дал текст. Перешёл в текстовый режим для извлечения данных.');
        }
        const t5 = Date.now();
        processedBikeData = htmlFallbackEnhance(rawBikeData, processedBikeData);
        if (discountInfo && processedBikeData.price) {
            const currentPrice = parseFloat(processedBikeData.price);
            if (!isNaN(currentPrice) && currentPrice > 0) {
                const originalMarketPrice = Math.round(currentPrice / (1 - discountInfo.appliedDiscount / 100));
                processedBikeData.originalPrice = originalMarketPrice;
                processedBikeData.discountPercentage = discountInfo.appliedDiscount;
                processedBikeData.hasDiscount = true;
            }
        }
        processedBikeData.originalUrl = url;
        await bot.sendMessage(chatId, `🤖 Результат Gemini:\n\n\`\`\`json\n${JSON.stringify(processedBikeData, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
        await bot.editMessageText('🔎 Пост‑обработка и верификация...', { chat_id: chatId, message_id: statusMsg.message_id });
        const t6 = Date.now();
        const enhanced = await PostProcessor.verifyAndEnhanceBikeData(processedBikeData);
        const t7 = Date.now();
        await bot.sendMessage(chatId, `🧠 Пост‑обработка:\n\n\`\`\`json\n${JSON.stringify(enhanced, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
        const nextId = await bikesDB.getNextId();
        const plannedImages = Array.isArray(rawBikeData.images) && rawBikeData.images.length > 0
            ? rawBikeData.images.map((_, i) => `/images/bikes/id${nextId}/${i + 1}.webp`)
            : [];
        const dbInsert = {
            name: `${enhanced.brand || 'Unknown'} ${enhanced.model || 'Model'}`.trim(),
            category: enhanced.category || 'Городской',
            brand: enhanced.brand || 'Unknown',
            model: enhanced.model || 'Model',
            size: enhanced.frameSize || 'M',
            price: enhanced.price || 0,
            original_price: enhanced.originalPrice || null,
            discount: enhanced.originalPrice && enhanced.price ? Math.max(0, Math.round((1 - (enhanced.price / enhanced.originalPrice)) * 100)) : 0,
            main_image: plannedImages[0] || null,
            features: Array.isArray(enhanced.features) ? enhanced.features : [],
            description: enhanced.description || '',
            source: 'telegram-bot',
            original_url: url,
            condition_status: enhanced.isNew ? 'new' : 'used',
            year: enhanced.year || null,
            wheel_diameter: enhanced.wheelDiameter || null,
            location: enhanced.location || null,
            is_negotiable: enhanced.isNegotiable ? 1 : 0,
            is_new: enhanced.isNew ? 1 : 0,
            discipline: enhanced.discipline || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const dbUpdateAfterInsert = {
            source_domain: enhanced.sourceDomain || null,
            source_platform_type: enhanced.sourcePlatformType || 'unknown',
            sub_category: enhanced.subCategory || null,
            classification_confidence: enhanced.classificationConfidence || 0,
            needs_review: enhanced.needsReview ? 1 : 0
        };
        const catalogPreview = {
            id: nextId,
            name: dbInsert.name,
            category: dbInsert.category,
            brand: dbInsert.brand,
            model: dbInsert.model,
            size: dbInsert.size,
            price: dbInsert.price,
            original_price: dbInsert.original_price,
            discount: dbInsert.discount,
            main_image: dbInsert.main_image,
            images: plannedImages,
            status: dbInsert.condition_status,
            discipline: dbInsert.discipline,
            location: dbInsert.location,
            original_url: dbInsert.original_url
        };
        const wantedFields = ['brand','model','price','isNegotiable','deliveryOption','frameSize','year','discipline','isNew','sellerName','sellerMemberSince','sellerBadges','sellerType','sourceDomain','sourcePlatformType','sourceAdId'];
        const foundMap = {};
        const missing = [];
        for (const f of wantedFields) {
            const v = enhanced[f];
            const ok = !(v === undefined || v === null || (typeof v === 'string' && v.trim() === ''));
            foundMap[f] = ok;
            if (!ok) missing.push(f);
        }
        const debugInfo = {
            steps: [
                'parse_html',
                'capture_screenshots',
                'gemini_multimodal',
                'post_process',
                'prepare_db_insert',
                'prepare_preview'
            ],
            counts: {
                screenshots: Array.isArray(slices) ? slices.length : 0,
                rawImages: Array.isArray(rawBikeData.images) ? rawBikeData.images.length : 0,
                plannedImages: plannedImages.length
            },
            found: foundMap,
            missing,
            notes: [
                discountInfo ? `discount_applied_${discountInfo.appliedDiscount}%` : 'no_discount',
                enhanced.needsReview ? 'needs_manual_confirmation' : 'auto_classified'
            ],
            errors: vis && vis.error ? [vis.error] : [],
            timings_ms: {
                start: t0,
                before_parse: t1 - t0,
                parse_html: t2 - t1,
                capture_screenshots: t3 - t2,
                gemini_wait_before: t4 - t3,
                gemini_call: t5 - t4,
                post_process: t7 - t6,
                total: t7 - t0
            },
            artifacts: {
                screenshot_path: vis && vis.screenshotPath ? vis.screenshotPath : null,
                telegram_photo_path: vis && vis.telegramPhotoPath ? vis.telegramPhotoPath : null
            }
        };
        const message = [
            '🧪 РЕЖИМ /test — предварительный результат без записи в БД',
            '— Следующий ID: ' + nextId,
            '\n📦 Вставка в таблицу bikes:',
            '```json\n' + JSON.stringify(dbInsert, null, 2) + '\n```',
            '\n📝 Доп. обновление после вставки:',
            '```json\n' + JSON.stringify(dbUpdateAfterInsert, null, 2) + '\n```',
            '\n🖼️ План изображений:',
            '```json\n' + JSON.stringify(plannedImages, null, 2) + '\n```',
            '\n🗂️ Превью карточки каталога:',
            '```json\n' + JSON.stringify(catalogPreview, null, 2) + '\n```',
            '\n🪪 Отладка:',
            '```json\n' + JSON.stringify(debugInfo, null, 2) + '\n```'
        ].join('\n');
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        await bot.editMessageText('✅ Тестовая обработка завершена', { chat_id: chatId, message_id: statusMsg.message_id });
    } catch (e) {
        try {
            const debugErr = {
                steps: ['parse_html','capture_screenshots','gemini_multimodal','post_process'],
                errors: [e.message]
            };
            await bot.sendMessage(chatId, '❌ Ошибка тестовой обработки.\n\n```json\n' + JSON.stringify(debugErr, null, 2) + '\n```', { parse_mode: 'Markdown' });
        } catch (_) {
            await bot.sendMessage(chatId, `❌ Ошибка тестовой обработки: ${e.message}`);
        }
    }
});

bot.onText(/\/rate(?:\s+(.*))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const raw = match && match[1] ? String(match[1]).trim() : '';
    const url = raw || 'https://www.otpbank.ru/retail/currency/';
    try {
        const statusMsg = await bot.sendMessage(chatId, `🔄 Обновляю курс EUR…\n\n🔗 ${url}`);
        await bot.editMessageText('📸 Делаю скриншот страницы банка...', { chat_id: chatId, message_id: statusMsg.message_id });
        let vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000 });
        let slices = Array.isArray(vis.slices) ? vis.slices : [];
        if (slices.length === 0 && vis.telegramPhotoPath) {
            slices = [vis.telegramPhotoPath];
        }
        await bot.editMessageText(`🖼️ Получено изображений: ${slices.length}`, { chat_id: chatId, message_id: statusMsg.message_id });
        const result = await geminiProcessor.extractEurSellRateFromImages(slices);
        const rate = Number(result && result.eur_sell_rate);
        if (!Number.isFinite(rate) || rate <= 0) {
            await bot.sendMessage(chatId, '❌ Не удалось извлечь курс продажи EUR.');
            return;
        }
        await bot.sendMessage(chatId, `💱 Курс продажи EUR: ${rate.toFixed(2)} ₽`);
        try {
            const resp = await axios.post(`http://localhost:${CONFIG.API_PORT}/api/rates/eur`, { value: rate, source: 'otpbank' }, { timeout: 8000 });
            if (resp && resp.data && resp.data.success) {
                await bot.sendMessage(chatId, '✅ Курс обновлён и сохранён.');
            } else {
                const errText = resp && resp.data && resp.data.error ? String(resp.data.error) : 'unknown_error';
                await bot.sendMessage(chatId, `⚠️ Курс получен, но не удалось сохранить на сервере: ${errText}`);
            }
        } catch (e) {
            await bot.sendMessage(chatId, `⚠️ Ошибка сохранения курса на сервере: ${e.message}`);
        }
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка обновления курса: ${error.message}`);
    }
});

// Обработчик команды /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const imageStats = await imageHandler.getImageStats();
        const dbStats = await getDatabaseStats();
        
        const statsMessage = `
📊 Статистика бота:

🖼️ Изображения:
• Всего файлов: ${imageStats?.count || 0}
• Общий размер: ${imageStats?.totalSizeMB || 0} MB

🚴‍♂️ Велосипеды в каталоге:
• Всего: ${dbStats.total}
• Добавлено ботом: ${dbStats.fromBot}
• Последнее добавление: ${dbStats.lastAdded || 'Нет данных'}

🤖 Система:
• Gemini API: ${CONFIG.GEMINI_API_KEY ? '✅ Активен' : '❌ Не настроен'}
• Парсер: ✅ Активен
• Обработка изображений: ✅ Активна
        `;
        
        bot.sendMessage(chatId, statsMessage);
        
    } catch (error) {
        bot.sendMessage(chatId, `❌ Ошибка получения статистики: ${error.message}`);
    }
});

// Обработчик команды /cleanup
bot.onText(/\/cleanup/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        await imageHandler.cleanupOldImages();
        bot.sendMessage(chatId, '✅ Очистка старых изображений завершена');
    } catch (error) {
        bot.sendMessage(chatId, `❌ Ошибка очистки: ${error.message}`);
    }
});

// Обработчик команды /queue - проверка статуса очереди
bot.onText(/\/queue/, async (msg) => {
    const chatId = msg.chat.id;
    
    const status = processingQueue.getQueueStatus(chatId);
    
    if (status.remaining === 0 && !status.isProcessing) {
        bot.sendMessage(chatId, '📭 Очередь пуста. Нет ссылок в обработке.');
    } else {
        const processingText = status.isProcessing ? '🔄 Обрабатывается...' : '⏸️ Ожидает';
        const queueText = status.remaining > 0 ? `\n📋 В очереди: ${status.remaining} ссылок` : '';
        
        bot.sendMessage(chatId, `📊 Статус очереди:\n\n${processingText}${queueText}`);
    }
});

// Обработчик команды /delete - удаление велосипеда по ID
bot.onText(/\/delete (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const bikeId = parseInt(match[1]);
    
    try {
        // Ищем велосипед с указанным ID
        const bike = await bikesDB.getBikeById(bikeId);
        
        if (!bike) {
            bot.sendMessage(chatId, `❌ Велосипед с ID ${bikeId} не найден в базе данных.`);
            return;
        }
        
        // Удаляем велосипед из базы данных
        await bikesDB.removeBike(bikeId);
        
        const bikeInfo = `${bike.brand} ${bike.model}`;
        
        // Получаем обновленную статистику
        const stats = await getDatabaseStats();
        
        const successMessage = `✅ Велосипед удален успешно!

🚴‍♂️ **${bikeInfo}** (ID: ${bikeId})

📊 Обновленная статистика:
📦 Всего велосипедов: ${stats.total}
🤖 Добавлено ботом: ${stats.fromBot}`;
        
        bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('❌ Ошибка удаления велосипеда:', error);
        bot.sendMessage(chatId, `❌ Ошибка удаления велосипеда: ${error.message}`);
    }
});

// Обработчик команды /cleanall - очистка базы данных
bot.onText(/\/cleanall/, async (msg) => {
    const chatId = msg.chat.id;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🤖 Велосипеды от бота', callback_data: 'clean_bot_bikes' }
            ],
            [
                { text: '🗑️ Вся база данных', callback_data: 'clean_all_bikes' }
            ],
            [
                { text: '❌ Отмена', callback_data: 'clean_cancel' }
            ]
        ]
    };
    
    const warningMessage = `
⚠️ *ВНИМАНИЕ: ОЧИСТКА БАЗЫ ДАННЫХ*

Выберите, что вы хотите очистить:

🤖 *Велосипеды от бота* - удалит только велосипеды, добавленные через Telegram бот
🗑️ *Вся база данных* - полная очистка всех велосипедов

⚠️ *Это действие необратимо!*
Все выбранные данные будут удалены навсегда.
    `;
    
    bot.sendMessage(chatId, warningMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

// Обработчик callback-запросов для команды /cleanall
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    
    // Отвечаем на callback чтобы убрать "загрузку"
    await bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'confirm_condition_new' || data === 'confirm_condition_used') {
        const resolver = pendingConditionResolvers.get(messageId);
        if (resolver) {
            pendingConditionResolvers.delete(messageId);
            await bot.editMessageText(data === 'confirm_condition_new' ? '✅ Статус подтверждён: Новый' : '✅ Статус подтверждён: Б/У', {
                chat_id: chatId,
                message_id: messageId
            });
            resolver(data === 'confirm_condition_new' ? 'new' : 'used');
        } else {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Заявка на подтверждение не найдена', show_alert: false });
        }
        return;
    }

    if (data.startsWith('clean_')) {
        if (data === 'clean_cancel') {
            await bot.editMessageText('❌ Очистка базы данных отменена.', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        // Показываем финальное подтверждение
        const confirmKeyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Да, очистить', callback_data: `confirm_${data}` },
                    { text: '❌ Отмена', callback_data: 'clean_cancel' }
                ]
            ]
        };
        
        let confirmMessage = '';
        switch (data) {
            case 'clean_bot_bikes':
                confirmMessage = '🤖 Вы уверены, что хотите удалить все велосипеды, добавленные ботом?\n\n⚠️ Будут удалены только велосипеды из источника "telegram"';
                break;
            case 'clean_all_bikes':
                confirmMessage = '🗑️ Вы уверены, что хотите очистить всю базу данных?\n\n⚠️ Будут удалены ВСЕ велосипеды из базы данных!';
                break;
        }
        
        await bot.editMessageText(confirmMessage, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: confirmKeyboard
        });
    }
    
    if (data.startsWith('confirm_clean_')) {
        const cleanType = data.replace('confirm_', '');
        
        try {
            await bot.editMessageText('🔄 Выполняю очистку базы данных...', {
                chat_id: chatId,
                message_id: messageId
            });
            
            let result = '';
            
            switch (cleanType) {
                case 'clean_bot_bikes':
                    await cleanBotDatabase();
                    const stats = await getDatabaseStats();
                    result = `✅ Велосипеды от бота успешно удалены!\n\n📊 Осталось велосипедов: ${stats.total}`;
                    break;
                    
                case 'clean_all_bikes':
                    // Удаляем все велосипеды из базы данных
                    const allBikes = await bikesDB.getAllBikes();
                    for (const bike of allBikes) {
                        await bikesDB.removeBike(bike.id);
                    }
                    result = `✅ Вся база данных успешно очищена!\n\n🗑️ Удалено велосипедов: ${allBikes.length}`;
                    break;
            }
            
            await bot.editMessageText(result, {
                chat_id: chatId,
                message_id: messageId
            });
            
        } catch (error) {
            console.error('❌ Ошибка очистки базы данных:', error);
            await bot.editMessageText(`❌ Ошибка очистки базы данных:\n\n${error.message}`, {
                chat_id: chatId,
                message_id: messageId
            });
        }
    }
    
    // Обработка создания карточки из Groq данных
    if (data.startsWith('create_card_')) {
        const url = data.replace('create_card_', '');
        
        await bot.editMessageText('🔄 Создаю карточку в каталоге...', {
            chat_id: chatId,
            message_id: messageId
        });
        
        await handleGroqWithCardCreation(chatId, url, messageId);
        return;
    }

    // Обработка кнопок для Groq парсера (старый метод)
    if (data.startsWith('add_groq_')) {
        try {
            // Декодируем данные велосипеда
            const base64Data = data.replace('add_groq_', '');
            const bikeData = JSON.parse(Buffer.from(base64Data, 'base64').toString());
            
            await bot.editMessageText('🔄 Добавляю велосипед в каталог...', {
                chat_id: chatId,
                message_id: messageId
            });
            
            // Преобразуем данные Groq в формат для базы данных
            const dbBikeData = {
                id: Date.now(),
                name: bikeData.title || 'Велосипед',
                brand: bikeData.brand || 'Неизвестно',
                model: bikeData.model || '',
                price: bikeData.price || 0,
                originalPrice: bikeData.price || 0,
                condition: bikeData.condition || 'gut',
                frameSize: bikeData.frameSize || null,
                wheelDiameter: bikeData.wheelDiameter || null,
                year: bikeData.year || null,
                location: bikeData.location || '',
                description: bikeData.description || '',
                category: bikeData.category || 'Citybike',
                specifications: bikeData.specifications || {},
                url: bikeData.url,
                images: [], // Groq не загружает изображения
                addedAt: new Date().toISOString(),
                source: 'groq',
                isNegotiable: bikeData.isNegotiable || false,
                deliveryOption: bikeData.deliveryOption || ''
            };
            
            // Добавляем в базу данных
            await addBikeToDatabase(dbBikeData);
            
            await bot.editMessageText('✅ Велосипед успешно добавлен в каталог!', {
                chat_id: chatId,
                message_id: messageId
            });
            
        } catch (error) {
            console.error('Ошибка добавления велосипеда из Groq:', error);
            await bot.editMessageText(`❌ Ошибка добавления велосипеда: ${error.message}`, {
                chat_id: chatId,
                message_id: messageId
            });
        }
    }
    
    if (data === 'reject_groq') {
        await bot.editMessageText('❌ Велосипед не добавлен в каталог.', {
            chat_id: chatId,
            message_id: messageId
        });
    }
});

// Функция извлечения ссылок из текста
// Функция извлечения процента скидки из текста
function extractDiscountPercentage(text) {
    const discountRegex = /(\d+)%/g;
    const matches = text.match(discountRegex);
    
    if (matches && matches.length > 0) {
        // Берем первый найденный процент
        const percentage = parseInt(matches[0].replace('%', ''));
        
        // Генерируем случайную скидку ±5% от указанного процента
        const minDiscount = Math.max(1, percentage - 5); // Минимум 1%
        const maxDiscount = Math.min(99, percentage + 5); // Максимум 99%
        const randomDiscount = Math.floor(Math.random() * (maxDiscount - minDiscount + 1)) + minDiscount;
        
        return {
            originalPercentage: percentage,
            appliedDiscount: randomDiscount
        };
    }
    
    return null;
}

// Универсальная функция извлечения URL из текста
function extractUrlsFromText(text) {
    // Регулярное выражение для поиска всех URL в тексте
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const allUrls = text.match(urlRegex) || [];
    
    // Очищаем URL от знаков препинания в конце
    const cleanUrls = allUrls.map(url => url.replace(/[.,;!?]+$/, ''));
    
    return cleanUrls;
}

// Функция для фильтрации только ссылок Kleinanzeigen
function extractKleinanzeigenLinks(text) {
    const allUrls = extractUrlsFromText(text);
    const kleinanzeigenRegex = /^https?:\/\/(www\.)?kleinanzeigen\.de\/s-anzeige\//;
    
    return allUrls.filter(url => kleinanzeigenRegex.test(url));
}

// Функция для определения типа ссылки и выбора подходящего обработчика
function categorizeUrl(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('kleinanzeigen.de/s-anzeige/')) {
        return 'kleinanzeigen';
    } else if (urlLower.includes('ebay.de') || urlLower.includes('ebay.com')) {
        return 'ebay';
    } else if (urlLower.includes('amazon.de') || urlLower.includes('amazon.com')) {
        return 'amazon';
    } else if (urlLower.includes('bike24.de') || urlLower.includes('bike-discount.de') || urlLower.includes('fahrrad.de')) {
        return 'bike_shop';
    } else {
        return 'other';
    }
}
function parseGenericHtml(url, html) {
    const pick = (r) => {
        if (!html) return null;
        const m = html.match(r);
        return m ? String(m[1]).trim() : null;
    };
    const title = pick(/<title[^>]*>([^<]{1,200})<\/title>/i) || pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || null;
    const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || null;
    let priceStr = null;
    const pm = html ? html.match(/([\d\s.,]{2,})\s?(€|eur)/i) : null;
    if (pm) priceStr = pm[1];
    let priceNum = 0;
    if (priceStr) {
        const s = priceStr.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
        const n = Math.round(parseFloat(s || '0'));
        priceNum = Number.isFinite(n) ? n : 0;
    }
    const images = [];
    if (html) {
        const ogImgs = [...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)];
        for (const m of ogImgs) { if (m[1]) images.push(m[1]); }
        if (images.length === 0) {
            const twImgs = [...html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi)];
            for (const m of twImgs) { if (m[1]) images.push(m[1]); }
        }
    }
    return { title, description: desc, price: priceNum, images, originalUrl: url };
}

// Упрощенный обработчик /test_autocat: единый HTML‑first пайплайн с чанкованием
// (см. test-autocat.js)

// Обработчик команды /tester
bot.onText(/\/tester (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1];

    const startTime = Date.now();
    // Status message
    const statusMsg = await bot.sendMessage(chatId, '🚀 Executing optimized analysis...');

    try {
        // 1. Fetch HTML
        const htmlStart = Date.now();
        const html = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        }).then(r => r.data);
        const htmlTime = Date.now() - htmlStart;

        // Extract basic images from HTML (OG tags) - fallback
        const basicData = parseGenericHtml(url, html);
        const initialImages = basicData.images || [];

        // 2. Analyze with LLM (includes HTML optimization + Gemini Fast Pass)
        const analysisStart = Date.now();
        const analysisResult = await analyzeWithLLM(html, url);
        const analysisTime = Date.now() - analysisStart;

        const totalTime = Date.now() - startTime;

        // Add timing info to metadata
        if (analysisResult.metadata) {
            analysisResult.metadata.timings = {
                html_fetch_ms: htmlTime,
                llm_analysis_ms: analysisTime,
                total_ms: totalTime
            };
        }

        // 3. Robust Parser Execution (The "Grok" way)
        // We run this unconditionally to get the best images and seller data
        let parserData = {};
        try {
             console.log('🖼️ Extracting images via KleinanzeigenParser (Grok-style)...');
             parserData = await parser.parseKleinanzeigenLink(url);
             console.log(`📸 Parser found ${parserData.images ? parserData.images.length : 0} images`);
        } catch (pErr) {
             console.error('Parser failed:', pErr);
        }

        // 4. Logic Branching: Fast Pass vs Playwright
        let finalData = analysisResult.stage1.data;
        let stage2Logs = null;

        if (analysisResult.stage1.needs_playwright) {
            await bot.sendMessage(chatId, `⚠️ **Fast Pass Insufficient**\nReasons: ${analysisResult.stage1.reasons?.join(', ')}\n\n🔄 Initiating Playwright Fallback...`, { parse_mode: 'Markdown' });
            
            // FALLBACK: Use existing robust scraper
            const pwStart = Date.now();
            const vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000 });
            
            stage2Logs = {
                execution_ms: Date.now() - pwStart,
                screenshots_count: (vis.slices || []).length
            };
        }

        // 5. Send JSON Output (The "Log" part)
        const fullLog = {
            ...analysisResult,
            parser_images_count: parserData.images ? parserData.images.length : 0,
            stage2_execution: stage2Logs
        };
        
        const jsonOutput = JSON.stringify(fullLog, null, 2);
        const MAX_LENGTH = 4000;
        if (jsonOutput.length > MAX_LENGTH) {
             await bot.sendMessage(chatId, `\`\`\`json\n${jsonOutput.substring(0, MAX_LENGTH)}\n\`\`\``, { parse_mode: 'Markdown' });
             await bot.sendMessage(chatId, `... (logs truncated)`);
        } else {
            await bot.sendMessage(chatId, `\`\`\`json\n${jsonOutput}\n\`\`\``, { parse_mode: 'Markdown' });
        }

        // 6. Save to Database (The "Action" part)
        await bot.sendMessage(chatId, '💾 Saving to Database...');
        
        try {
            // Prioritize Parser data for Seller and Images
            const dbData = {
                category: finalData.category || 'Городской',
                brand: finalData.brand,
                model: finalData.model,
                frameSize: finalData.frameSize,
                price: finalData.price,
                originalPrice: finalData.oldPrice,
                images: [], // Will be filled after download
                isNew: false,
                description: finalData.description,
                features: parserData.sellerBadges || finalData.sellerBadges || [],
                deliveryOption: finalData.deliveryOption,
                source: 'telegram-tester',
                originalUrl: url,
                condition: 'used',
                year: finalData.year,
                wheelDiameter: finalData.wheelDiameter,
                location: finalData.location,
                isNegotiable: finalData.isNegotiable,
                discipline: finalData.discipline,
                // Seller Info - PRIORITY TO PARSER
                sellerName: parserData.sellerName || finalData.sellerName,
                sellerBadges: parserData.sellerBadges || finalData.sellerBadges,
                sellerType: parserData.sellerType || finalData.sellerType,
                sellerMemberSince: parserData.sellerMemberSince || finalData.sellerMemberSince
            };

            const savedBike = await bikesDB.addBike(dbData);

            // 6.1. Download and Save Images (Exact Groq Logic)
            await bot.sendMessage(chatId, '🖼️ Processing and saving images locally...');
            let localImagePaths = [];
            
            try {
                // Use ONLY parser images if available, as requested "exactly like in usual grok analysis"
                const imagesToDownload = parserData.images || [];
                
                if (imagesToDownload.length === 0) {
                     console.log('⚠️ No images found from parser');
                } else {
                    // Use the ImageHandler to download and save images to backend/public/images/bikes/id[ID]
                    localImagePaths = await imageHandler.downloadAndProcessImages(imagesToDownload, savedBike.id);
                    
                    if (localImagePaths && localImagePaths.length > 0) {
                        await bikesDB.addBikeImages(savedBike.id, localImagePaths);
                        
                        await bikesDB.updateBike(savedBike.id, {
                            main_image: localImagePaths[0]
                        });
                        
                        savedBike.images = localImagePaths;
                        savedBike.main_image = localImagePaths[0];
                        
                        await bot.sendMessage(chatId, `✅ Saved ${localImagePaths.length} images locally.`);
                    }
                }
            } catch (imgErr) {
                console.error('Image processing failed:', imgErr);
                await bot.sendMessage(chatId, `❌ Image processing failed: ${imgErr.message}`);
            }
            
            // 7. Final Formatted Message
            const now = new Date();
            const dateStr = now.toLocaleDateString('ru-RU');
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const timestamp = `${dateStr} ${timeStr}`;
            
            const message = `BikeEUpload, [${timestamp}]
🚴‍♂️ ${savedBike.brand} ${savedBike.model}
💰 Цена: ${savedBike.price}€
📍 Местоположение: ${savedBike.location || 'Не указано'}
🏷️ Категория: ${savedBike.category}
🔧 Состояние: ${savedBike.condition || 'used'}
📏 Размер рамы: ${savedBike.frameSize || savedBike.size || 'N/A'}
📅 Год: ${savedBike.year || 'Не указан'}
🆔 ID в каталоге: ${savedBike.id}
🖼️ Изображений: ${savedBike.images ? savedBike.images.length : 0}
🤖 Обработано Gemini: ${analysisResult.stage1 ? '✅' : '❌'}
📝 ${savedBike.brand} ${savedBike.model} ${savedBike.frameSize || ''} ${savedBike.category}
🔗 Оригинальная ссылка: ${url}

BikeEUpload, [${timestamp}]
📸 Главное фото: ${savedBike.brand} ${savedBike.model}`;

            await bot.sendMessage(chatId, message, { disable_web_page_preview: true });

            // 8. Send Main Photo
            if (savedBike.main_image) {
                try {
                    const filename = path.basename(savedBike.main_image);
                    const localFilePath = path.join(imageHandler.imageDir, `id${savedBike.id}`, filename);
                    
                    await bot.sendPhoto(chatId, localFilePath);
                } catch (photoErr) {
                    console.error('Failed to send photo:', photoErr);
                    await bot.sendMessage(chatId, `❌ Could not send photo: ${photoErr.message}`);
                }
            }
            
        } catch (dbError) {
            await bot.sendMessage(chatId, `❌ Database Save Failed: ${dbError.message}`);
        }
        
        await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    } catch (error) {
        console.error("Tester error:", error);
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Обработчик команды /test_autocat
bot.onText(/\/test_autocat(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match && match[1] ? match[1].trim() : '1';
    
    // Parse args: "5 mtb" or just "5"
    let quota = 1;
    let category = 'mtb';
    let customQuery = null;
    
    const parts = args.split(' ');
    if (parts.length > 0) {
        const n = parseInt(parts[0]);
        if (!isNaN(n)) quota = n;
        if (parts.length > 1) category = parts[1];
    }
    
    // Support custom query if arg is like "query:enduro bike" (simplified)
    if (args.includes('query:')) {
        customQuery = args.split('query:')[1].trim();
        category = 'custom';
    }

    await bot.sendMessage(chatId, `🏹 Запускаю UnifiedHunter: ${category.toUpperCase()} x ${quota}`);

    const tgLogger = async (text) => {
        try {
            console.log(`[UnifiedHunter] ${text}`);
            // Send to TG, but maybe throttle or batch? 
            // For now, send every message but handle errors
            await bot.sendMessage(chatId, text, { disable_notification: true });
        } catch (e) {
            console.error('Failed to send TG log:', e.message);
        }
    };
    
    try {
        const hunter = new UnifiedHunter({ logger: tgLogger });
        await hunter.ensureInitialized();
        
        await hunter.hunt({ category, quota, filters: { customQuery } });
        
        await bot.sendMessage(chatId, '✅ Охота завершена.');
    } catch (e) {
        await bot.sendMessage(chatId, `❌ Ошибка охоты: ${e.message}`);
    }
});

// Обработчик текстовых сообщений (ссылок)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Пропускаем команды
    if (messageText.startsWith('/')) {
        return;
    }
    
    // Извлекаем все URL из текста
    const allUrls = extractUrlsFromText(messageText);
    
    if (allUrls.length > 0) {
        // Категоризируем найденные URL
        const categorizedUrls = allUrls.map(url => ({
            url: url,
            type: categorizeUrl(url)
        }));
        
        // Фильтруем только поддерживаемые ссылки (пока только Kleinanzeigen)
        const kleinanzeigenUrls = categorizedUrls.filter(item => item.type === 'kleinanzeigen').map(item => item.url);
        const otherUrls = categorizedUrls.filter(item => item.type !== 'kleinanzeigen');
        
        // Уведомляем о найденных неподдерживаемых ссылках
        if (otherUrls.length > 0) {
            const otherUrlsList = otherUrls.map(item => `• ${item.url} (${item.type})`).join('\n');
            await bot.sendMessage(chatId, `ℹ️ Найдены ссылки, которые пока не поддерживаются:\n\n${otherUrlsList}\n\n🔧 В будущем планируется добавить поддержку других платформ!`);
        }
        
        // Обрабатываем ссылки Kleinanzeigen
        if (kleinanzeigenUrls.length > 0) {
            // Извлекаем информацию о скидке из текста
            const discountInfo = extractDiscountPercentage(messageText);
            
            if (discountInfo) {
                await bot.sendMessage(chatId, `🎯 Обнаружена скидка ${discountInfo.originalPercentage}%!\n💰 Применяю случайную скидку ${discountInfo.appliedDiscount}% (±5% от указанной)`);
            }
            
            if (kleinanzeigenUrls.length === 1) {
                // Одна ссылка - обрабатываем с Groq по умолчанию
                await handleGroqWithCardCreation(chatId, kleinanzeigenUrls[0]);
            } else {
                // Несколько ссылок - добавляем в очередь для обработки с Groq
                await handleMultipleGroqLinks(chatId, kleinanzeigenUrls, discountInfo);
            }
        } else if (otherUrls.length === 0) {
            // Если URL найдены, но ни один не подходит
            await bot.sendMessage(chatId, '❌ Найденные ссылки не поддерживаются.\n\n✅ Поддерживаются ссылки с Kleinanzeigen:\nhttps://www.kleinanzeigen.de/s-anzeige/...\n\n💡 Вы можете отправить несколько ссылок в одном сообщении - они будут обработаны по очереди.\n\n🎯 Для применения скидки добавьте процент в сообщение, например: "20%"\n\n🤖 По умолчанию используется Groq AI. Для Gemini AI используйте команду /gemini');
        }
    } else {
        // Если URL вообще не найдены
        await bot.sendMessage(chatId, '❌ В сообщении не найдено ссылок.\n\n✅ Поддерживаются ссылки с Kleinanzeigen:\nhttps://www.kleinanzeigen.de/s-anzeige/...\n\n💡 Пример сообщения:\n"Привет! Вот ссылка на велосипед https://www.kleinanzeigen.de/s-anzeige/... со скидкой 15%"\n\n🎯 Для применения скидки добавьте процент в сообщение\n\n🤖 По умолчанию используется Groq AI. Для Gemini AI используйте команду /gemini');
    }
});

// Функция обработки множественных ссылок с Gemini
async function handleMultipleLinks(chatId, links, discountInfo = null) {
    const uniqueLinks = [...new Set(links)]; // Убираем дубликаты
    
    const discountMessage = discountInfo ? `\n\n🎯 Скидка ${discountInfo.appliedDiscount}% будет применена ко всем велосипедам!` : '';
    await bot.sendMessage(chatId, `📋 Найдено ${uniqueLinks.length} ссылок на велосипеды.\n\n🔄 Добавляю в очередь обработки с Gemini AI...\n\n⏱️ Ссылки будут обработаны по порядку с интервалом 2 секунды для предотвращения перегрузки API.${discountMessage}`);
    
    // Добавляем ссылки в очередь с информацией о скидке
    processingQueue.addLinks(chatId, uniqueLinks, discountInfo);
}

// Функция обработки множественных ссылок с Groq
async function handleMultipleGroqLinks(chatId, links, discountInfo = null) {
    const uniqueLinks = [...new Set(links)]; // Убираем дубликаты
    
    const discountMessage = discountInfo ? `\n\n🎯 Скидка ${discountInfo.appliedDiscount}% будет применена ко всем велосипедам!` : '';
    await bot.sendMessage(chatId, `📋 Найдено ${uniqueLinks.length} ссылок на велосипеды.\n\n🔄 Добавляю в очередь обработки с Groq AI...\n\n⏱️ Ссылки будут обработаны по порядку с интервалом 3 секунды для предотвращения перегрузки API.${discountMessage}`);
    
    // Обрабатываем ссылки последовательно с Groq
    for (let i = 0; i < uniqueLinks.length; i++) {
        const link = uniqueLinks[i];
        try {
            await bot.sendMessage(chatId, `🔄 Обрабатываю ссылку ${i + 1} из ${uniqueLinks.length}...`);
            await handleGroqWithCardCreation(chatId, link);
            
            // Задержка между обработкой ссылок
            if (i < uniqueLinks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 секунды между запросами
            }
        } catch (error) {
            console.error(`❌ Ошибка обработки ссылки ${link}:`, error.message);
            await bot.sendMessage(chatId, `❌ Ошибка обработки ссылки ${i + 1}:\n${link}\n\nОшибка: ${error.message}`);
        }
    }
    
    await bot.sendMessage(chatId, `✅ Завершена обработка всех ${uniqueLinks.length} ссылок с Groq AI!`);
}

// Основная функция обработки ссылки
async function handleKleinanzeigenLink(chatId, url, remainingInQueue = 0, discountInfo = null, progress = null) {
    const queueInfo = remainingInQueue > 0 ? ` (осталось в очереди: ${remainingInQueue})` : '';
    const progressInfo = progress && progress.total ? ` (${progress.current}/${progress.total})` : '';
    const statusMessage = await bot.sendMessage(chatId, `🔄 Обрабатываю ссылку${queueInfo}${progressInfo}...\n\n🔗 ${url}`);
    
    try {
        console.log(`\n🔗 Начинаю обработку ссылки: ${url}`);
        let rawBikeData;
        const existing = await bikesDB.getBikeByOriginalUrl(url);
        if (existing && existing.id) {
            await bot.sendMessage(chatId, `♻️ Велосипед уже в каталоге (ID ${existing.id}). Обработка отменена.`);
            return;
        }
        
        await bot.editMessageText('📸 Захватываю скриншоты объявления...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        let vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000 });
        let slices = Array.isArray(vis.slices) ? vis.slices : [];
        if (!slices || slices.length < 2) {
            vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000, slowMo: 50 });
            slices = Array.isArray(vis.slices) ? vis.slices : [];
        }
        if (slices.length === 0 && vis.telegramPhotoPath) {
            slices = [vis.telegramPhotoPath];
        }
        const deleted = Boolean(vis && vis.dom && vis.dom.hasGelöscht);
        if (deleted) {
            try {
                const existing = await bikesDB.getBikeByOriginalUrl(url);
                if (existing && existing.id) {
                    const imgs = await bikesDB.getBikeImages(existing.id);
                    const mainImg = (existing && existing.main_image) || (Array.isArray(imgs) && imgs.length ? imgs[0] : null);
                    const modelStr = `${(existing.brand || '')} ${(existing.model || '')}`.trim();
                    const recentPrice = Number(existing.price || 0);
                    const cityStr = existing.location || null;
                    await bikesDB.addRecentDelivery({ bikeId: existing.id, model: modelStr, city: cityStr, price: recentPrice, mainImage: mainImg, status: 'Снято' });
                    await bikesDB.setBikeActive(existing.id, false);
                    await bikesDB.removeBike(existing.id);
                    await bot.sendMessage(chatId, `📦 Отправлено в недавние доставки: ID ${existing.id}`);
                } else {
                    await bot.sendMessage(chatId, `📦 Отправлено в недавние доставки: запись в базе не найдена`);
                }
            } catch (e) {
                await bot.sendMessage(chatId, `⚠️ Ошибка обработки записи: ${e.message}`);
            }
            return;
        }
        await bot.sendMessage(chatId, `🖼️ Скриншотов: ${slices.length}`);
        await bot.editMessageText('🤖 Анализирую скриншоты через Gemini...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        let processedBikeData;
        if (slices.length >= 2) {
            processedBikeData = await geminiProcessor.processBikeDataFromTwoShots(slices[0], slices[1], {
                originalUrl: url
            });
        } else {
            processedBikeData = await geminiProcessor.processBikeDataFromImages(slices, {
                originalUrl: url
            });
        }
        console.log('✅ Gemini обработка завершена:', JSON.stringify(processedBikeData, null, 2));
        
        // Отправляем результат Gemini в чат
        await bot.sendMessage(chatId, `🤖 *Результат Gemini:*\n\`\`\`json\n${JSON.stringify(processedBikeData, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
        
        await bot.editMessageText('🌐 Получаю данные с сайта...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        const linkType = categorizeUrl(url);
        if (linkType === 'kleinanzeigen') {
            rawBikeData = await parser.parseKleinanzeigenLink(url);
        } else {
            const html = vis && vis.network && vis.network.rawHtml ? vis.network.rawHtml : '';
            rawBikeData = parseGenericHtml(url, html);
        }
        console.log('✅ Данные получены:', JSON.stringify(rawBikeData, null, 2));
        await bot.sendMessage(chatId, `📊 *Данные с сайта:*\n\`\`\`json\n${JSON.stringify(rawBikeData, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
        await bot.editMessageText('🧩 Объединяю данные парсера и Gemini...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        const unifiedData = await geminiProcessor.finalizeUnifiedData(rawBikeData, processedBikeData);
        if (typeof unifiedData.price === 'string') {
            const s = String(unifiedData.price).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(/,/g, '.');
            const n = Math.round(parseFloat(s || '0'));
            unifiedData.price = Number.isFinite(n) ? n : 0;
        } else if (typeof unifiedData.price === 'number') {
            unifiedData.price = Math.round(unifiedData.price);
        }
        await bot.sendMessage(chatId, `🧠 *Единый результат:*\n\`\`\`json\n${JSON.stringify(unifiedData, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
        
        // 2.5. Применение скидки (если указана)
        if (discountInfo && unifiedData.price) {
            const currentPrice = parseFloat(unifiedData.price);
            if (!isNaN(currentPrice) && currentPrice > 0) {
                const originalMarketPrice = Math.round(currentPrice / (1 - discountInfo.appliedDiscount / 100));
                
                // Сохраняем рыночную цену как "оригинальную", текущая цена остается неизменной
                unifiedData.originalPrice = originalMarketPrice;
                unifiedData.discountPercentage = discountInfo.appliedDiscount;
                unifiedData.hasDiscount = true;
                // processedBikeData.price остается неизменной!
                
                console.log(`💰 Отличная цена! Скидка ${discountInfo.appliedDiscount}% от рыночной: ${originalMarketPrice}€ → ${currentPrice}€`);
                
                await bot.sendMessage(chatId, 
                     `🏷️ Отличная цена! Скидка ${discountInfo.appliedDiscount}% от рыночной цены!\n\n` +
                     `💰 Рыночная цена: ${originalMarketPrice}€\n` +
                     `🔥 Ваша цена: ${currentPrice}€\n\n` +
                     `💡 Экономия: ${originalMarketPrice - currentPrice}€`
                 );
            }
        }
        
        // 2.6. Пост‑обработка: определение нового/б/у по домену и уточнение категории
        await bot.editMessageText('🔎 Верифицирую единые данные...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        const enhancedUnified = await PostProcessor.verifyAndEnhanceBikeData(unifiedData);

        if (enhancedUnified.needsReview) {
            const promptMsg = await bot.sendMessage(chatId, '❓ Неоднозначный статус объявления. Выберите состояние велосипеда:', {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: 'Новый', callback_data: 'confirm_condition_new' }, { text: 'Б/У', callback_data: 'confirm_condition_used' } ]
                    ]
                }
            });
            const userChoice = await new Promise((resolve) => {
                pendingConditionResolvers.set(promptMsg.message_id, resolve);
                setTimeout(() => {
                    if (pendingConditionResolvers.get(promptMsg.message_id)) {
                        pendingConditionResolvers.delete(promptMsg.message_id);
                        resolve(enhancedUnified.isNew ? 'new' : 'used');
                    }
                }, 20000);
            });
            enhancedUnified.isNew = userChoice === 'new';
            enhancedUnified.condition = userChoice;
        }

        if (enhancedUnified.isNew === true) {
            enhancedUnified.isNegotiable = false;
            enhancedUnified.deliveryOption = 'available';
        }

        // 3. Добавление в базу данных каталога (сначала вставляем, получаем ID)
        await bot.editMessageText('💾 Добавляю велосипед в каталог...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        
        // Вставляем без изображений, обновим позже основное фото
        const addedBike = await addBikeToDatabase({ ...enhancedUnified, images: [], isActive: true });
        console.log(`📥 Вставка завершена. Получен bike_id: ${addedBike.id}`);

        // 4. Загрузка и обработка изображений (используем реальный insertedId)
        await bot.editMessageText('🖼️ Загружаю и обрабатываю изображения...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });

        let images = [];
        const sourceImages = (unifiedData.images && unifiedData.images.length > 0) ? unifiedData.images : (rawBikeData.images || []);
        if (sourceImages && sourceImages.length > 0) {
            try {
                images = await imageHandler.downloadAndProcessImages(sourceImages, addedBike.id);
                console.log(`✅ Загружено изображений: ${images.length} для bike_id=${addedBike.id}`);
            } catch (imgErr) {
                console.error('❌ Ошибка загрузки изображений:', imgErr.message);
            }
        }

        if (images.length > 0) {
            try {
                await bikesDB.addBikeImages(addedBike.id, images);
                await bikesDB.updateBike(addedBike.id, { main_image: images[0] });
                addedBike.images = images;
                console.log(`🖼️ Записаны изображения в bike_images и обновлено main_image для bike_id=${addedBike.id}`);
            } catch (dbImgErr) {
                console.error('❌ Ошибка записи изображений в базу:', dbImgErr.message);
            }
        } else {
            // Фолбэк: placeholder
            const placeholder = imageHandler.generatePlaceholderImage(enhancedUnified);
            await bikesDB.updateBike(addedBike.id, { main_image: placeholder });
            addedBike.images = [placeholder];
            console.log(`🖼️ Изображения недоступны. Установлен placeholder для bike_id=${addedBike.id}`);
        }
        // 4.1. Записываем уточнённые атрибуты классификации
        try {
            await bikesDB.updateBike(addedBike.id, {
                category: enhancedUnified.category,
                discipline: enhancedUnified.discipline || null,
                sub_category: enhancedUnified.subCategory || null,
                source_domain: enhancedUnified.sourceDomain || null,
                source_platform_type: enhancedUnified.sourcePlatformType || 'unknown',
                classification_confidence: enhancedUnified.classificationConfidence || 0,
                needs_review: enhancedUnified.needsReview ? 1 : 0,
                is_new: enhancedUnified.isNew ? 1 : 0,
                condition_status: enhancedUnified.isNew ? 'new' : 'used',
                is_negotiable: enhancedUnified.isNegotiable ? 1 : 0,
                delivery_info: enhancedUnified.deliveryOption || null,
                seller_name: enhancedUnified.sellerName || null,
                seller_member_since: enhancedUnified.sellerMemberSince || null,
                seller_badges_json: enhancedUnified.sellerBadges ? enhancedUnified.sellerBadges : null,
                seller_type: enhancedUnified.sellerType || 'unknown',
                source_ad_id: enhancedUnified.sourceAdId || null,
                is_bike: enhancedUnified.isBike ? 1 : 0
            });
        } catch (e) {
            console.warn('⚠️ Не удалось обновить классификационные поля:', e.message);
        }

        // 4.2. Анализ состояния (Condition Analysis)
        try {
            const analysisBikeData = {
                title: addedBike.name,
                description: addedBike.description,
                price: addedBike.price,
                currency: 'EUR',
                brand: addedBike.brand,
                model: addedBike.model,
                year: addedBike.year,
                isNegotiable: !!enhancedUnified.isNegotiable
            };
            
            await performAndSaveConditionAnalysis(
                addedBike.id, 
                analysisBikeData, 
                addedBike.images || [], 
                bikesDB
            );
            
        } catch (condErr) {
            console.error('❌ Ошибка при запуске анализа состояния:', condErr.message);
        }
        
        // 5. Отправка результата
        await bot.editMessageText('✅ Велосипед успешно добавлен в каталог!', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });

        // Автосинхронизация с сервером (каталогом) — при единой БД это no-op, но оставляем вызов
        try {
            const syncUrl = process.env.BOT_SYNC_URL || 'http://localhost:8081/api/bot/sync';
            const botSecret = process.env.BOT_SECRET || process.env.BOT_API_KEY || '';
            const payload = {
                id: addedBike.id,
                name: addedBike.name,
                brand: addedBike.brand,
                model: addedBike.model,
                price: addedBike.price,
                description: addedBike.description,
                main_image: addedBike.images?.[0] || addedBike.main_image || '',
                images: addedBike.images || []
            };
            const resp = await fetch(syncUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Bot-Secret': botSecret
                },
                body: JSON.stringify(payload)
            });
            const data = await resp.json().catch(() => ({}));
            console.log('🔄 Синхронизация с сервером:', data);
        } catch (syncErr) {
            console.warn('⚠️ Ошибка синхронизации с сервером:', syncErr.message);
        }
        
        // Отправляем подробную информацию о добавленном велосипеде
        const bikeInfo = `
🚴‍♂️ *${addedBike.name || 'Неизвестный велосипед'}*

💰 Цена: ${addedBike.price || 0}€${addedBike.originalPrice ? ` (было ${addedBike.originalPrice}€)` : ''}
📍 Местоположение: ${addedBike.location || 'Не указано'}
🏷️ Категория: ${addedBike.category || 'Не указана'}
🔧 Состояние: ${addedBike.condition || 'Не указано'}
📏 Размер рамы: ${addedBike.size || 'Не указан'}
${addedBike.year ? `📅 Год: ${addedBike.year}` : ''}
 🤝 Торг: ${addedBike.isNegotiable ? 'возможен' : 'нет'}
 📦 Доставка: ${addedBike.deliveryInfo || 'Не указано'}

🆔 ID в каталоге: ${addedBike.id}
🖼️ Изображений: ${addedBike.images ? addedBike.images.length : 0}
🤖 Обработано Gemini: ✅

📝 ${addedBike.description || 'Описание отсутствует'}

🔗 Оригинальная ссылка: ${addedBike.originalUrl || 'Не указана'}
        `;
        
        bot.sendMessage(chatId, bikeInfo, { parse_mode: 'Markdown' });
        
        // Отправляем первое изображение, поддерживая локальный путь для веб-URL
        if (addedBike.images && addedBike.images.length > 0) {
            try {
                const mainImg = addedBike.images[0];
                const photoSource = (typeof mainImg === 'string' && mainImg.startsWith('/images/'))
                    ? resolveLocalImagePath(mainImg)
                    : mainImg;
                await bot.sendPhoto(chatId, photoSource, {
                    caption: `📸 Главное фото: ${addedBike.name}`
                });
            } catch (error) {
                console.error('❌ Ошибка отправки изображения:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка обработки ссылки:', error);
        
        await bot.editMessageText(`❌ Ошибка: ${error.message}`, {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
    }
}

// Функция добавления велосипеда в базу данных
// Функция для полной обработки Groq данных с созданием карточки
async function handleGroqWithCardCreation(chatId, url, existingMessageId = null) {
    let statusMessage = null;
    
    try {
        const existing = await bikesDB.getBikeByOriginalUrl(url);
        if (existing && existing.id) {
            await bot.sendMessage(chatId, `♻️ Велосипед уже в каталоге (ID ${existing.id}). Обработка отменена.`);
            return;
        }
        // Создаем или используем существующее сообщение для статуса
        if (existingMessageId) {
            statusMessage = { message_id: existingMessageId };
        } else {
            statusMessage = await bot.sendMessage(chatId, '🤖 Обрабатываю объявление с помощью Groq AI...');
        }
        
        // 1. Парсинг данных с помощью Groq
        await bot.editMessageText('🤖 Извлекаю данные с помощью Groq AI...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        
        console.log(`\n🤖 Начинаю Groq обработку ссылки: ${url}`);
        const groqResult = await groqIntegration.parseUrl(url);
        
        if (!groqResult.success) {
            throw new Error(`Groq парсинг не удался: ${groqResult.error}`);
        }
        
        console.log('✅ Groq данные получены:', JSON.stringify(groqResult, null, 2));
        
        // 2. Преобразование данных через адаптер
        await bot.editMessageText('🔄 Преобразую данные в формат каталога...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        
        let catalogData = groqAdapter.adaptGroqDataToCatalog(groqResult);
        console.log('✅ Данные адаптированы для каталога:', JSON.stringify(catalogData, null, 2));
        
        // 3. Валидация данных
        const validation = groqAdapter.validateCatalogData(catalogData);
        if (!validation.isValid) {
            console.warn('⚠️ Предупреждения валидации:', validation.errors);
        }
        
        // 3.5 Пост‑обработка и верификация через веб‑поиск
        await bot.editMessageText('🔎 Верифицирую данные через веб‑поиск...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        catalogData.originalUrl = url;
        let enhanced = await PostProcessor.verifyAndEnhanceBikeData(catalogData);
        if (enhanced.needsReview) {
            const promptMsg = await bot.sendMessage(chatId, '❓ Неоднозначный статус объявления. Выберите состояние велосипеда:', {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: 'Новый', callback_data: 'confirm_condition_new' }, { text: 'Б/У', callback_data: 'confirm_condition_used' } ]
                    ]
                }
            });
            const userChoice = await new Promise((resolve) => {
                pendingConditionResolvers.set(promptMsg.message_id, resolve);
                setTimeout(() => {
                    if (pendingConditionResolvers.get(promptMsg.message_id)) {
                        pendingConditionResolvers.delete(promptMsg.message_id);
                        resolve(enhanced.isNew ? 'new' : 'used');
                    }
                }, 20000);
            });
            enhanced.isNew = userChoice === 'new';
            enhanced.condition = userChoice;
        }
        
        // 4. Добавление в базу данных каталога (сначала вставляем, получаем ID)
        await bot.editMessageText('💾 Добавляю велосипед в каталог...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        const addedBike = await addBikeToDatabase({ ...enhanced, images: [] });
        console.log(`📥 Вставка завершена (Groq). Получен bike_id: ${addedBike.id}`);

        // 5. Обработка изображений (используем реальный insertedId)
        await bot.editMessageText('🖼️ Загружаю и обрабатываю изображения...', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });

        let images = [];
        try {
            console.log('🖼️ Извлекаю изображения через KleinanzeigenParser...');
            const parserResult = await parser.parseKleinanzeigenLink(url);
            if (parserResult.images && parserResult.images.length > 0) {
                console.log(`📸 Найдено ${parserResult.images.length} изображений`);
                images = await imageHandler.downloadAndProcessImages(parserResult.images, addedBike.id);
                console.log(`✅ Загружено ${images.length} изображений для bike_id=${addedBike.id}`);
            }
        } catch (imageError) {
            console.error('❌ Ошибка загрузки изображений:', imageError.message);
        }

        if (images.length > 0) {
            try {
                await bikesDB.addBikeImages(addedBike.id, images);
                await bikesDB.updateBike(addedBike.id, { main_image: images[0] });
                addedBike.images = images;
                console.log(`🖼️ Записаны изображения и обновлено main_image для bike_id=${addedBike.id}`);
            } catch (dbImgErr) {
                console.error('❌ Ошибка записи изображений в базу:', dbImgErr.message);
            }
        } else {
            const placeholder = imageHandler.generatePlaceholderImage(catalogData);
            await bikesDB.updateBike(addedBike.id, { main_image: placeholder });
            addedBike.images = [placeholder];
            console.log(`🖼️ Изображения недоступны. Установлен placeholder для bike_id=${addedBike.id}`);
        }
        
        // 6. Обновляем классификационные поля
        try {
            await bikesDB.updateBike(addedBike.id, {
                category: enhanced.category,
                discipline: enhanced.discipline || null,
                sub_category: enhanced.subCategory || null,
                source_domain: enhanced.sourceDomain || null,
                source_platform_type: enhanced.sourcePlatformType || 'unknown',
                classification_confidence: enhanced.classificationConfidence || 0,
                needs_review: enhanced.needsReview ? 1 : 0,
                is_new: enhanced.isNew ? 1 : 0,
                condition_status: enhanced.isNew ? 'new' : 'used',
                is_negotiable: enhanced.isNegotiable ? 1 : 0,
                delivery_info: enhanced.deliveryOption || null,
                seller_name: enhanced.sellerName || null,
                seller_member_since: enhanced.sellerMemberSince || null,
                seller_badges_json: enhanced.sellerBadges ? enhanced.sellerBadges : null,
                seller_type: enhanced.sellerType || 'unknown',
                source_ad_id: enhanced.sourceAdId || null
            });
        } catch (e) {
            console.warn('⚠️ Не удалось обновить классификационные поля:', e.message);
        }

        // 7. Отправка результата
        await bot.editMessageText('✅ Велосипед успешно добавлен в каталог!', {
            chat_id: chatId,
            message_id: statusMessage.message_id
        });
        
        // Отправляем подробную информацию о добавленном велосипеде
        const bikeInfo = `
🚴‍♂️ *${addedBike.name || 'Неизвестный велосипед'}*

💰 Цена: ${addedBike.price || 0}€
📍 Местоположение: ${addedBike.location || 'Не указано'}
🏷️ Категория: ${addedBike.category || 'Не указана'}
🔧 Состояние: ${addedBike.condition || 'Не указано'}
📏 Размер рамы: ${addedBike.frameSize || 'Не указан'}
${addedBike.year ? `📅 Год: ${addedBike.year}` : ''}

👤 *Продавец:*
${addedBike.seller ? `
• Имя: ${addedBike.seller.name}
• Тип: ${addedBike.seller.type}
• Значки: ${addedBike.seller.badges.length > 0 ? addedBike.seller.badges.join(', ') : 'Нет'}
${addedBike.seller.memberSince ? `• Участник с: ${addedBike.seller.memberSince}` : ''}
` : 'Информация недоступна'}

🆔 ID в каталоге: ${addedBike.id}
🖼️ Изображений: ${addedBike.images ? addedBike.images.length : 0}
🤖 Обработано Groq: ✅

📝 ${addedBike.description || 'Описание отсутствует'}

🔗 Оригинальная ссылка: ${addedBike.originalUrl || 'Не указана'}
        `;
        
        bot.sendMessage(chatId, bikeInfo, { parse_mode: 'Markdown' });
        
        // Отправляем первое изображение, поддерживая локальный путь для веб-URL
        if (addedBike.images && addedBike.images.length > 0) {
            try {
                const mainImg = addedBike.images[0];
                const photoSource = (typeof mainImg === 'string' && mainImg.startsWith('/images/'))
                    ? resolveLocalImagePath(mainImg)
                    : mainImg;
                await bot.sendPhoto(chatId, photoSource, {
                    caption: `📸 Главное фото: ${addedBike.name}`
                });
            } catch (error) {
                console.error('❌ Ошибка отправки изображения:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка обработки Groq с созданием карточки:', error);
        
        const errorMessage = `❌ Ошибка создания карточки: ${error.message}`;
        
        if (statusMessage) {
            await bot.editMessageText(errorMessage, {
                chat_id: chatId,
                message_id: statusMessage.message_id
            });
        } else {
            await bot.sendMessage(chatId, errorMessage);
        }
    }
}

async function addBikeToDatabase(bikeData) {
    try {
        console.log('💾 Добавляю велосипед в базу данных...');
        const addedBike = await bikesDB.addBike(bikeData);
        console.log(`✅ Велосипед добавлен в базу данных: ${addedBike.name} (ID: ${addedBike.id})`);
        return addedBike;
    } catch (error) {
        console.error('❌ Ошибка добавления в базу данных:', error.message);
        throw error;
    }
}

// Функция очистки базы данных бота
async function cleanBotDatabase() {
    try {
        // Удаляем все велосипеды из источника 'telegram'
        const telegramBikes = await bikesDB.getTelegramBikes();
        for (const bike of telegramBikes) {
            await bikesDB.removeBike(bike.id);
        }
        console.log(`✅ База данных бота очищена: удалено ${telegramBikes.length} велосипедов`);
        
    } catch (error) {
        console.error('❌ Ошибка очистки базы данных бота:', error.message);
        throw new Error(`Не удалось очистить базу данных бота: ${error.message}`);
    }
}



// Функция получения статистики базы данных
async function getDatabaseStats() {
    try {
        const allBikes = await bikesDB.getAllBikes();
        const telegramBikes = await bikesDB.getTelegramBikes();
        
        const lastTelegramBike = telegramBikes
            .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))[0];
        
        return {
            total: allBikes.length,
            fromBot: telegramBikes.length,
            lastAdded: lastTelegramBike ? 
                new Date(lastTelegramBike.dateAdded).toLocaleString('ru-RU') : null
        };
        
    } catch (error) {
        console.error('❌ Ошибка получения статистики базы данных:', error.message);
        return {
            total: 0,
            fromBot: 0,
            lastAdded: null
        };
    }
}

// Обработка ошибок
bot.on('error', (error) => {
    console.error('❌ Ошибка Telegram бота:', error);
});

bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error);
});

// ========================================
// 🤖 TASK QUEUE LISTENER (Bot Listener)
// ========================================

async function runBotTaskListener() {
    console.log('🤖 Starting Bot Task Listener...');
    
    // Poll every 60 seconds
    setInterval(async () => {
        try {
            // Ensure DB is initialized
            await bikesDB.ensureInitialized();

            // Fetch pending tasks
            const tasks = await bikesDB.allQuery('SELECT * FROM bot_tasks WHERE status = "pending" LIMIT 5');
            
            if (!tasks || tasks.length === 0) return;

            console.log(`🤖 Found ${tasks.length} pending tasks`);

            for (const task of tasks) {
                console.log(`🤖 Processing task ${task.id}: ${task.type}`);
                
                // Mark as processing
                await bikesDB.runQuery('UPDATE bot_tasks SET status = "processing", processed_at = CURRENT_TIMESTAMP WHERE id = ?', [task.id]);
                
                try {
                    const payload = JSON.parse(task.payload);
                    
                    if (task.type === 'VERIFY_BIKE') {
                        const bikeId = payload.bike_id;
                        const orderId = payload.order_id;
                        
                        // Get bike data
                        const bike = await bikesDB.getQuery('SELECT * FROM bikes WHERE id = ?', [bikeId]);
                        
                        if (!bike) throw new Error(`Bike ${bikeId} not found`);
                        
                        // Notify Admin
                        const admins = await bikesDB.allQuery('SELECT telegram_id FROM telegram_users WHERE role = "admin"');
                        
                        if (admins && admins.length > 0) {
                            const adminId = admins[0].telegram_id;
                            
                            if (bike.original_url) {
                                await bot.sendMessage(adminId, `🔍 <b>AUTO-VERIFICATION REQUEST</b>\n\nOrder #${orderId} paid.\nStarting deep check for bike: ${bike.name}\nURL: ${bike.original_url}`, { parse_mode: 'HTML' });
                                
                                // Run Check (screenshot only, logic inside performAndSaveConditionAnalysis might use existing images or new ones)
                                // Actually performAndSaveConditionAnalysis usually uses provided images. 
                                // But for "verification" we might want fresh check.
                                // Let's just run checkKleinanzeigenStatus to verify it's still online and get fresh DOM if needed, 
                                // but rely on stored images for analysis if we don't want to re-download everything.
                                // However, user asked for "deep check via llm-analyzer.ts".
                                
                                // Fetch existing images
                                const imageRows = await bikesDB.allQuery('SELECT image_url FROM bike_images WHERE bike_id = ? ORDER BY image_order', [bike.id]);
                                const imagePaths = imageRows.map(r => r.image_url);

                                // Run Analysis & Save
                                await performAndSaveConditionAnalysis(
                                    bike.id,
                                    {
                                        title: bike.name,
                                        description: bike.description,
                                        price: bike.price,
                                        currency: 'EUR',
                                        brand: bike.brand,
                                        model: bike.model,
                                        year: bike.year,
                                        isNegotiable: !!bike.is_negotiable
                                    },
                                    imagePaths,
                                    bikesDB,
                                    geminiClient
                                );
                                
                                await bot.sendMessage(adminId, `✅ <b>VERIFICATION COMPLETE</b>\n\nBike #${bike.id} verified for Order #${orderId}.`, { parse_mode: 'HTML' });
                            } else {
                                await bot.sendMessage(adminId, `⚠️ <b>VERIFICATION FAILED</b>\n\nBike #${bike.id} (Order #${orderId}) has no source URL. Manual check required.`, { parse_mode: 'HTML' });
                            }
                        }
                    } else if (task.type === 'NOTIFY_ADMIN') {
                        // Generic notification
                         const admins = await bikesDB.allQuery('SELECT telegram_id FROM telegram_users WHERE role = "admin"');
                         if (admins) {
                             for (const admin of admins) {
                                 await bot.sendMessage(admin.telegram_id, `🔔 <b>NOTIFICATION</b>\n\n${payload.message}`, { parse_mode: 'HTML' });
                             }
                         }
                    }
                    
                    // Mark as completed
                    await bikesDB.runQuery('UPDATE bot_tasks SET status = "completed" WHERE id = ?', [task.id]);
                    
                } catch (err) {
                    console.error(`❌ Task ${task.id} failed:`, err);
                    await bikesDB.runQuery('UPDATE bot_tasks SET status = "failed" WHERE id = ?', [task.id]);
                }
            }
        } catch (error) {
            console.error('🤖 Bot Task Listener Error:', error);
        }
    }, 60000); 
}

runBotTaskListener();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Остановка бота...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Остановка бота...');
    bot.stopPolling();
    process.exit(0);
});
