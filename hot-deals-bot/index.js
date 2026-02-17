/**
 * BikeWerk Hot Deals Bot
 * Бот с лучшими предложениями велосипедов
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const UrlExtractor = require('./utils/UrlExtractor');
const PriceFormatter = require('./utils/PriceFormatter');
const StolenBikeService = require('./services/StolenBikeService');
const UserService = require('./services/UserService');
const SimplePriceParser = require('./services/SimplePriceParser');
const CashflowCalculator = require('./services/CashflowCalculator');
// const QueueService = require('./services/QueueService'); // Disabled for simplified mode

// Конфигурация
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID);

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
    process.exit(1);
}

// Инициализация бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🚀 BikeWerk Hot Deals Bot запущен!');
console.log(`👤 Admin Chat ID: ${ADMIN_CHAT_ID}`);

// Очередь обработки
let isProcessingQueue = false;

// Трекинг новых пользователей для уведомлений
const newUserNotifications = new Set();

// ===================
// Команда: /start
// ===================

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || '';
    const firstName = msg.from.first_name || 'Unknown';

    // Получить или создать пользователя
    let user = UserService.getOrCreateUser(chatId, username, firstName);

    if (!user) {
        bot.sendMessage(chatId, '❌ Ошибка инициализации. Попробуйте позже.');
        return;
    }

    // Проверяем, новый ли это пользователь (только что созданный)
    const isNewUser = !newUserNotifications.has(chatId);

    if (isNewUser && chatId !== ADMIN_CHAT_ID && user.role === 'guest') {
        newUserNotifications.add(chatId);
        // Уведомляем админа о новом пользователе
        notifyAdminAboutNewUser(chatId, username, firstName);
    }

    // Обновляем данные пользователя на случай изменений
    user = UserService.getUser(chatId);

    // Приветственное сообщение с inline кнопками
    sendWelcomeMessage(chatId, firstName, user.role);
});

function sendWelcomeMessage(chatId, firstName, role) {
    let message = '';
    let keyboard = null;

    if (role === 'admin') {
        message = `
🎉 <b>Добро пожаловать, ${firstName}!</b>

👑 Вы вошли как <b>Администратор</b>

<b>🔥 BikeWerk - Бот с лучшими предложениями</b>
Ваш помощник в поиске горячих сделок на велосипеды из Европы

━━━━━━━━━━━━━━━━━━━━
<b>📋 Доступные функции:</b>

<b>Для администратора:</b>
📊 /admin_stats - Детальная статистика

<b>Для менеджеров:</b>
📤 Отправьте ссылку на байк
📋 /queue - Статус очереди

<b>Общие команды:</b>
🔥 /hot - Лучшие предложения
📊 /stats - Общая статистика

<b>🌐 Поддерживаемые платформы:</b>
• Kleinanzeigen
• eBay / eBay Kleinanzeigen
• Mobile.de
• Buycycle
• AutoScout24
        `.trim();

        keyboard = {
            inline_keyboard: [
                [
                    { text: '🔥 Лучшие предложения', callback_data: 'show_hot' },
                    { text: '📊 Статистика', callback_data: 'show_stats' }
                ],
                [
                    { text: '📋 Очередь', callback_data: 'show_queue' },
                    { text: '📈 Админ статистика', callback_data: 'show_admin_stats' }
                ]
            ]
        };

    } else if (role === 'manager') {
        message = `
🎉 <b>Добро пожаловать, ${firstName}!</b>

👨‍💼 Вы вошли как <b>Менеджер</b>

<b>🔥 BikeWerk - Бот с лучшими предложениями</b>
Ваш помощник в поиске горячих сделок на велосипеды из Европы

━━━━━━━━━━━━━━━━━━━━
<b>📤 Как загружать байки:</b>

Просто отправьте ссылку (можно несколько сразу):
<i>https://www.kleinanzeigen.de/s-anzeige/...</i>

Бот автоматически:
✅ Извлечет данные о байке
✅ Проверит качество объявления
✅ Добавит в каталог
✅ Отправит отчет

<b>🌐 Поддерживаемые платформы:</b>
• Kleinanzeigen
• eBay / eBay Kleinanzeigen
• Mobile.de
• Buycycle
• AutoScout24

<b>📋 Доступные команды:</b>
🔥 /hot - Лучшие предложения
📊 /stats - Статистика
📋 /queue - Статус очереди
        `.trim();

        keyboard = {
            inline_keyboard: [
                [
                    { text: '🔥 Лучшие предложения', callback_data: 'show_hot' },
                    { text: '📊 Статистика', callback_data: 'show_stats' }
                ],
                [
                    { text: '📋 Моя очередь', callback_data: 'show_queue' }
                ]
            ]
        };

    } else { // guest
        message = `
🎉 <b>Добро пожаловать, ${firstName}!</b>

<b>🔥 BikeWerk - Бот с лучшими предложениями</b>

Мы находим лучшие сделки на велосипеды из Европы и делимся ими с вами!

━━━━━━━━━━━━━━━━━━━━
<b>🔥 Что вы можете делать:</b>

✅ Просматривать актуальные предложения
✅ Видеть детали каждого байка
✅ Переходить на оригинальные объявления

<b>👇 Нажмите кнопку ниже, чтобы увидеть лучшие предложения!</b>
        `.trim();

        keyboard = {
            inline_keyboard: [
                [
                    { text: '🔥 Показать лучшие предложения', callback_data: 'show_hot' }
                ],
                [
                    { text: 'ℹ️ Как это работает?', callback_data: 'show_info' }
                ]
            ]
        };
    }

    bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
    });
}

// ===================
// Уведомление админа о новом пользователе
// ===================

function notifyAdminAboutNewUser(chatId, username, firstName) {
    if (!ADMIN_CHAT_ID) {
        console.log('⚠️ ADMIN_CHAT_ID not configured');
        return;
    }

    const userLink = username ? `@${username}` : `<a href="tg://user?id=${chatId}">${firstName}</a>`;

    const message = `
🆕 <b>Новый пользователь зарегистрирован!</b>

👤 <b>Имя:</b> ${firstName}
🔗 <b>Профиль:</b> ${userLink}
🆔 <b>Chat ID:</b> <code>${chatId}</code>
👁 <b>Текущая роль:</b> Гость

━━━━━━━━━━━━━━━━━━━━
<b>Хотите предоставить доступ к загрузке?</b>
    `.trim();

    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ Сделать менеджером', callback_data: `upgrade_manager_${chatId}` }
            ]
        ]
    };

    bot.sendMessage(ADMIN_CHAT_ID, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
    }).catch(err => {
        console.error('❌ Ошибка отправки уведомления админу:', err.message);
    });
}



// ===================
// Уведомление о новых байках (Cron/Interval Check)
// ===================
setInterval(() => {
    checkNewBikesAndNotify();
}, 60 * 60 * 1000); // Check every hour

async function checkNewBikesAndNotify() {
    try {
        const users = UserService.getAllUsers();
        if (!users || users.length === 0) return;

        const totalBikes = StolenBikeService.getStats().total;

        for (const user of users) {
            // Simple logic: if last_hot_check is old, and there are new bikes?
            // Hard to know "count of new bikes" without complex query.
            // For now, let's just use a simple "Daily Reminder" if they haven't checked int 24h.

            if (!user.last_hot_check) continue;

            const lastCheck = new Date(user.last_hot_check);
            const now = new Date();
            const diffHours = (now - lastCheck) / (1000 * 60 * 60);

            if (diffHours >= 24) {
                // Send a nudge
                bot.sendMessage(user.chat_id, `👋 Привет! Есть новые поступления байков. \n\nНажмите /hot чтобы посмотреть новинки!`, {
                    disable_notification: true
                }).catch(e => { }); // Ignore blocks

                // Update last check to avoid spamming every hour this day
                // Actually better to not update db, but maybe memory?
                // Or just update db to now so verified.
                UserService.updateUser(user.chat_id, { last_hot_check: new Date().toISOString() });
            }
        }
    } catch (e) {
        console.error('Notification error:', e);
    }
}

// ===================
// Обработка callback кнопок
// ===================

bot.on('callback_query', async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;

    // Обработка кнопок для обычных пользователей
    if (data === 'show_hot') {
        bot.answerCallbackQuery(query.id);
        // Перенаправляем на команду /hot
        bot.sendMessage(chatId, 'Загружаю лучшие предложения...');
        setTimeout(() => {
            bot.emit('message', { chat: { id: chatId }, text: '/hot', from: query.from });
        }, 100);
        return;
    }

    if (data === 'show_stats') {
        bot.answerCallbackQuery(query.id);
        setTimeout(() => {
            bot.emit('message', { chat: { id: chatId }, text: '/stats', from: query.from });
        }, 100);
        return;
    }

    if (data === 'show_queue') {
        bot.answerCallbackQuery(query.id);
        setTimeout(() => {
            bot.emit('message', { chat: { id: chatId }, text: '/queue', from: query.from });
        }, 100);
        return;
    }

    if (data === 'show_admin_stats') {
        bot.answerCallbackQuery(query.id);
        setTimeout(() => {
            bot.emit('message', { chat: { id: chatId }, text: '/admin_stats', from: query.from });
        }, 100);
        return;
    }

    if (data === 'show_info') {
        bot.answerCallbackQuery(query.id);
        const infoMessage = `
ℹ️ <b>Как работает BikeWerk?</b>

Наши менеджеры ежедневно мониторят европейские площадки и находят лучшие предложения на велосипеды.

<b>Что мы проверяем:</b>
✅ Актуальность цены
✅ Состояние байка
✅ Качество объявления
✅ Выгодность сделки

<b>Используйте команду /hot чтобы увидеть актуальные предложения!</b>
        `.trim();

        bot.sendMessage(chatId, infoMessage, { parse_mode: 'HTML' });
        return;
    }

    // Админские функции
    if (chatId !== ADMIN_CHAT_ID) {
        bot.answerCallbackQuery(query.id, { text: '⛔️ Только для админа' });
        return;
    }

    // Повышение до менеджера
    if (data.startsWith('upgrade_manager_')) {
        // ... (existing admin logic)
    }

    // Pagination for HOT
    if (data.startsWith('hot_page_')) {
        const page = parseInt(data.replace('hot_page_', ''));
        bot.answerCallbackQuery(query.id);

        // Delete previous message to avoid clutter? Or Edit?
        // Let's try to Edit the current message if possible, or send new one.
        // If we want "Gallery" feel, we should Edit.

        const galleryMode = true;
        const bikesLimit = galleryMode ? 1 : 5;
        const offset = (page - 1) * bikesLimit;
        const bikes = StolenBikeService.getCompletedBikes(bikesLimit, offset);
        const totalBikes = StolenBikeService.getStats().completed;

        if (bikes.length > 0) {
            const bike = bikes[0];
            const card = formatBikeCard(bike);

            const row1 = [
                { text: '🔗 Открыть', url: bike.url },
                { text: '💵 Детали', callback_data: `calc_details_${bike.id}` }
            ];

            const row2 = [];
            if (page > 1) {
                row2.push({ text: '⬅️ Пред.', callback_data: `hot_page_${page - 1}` });
            }
            row2.push({ text: `${page} / ${totalBikes}`, callback_data: 'noop' });
            const nextBikes = StolenBikeService.getCompletedBikes(1, offset + 1);
            if (nextBikes.length > 0) {
                row2.push({ text: 'След. ➡️', callback_data: `hot_page_${page + 1}` });
            }

            bot.editMessageText(card, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [row1, row2] },
                disable_web_page_preview: false
            }).catch(e => {
                // If content is same, ignore
                if (!e.message.includes('message is not modified')) {
                    console.error('Edit error:', e.message);
                }
            });
        } else {
            bot.sendMessage(chatId, 'Больше нет байков');
        }
    }

    if (data === 'noop') {
        bot.answerCallbackQuery(query.id);
    }

    if (data.startsWith('calc_details_')) {
        const bikeId = data.replace('calc_details_', '');
        const bike = StolenBikeService.getById(bikeId);

        if (bike) {
            const cf = CashflowCalculator.calculate(bike.price);
            const breakdown = `
📊 <a href="${bike.url}"><b>Детальный расчет (€):</b></a>

Байк: €${bike.price}
Доставка: €${cf.details.delivery}
Сервис: €${cf.details.service}
Страх. сборы: €${cf.details.insurance.toFixed(2)}
Страховка груза: ${cf.details.cargoInsurance > 0 ? '€' + cf.details.cargoInsurance : '—'}
──────────────────
Subtotal: €${(bike.price + cf.details.delivery + cf.details.service + cf.details.insurance + (cf.details.cargoInsurance || 0)).toFixed(2)}

Комиссия (7%): €${cf.details.commission.toFixed(2)}
──────────────────
<b>ИТОГО: €${cf.totalEur}</b>
<b>В РУБЛЯХ: ${cf.totalRub.toLocaleString('ru-RU')} ₽</b>
            `.trim();

            bot.sendMessage(chatId, breakdown, { parse_mode: 'HTML' });
            bot.answerCallbackQuery(query.id);
        } else {
            bot.answerCallbackQuery(query.id, { text: '❌ Байк не найден' });
        }
    }
});

// ===================
// Команда: /hot
// ===================

bot.onText(/\/hot(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;

    // Update tracking
    UserService.updateUser(chatId, { last_hot_check: new Date().toISOString() });
    UserService.logEvent('view_hot', chatId);

    try {
        const page = match[1] ? parseInt(match[1]) : 1;
        const limit = 1; // Gallery mode (1 per card)
        const offset = (page - 1) * limit;

        const bikes = StolenBikeService.getCompletedBikes(limit, offset);

        if (bikes.length === 0) {
            bot.sendMessage(chatId, '📭 Пока нет байков или список закончился.', {
                reply_markup: { inline_keyboard: [[{ text: '🔄 В начало', callback_data: 'hot_page_1' }]] }
            });
            return;
        }

        // Send first card
        const bike = bikes[0];
        const card = formatBikeCard(bike);

        const row1 = [
            { text: '🔗 Открыть', url: bike.url },
            { text: '💵 Детали', callback_data: `calc_details_${bike.id}` }
        ];

        const row2 = [];
        if (page > 1) {
            row2.push({ text: '⬅️ Пред.', callback_data: `hot_page_${page - 1}` });
        }
        row2.push({ text: `${page}`, callback_data: 'noop' });

        // Check next
        const nextBikes = StolenBikeService.getCompletedBikes(1, offset + 1);
        if (nextBikes.length > 0) {
            row2.push({ text: 'След. ➡️', callback_data: `hot_page_${page + 1}` });
        }

        bot.sendMessage(chatId, card, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [row1, row2] },
            disable_web_page_preview: false
        });

    } catch (error) {
        console.error('Error in /hot:', error);
        bot.sendMessage(chatId, '❌ Ошибка при получении списка байков.');
    }
});


// ===================
// Команда: /stats
// ===================

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const user = UserService.getUser(chatId);

    if (!user) {
        bot.sendMessage(chatId, '⏳ Отправьте /start для регистрации');
        return;
    }

    try {
        const stats = StolenBikeService.getStats();

        if (!stats) {
            bot.sendMessage(chatId, '❌ Ошибка при получении статистики.');
            return;
        }

        let message = `
📊 <b>Статистика BikeWerk Bot</b>

<b>Всего добавлено:</b> ${stats.total}

<b>По статусам:</b>
⏳ В ожидании: ${stats.pending}
⚙️ В обработке: ${stats.processing}
✅ Обработано: ${stats.completed}
❌ Ошибки: ${stats.failed}
        `.trim();

        if (stats.byUser && Object.keys(stats.byUser).length > 0) {
            message += '\n\n<b>По пользователям:</b>\n';
            for (const [user, count] of Object.entries(stats.byUser)) {
                message += `👤 ${user}: ${count}\n`;
            }
        }

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
        console.error('Error in /stats:', error);
        bot.sendMessage(chatId, '❌ Ошибка при получении статистики.');
    }
});

// ===================
// Команда: /queue (для менеджеров)
// ===================

bot.onText(/\/queue/, async (msg) => {
    const chatId = msg.chat.id;
    const user = UserService.getUser(chatId);

    if (!user || !UserService.canUpload(chatId)) {
        bot.sendMessage(chatId, '⛔️ Эта команда только для менеджеров.');
        return;
    }

    try {
        const queueStats = QueueService.getUserQueueStats(chatId);
        const totalQueue = QueueService.getQueueSize();

        const message = `
📋 <b>Статус очереди</b>

<b>Ваши загрузки:</b>
⏳ В очереди: ${queueStats.queued}
⚙️ В обработке: ${queueStats.processing}
✅ Завершено: ${queueStats.completed}
❌ Ошибки: ${queueStats.failed}

<b>Общая очередь:</b> ${totalQueue} байков
        `.trim();

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
        console.error('Error in /queue:', error);
        bot.sendMessage(chatId, '❌ Ошибка при получении статуса очереди.');
    }
});

// ===================
// Команда: /admin_stats (только для админа)
// ===================

bot.onText(/\/admin_stats/, async (msg) => {
    const chatId = msg.chat.id;

    if (chatId !== ADMIN_CHAT_ID) {
        return;
    }

    try {
        const stats = UserService.getStats(7);

        if (!stats) {
            bot.sendMessage(chatId, '❌ Ошибка при получении статистики.');
            return;
        }

        const message = `
📊 <b>Статистика за 7 дней</b>

<b>Загрузки:</b>
📤 Всего попыток: ${stats.totalUploads}
✅ Успешно: ${stats.successUploads}
❌ Ошибки: ${stats.failedUploads}
📈 Процент успеха: ${stats.successRate}%

<b>Качество данных:</b>
📊 Средний % заполнения: ${stats.avgFillRate}%

<b>Просмотры:</b>
👁 Команда /hot: ${stats.viewsCount} раз
        `.trim();

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
        console.error('Error in /admin_stats:', error);
        bot.sendMessage(chatId, '❌ Ошибка при получении статистики.');
    }
});

// ===================
// Обработка текстовых сообщений (ссылки)
// ===================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    // Пропускаем команды
    if (text.startsWith('/')) return;

    // Проверка прав
    const user = UserService.getUser(chatId);

    if (!user) {
        bot.sendMessage(chatId, '⏳ Отправьте /start для регистрации');
        return;
    }

    if (!UserService.canUpload(chatId)) {
        return; // Игнорируем сообщения от гостей
    }

    // Извлекаем все URL из сообщения
    const urls = UrlExtractor.extractUrls(text);

    if (urls.length === 0) {
        return; // Игнорируем сообщения без URL
    }

    const username = msg.from.username || msg.from.first_name || 'Unknown';

    try {
        let addedCount = 0;
        let duplicatesCount = 0;

        for (const { url, source } of urls) {
            // Проверка дубликатов
            const duplicate = StolenBikeService.checkDuplicateInStolen(url);
            if (duplicate) {
                duplicatesCount++;
                continue;
            }

            bot.sendMessage(chatId, `🔎 Парсим цену... ${url}`);

            // 1. Парсим цену и название
            const parsedData = await SimplePriceParser.parse(url);

            // 2. Рассчитываем кэшфлоу (для проверки)
            const cashflow = CashflowCalculator.calculate(parsedData.price);

            // 3. Сохраняем в БД
            const savedBike = StolenBikeService.saveStolenBike({
                url,
                source,
                rawMessage: text,
                userId: chatId,
                username: username,
                title: parsedData.title,
                price: parsedData.price,
                currency: parsedData.currency
            });

            // 4. Отправляем подтверждение
            const message = `
✅ <b>Сохранено!</b>

🚲 <b>${parsedData.title}</b>
💶 Цена сайта: €${parsedData.price}
📊 <b>Расчет для клиента:</b>
🇪🇺 €${cashflow.totalEur}
🇷🇺 ${cashflow.totalRub.toLocaleString('ru-RU')} ₽

📅 Добавлено: ${new Date().toLocaleString('ru-RU')}
            `.trim();

            bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            addedCount++;
        }

        if (duplicatesCount > 0) {
            bot.sendMessage(chatId, `⚠️ Пропущено дубликатов: ${duplicatesCount}`);
        }

    } catch (error) {
        console.error('Error processing message:', error);
        bot.sendMessage(chatId, `❌ Ошибка при обработке: ${error.message}`);
    }
});

// ===================
// Обработка очереди
// ===================

async function processQueue() {
    if (isProcessingQueue) return;

    isProcessingQueue = true;

    while (true) {
        const item = QueueService.getNext();

        if (!item) {
            isProcessingQueue = false;
            break;
        }

        try {
            // Обновляем статус
            QueueService.updateStatus(item.id, 'processing');

            // Логируем начало загрузки
            UserService.logEvent('upload_start', item.user_chat_id, { url: item.url });

            // Сохраняем в stolen_bikes
            const saved = StolenBikeService.saveStolenBike({
                url: item.url,
                source: item.source,
                rawMessage: item.url,
                userId: item.user_chat_id,
                username: 'queue'
            });

            // Обрабатываем через Hunter
            const HunterAdapter = require('./services/HunterAdapter');
            const result = await HunterAdapter.processUrl(item.url, item.source);

            if (result.success) {
                // Успех
                QueueService.updateStatus(item.id, 'completed', saved.id);
                StolenBikeService.updateStatus(saved.id, {
                    status: 'completed',
                    processed: true,
                    bikeId: result.bikeId
                });

                // Логируем успех
                UserService.logEvent('upload_success', item.user_chat_id, {
                    url: item.url,
                    bikeId: result.bikeId,
                    fillRate: result.qualityScore || 0
                });

                // Уведомляем пользователя
                bot.sendMessage(item.user_chat_id,
                    `✅ Обработан: ${result.bikeName || 'Unknown'}\n💰 €${result.price || 'N/A'}\n📊 Качество: ${result.qualityScore}/100`
                );

                // Уведомляем админа
                if (ADMIN_CHAT_ID) {
                    sendAdminReport(item, result, true);
                }

            } else {
                // Ошибка
                QueueService.updateStatus(item.id, 'failed', null, result.error);
                StolenBikeService.updateStatus(saved.id, {
                    status: 'failed',
                    errorMessage: result.error
                });

                // Логируем ошибку
                UserService.logEvent('upload_fail', item.user_chat_id, {
                    url: item.url,
                    error: result.error
                });

                // Уведомляем пользователя
                bot.sendMessage(item.user_chat_id, `❌ Ошибка: ${result.error.substring(0, 100)}`);

                // Уведомляем админа
                if (ADMIN_CHAT_ID) {
                    sendAdminReport(item, result, false);
                }
            }

        } catch (error) {
            console.error('Queue processing error:', error);
            QueueService.updateStatus(item.id, 'failed', null, error.message);
            UserService.logEvent('upload_fail', item.user_chat_id, { error: error.message });
        }

        // Небольшая пауза между обработкой
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// ===================
// Отчет админу о загрузке
// ===================

function sendAdminReport(queueItem, result, success) {
    if (!ADMIN_CHAT_ID) return;

    const user = UserService.getUser(queueItem.user_chat_id);
    const username = user ? (user.username || user.first_name) : 'Unknown';

    let message = success
        ? `✅ <b>Успешная загрузка</b>\n\n`
        : `❌ <b>Ошибка загрузки</b>\n\n`;

    message += `👤 Пользователь: ${username}\n`;
    message += `🔗 URL: ${queueItem.url.substring(0, 50)}...\n`;
    message += `📍 Источник: ${queueItem.source}\n\n`;

    if (success) {
        message += `📦 Название: ${result.bikeName || 'N/A'}\n`;
        message += `💰 Цена: €${result.price || 'N/A'}\n`;
        message += `📊 Качество: ${result.qualityScore}/100\n`;
        message += `🆔 Bike ID: <code>${result.bikeId}</code>`;
    } else {
        message += `⚠️ Ошибка: ${result.error.substring(0, 200)}`;
    }

    bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
}

// ===================
// Утилиты
// ===================

function formatBikeCard(bike) {
    const price = bike.price || 0;
    const cf = CashflowCalculator.calculate(price);

    // Format date
    const addedDate = new Date(bike.created_at).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    return `
🚲 <a href="${bike.url}"><b>${bike.title || 'Велосипед'}</b></a>

💵 <b>Цена сайта: €${price.toLocaleString('de-DE')}</b>

📊 <b>Для клиента:</b>
🇪🇺 <b>€${cf.totalEur.toLocaleString('de-DE')}</b>
🇷🇺 <b>${cf.totalRub.toLocaleString('ru-RU')} ₽</b>

👤 Добавил: Manager BikeWerk
📅 Дата: ${addedDate}
    `.trim();
}



// ===================
// Обработка ошибок
// ===================

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

process.on('SIGINT', () => {
    console.log('\n👋 Остановка бота...');
    bot.stopPolling();
    process.exit(0);
});

console.log('✅ Бот готов принимать команды!');
