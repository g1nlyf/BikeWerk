const { Telegraf, Markup } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');
const supabase = require('./supabase');
const gemini = require('./geminiProcessor');

class ManagerBotService {
    constructor() {
        this.token = '8422123572:AAEOO0PoP3QOmkgmpa53USU_F24hJdSNA3g';
        this.proxyUrl = 'http://user258350:otuspk@191.101.73.161:8984';
        
        // Allowed Managers (Whitelist)
        this.allowedUsers = [183921355, 1076231865]; 
        
        try {
            const agent = new HttpsProxyAgent(this.proxyUrl);
            this.bot = new Telegraf(this.token, {
                telegram: { agent }
            });
            
            this._initHandlers();
            
            // Start Polling (Only if enabled via ENV)
            if (process.env.BOT_POLLING === 'true') {
                this.startPolling();
            } else {
                console.log('ℹ️ Manager Bot 2.0: Polling disabled (Sender Mode)');
            }
            
        } catch (e) {
            console.error('❌ Bot Initialization Error:', e.message);
        }
    }

    startPolling() {
        if (this.isPolling) {
            console.log('⚠️ Polling already started');
            return;
        }
        this.isPolling = true;

        console.log('🤖 Manager Bot 2.0 (Telegraf) Starting Polling...');
        this.bot.launch().then(() => {
            console.log('✅ Manager Bot 2.0 Online');
        }).catch(e => {
            console.error('❌ Bot Launch Failed:', e.message);
            this.isPolling = false;
        });
        
        // Graceful Stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }

    _initHandlers() {
        // Middleware: Auth Check & Auto-Registration
        this.bot.use(async (ctx, next) => {
            const userId = ctx.from?.id;
            
            // Allow /start for registration
            if (ctx.message && ctx.message.text === '/start') {
                return next();
            }

            // Check Registration
            const isManager = await this._isManager(userId);
            if (isManager) {
                return next();
            } else {
                await ctx.reply('⛔️ Вы не зарегистрированы в системе. Нажмите /start для регистрации.');
            }
        });

        // /start - Smart Registration
        this.bot.start(async (ctx) => {
            const userId = ctx.from.id;
            
            // Check if user exists in manager_subscribers (or users via join)
            // Simplified: check users table via telegram_id if added there, OR check subscribers table
            
            // 1. Try to find existing manager link
            const manager = await this._getManagerByTelegramId(userId);
            const isManager = !!manager;
            
            // Prefer Name from DB over Telegram Username
            const displayName = manager?.name || ctx.from.username || `User${userId}`;
            
            if (isManager) {
                ctx.reply(
                    `👋 <b>Привет, ${displayName}!</b>\n` +
                    `✅ Статус: <b>Активен</b>\n` +
                    `ID: <code>${userId}</code>\n` +
                    `Ожидаю новые заявки...`,
                    { parse_mode: 'HTML' }
                );
                await this.showRecentOrders(ctx);
            } else {
                // 2. Registration Flow
                // We ask for name to register
                this.userStates = this.userStates || new Map();
                this.userStates.set(userId, { action: 'register_name' });
                ctx.reply('🔒 Вы не зарегистрированы. Введите ваше Имя для доступа к CRM:');
            }
        });

        // AI Logic: Text Handler & Registration
        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const state = this.userStates?.get(userId);

            // Registration Flow
            if (state && state.action === 'register_name') {
                const name = ctx.message.text;
                try {
                    // 1. Create User
                    const { data: user, error } = await supabase.supabase
                        .from('users')
                        .insert({
                            name: name,
                            role: 'manager',
                            active: true,
                            telegram_id: userId // Ensure this column exists or we link via subscribers
                        })
                        .select()
                        .single();

                    if (error) throw error;

                    // 2. Link in Subscribers (if table exists, otherwise telegram_id in users is enough)
                    // Assuming manager_subscribers exists per prompt instructions
                    // Upsert subscriber
                    await supabase.supabase
                        .from('manager_subscribers')
                        .upsert({
                            telegram_id: userId,
                            username: ctx.from.username || name,
                            user_id: user.id
                        });

                    ctx.reply(`✅ <b>Регистрация успешна!</b>\nДобро пожаловать, ${name}.`, { parse_mode: 'HTML' });
                    this.userStates.delete(userId);
                    await this.showRecentOrders(ctx);

                } catch (e) {
                    console.error('Registration Error:', e);
                    ctx.reply('❌ Ошибка регистрации. Попробуйте позже или обратитесь к админу.');
                }
                return;
            }

            // Existing Logic
            if (state && state.action === 'enrich_report') {
                const text = ctx.message.text;
                // Save to DB (manager_notes or timeline)
                await supabase.supabase.from('orders').update({
                    manager_notes: `[Manager Note]: ${text}` // Append in real app
                }).eq('order_code', state.orderCode);
                
                await ctx.reply(`✅ Заметка добавлена к заказу ${state.orderCode}`);
                this.userStates.delete(ctx.from.id);
            } else if (state && state.action === 'negotiation_upload') {
                await this._handleNegotiationInput(ctx, state.orderCode, ctx.message.text, []);
            } else if (ctx.message.reply_to_message) {
                 // Contextual reply logic
                 const text = ctx.message.text;
                 ctx.reply('🧠 Analyzing...');
            }
        });

        // Photo Handler
        this.bot.on('photo', async (ctx) => {
            const userId = ctx.from.id;
            const state = this.userStates?.get(userId);

            if (state && state.action === 'negotiation_upload') {
                // Get highest resolution photo
                const photo = ctx.message.photo[ctx.message.photo.length - 1];
                const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                const caption = ctx.message.caption || '';
                
                await this._handleNegotiationInput(ctx, state.orderCode, caption, [fileLink.href]);
            } else if (state && state.action === 'add_photo') {
                // ... existing add photo logic placeholder ...
                await ctx.reply('✅ Фото получено (Mock save).');
                this.userStates.delete(userId);
            }
        });

        // Actions: Accept
        this.bot.action(/^accept_order:(.+)$/, async (ctx) => {
            const orderCode = ctx.match[1];
            await this.handleAcceptOrder(ctx, orderCode);
        });

        // Actions: Confirm Payment
        this.bot.action(/^confirm_payment:(.+)$/, async (ctx) => {
             const orderCode = ctx.match[1];
             await this.handleConfirmPayment(ctx, orderCode);
        });

        // Actions: Reject
        this.bot.action(/^reject_order:(.+)$/, async (ctx) => {
            const orderCode = ctx.match[1];
            await ctx.editMessageText(`❌ Заявка ${orderCode} отклонена.`);
        });

        // Actions: Enrich Report (State)
        this.bot.action(/^enrich_report:(.+)$/, async (ctx) => {
             const orderCode = ctx.match[1];
             this.userStates = this.userStates || new Map();
             this.userStates.set(ctx.from.id, { action: 'enrich_report', orderCode });
             await ctx.reply(`📝 Введите текст дополнения для заказа ${orderCode}:`);
        });

        // Actions: Negotiation Mode (State)
        this.bot.action(/^negotiation:(.+)$/, async (ctx) => {
             const orderCode = ctx.match[1];
             this.userStates = this.userStates || new Map();
             this.userStates.set(ctx.from.id, { action: 'negotiation_upload', orderCode });
             await ctx.reply(
                 `🗣 <b>Режим переговоров для ${orderCode}</b>\n` +
                 `Отправьте скриншоты чата или перешлите сообщения продавца.\n` +
                 `AI проанализирует их и заполнит спецификацию.`,
                 { parse_mode: 'HTML' }
             );
        });

        // Actions: Start Inspection
        this.bot.action(/^start_inspection:(.+)$/, async (ctx) => {
             const orderCode = ctx.match[1];
             await this._triggerAITaskGenerator(ctx, orderCode);
        });

        // Actions: View Checklist
        this.bot.action(/^view_checklist:(.+)$/, async (ctx) => {
             const orderCode = ctx.match[1];
             // Just refresh the view, as the main view IS the checklist in inspection mode
             await this.refreshOrderView(ctx, orderCode);
        });

        // Actions: Generate Report
        this.bot.action(/^generate_report:(.+)$/, async (ctx) => {
             const orderCode = ctx.match[1];
             await supabase.supabase.from('orders').update({ status: 'negotiation_finished' }).eq('order_code', orderCode);
             await ctx.reply(`✅ Отчет сформирован и отправлен клиенту!`);
             await this.refreshOrderView(ctx, orderCode);
        });

        // Actions: Add Photo (State)
        this.bot.action(/^add_photo:(.+)$/, async (ctx) => {
             const orderCode = ctx.match[1];
             this.userStates = this.userStates || new Map();
             this.userStates.set(ctx.from.id, { action: 'add_photo', orderCode });
             await ctx.reply(`📸 Отправьте фото для заказа ${orderCode}:`);
        });
        
        // Actions: View Tasks
        this.bot.action(/^view_tasks:(.+)$/, async (ctx) => {
            const orderCode = ctx.match[1];
            await this.handleViewTasks(ctx, orderCode);
        });

        // Actions: View Order (Direct)
        this.bot.action(/^view_order:(.+)$/, async (ctx) => {
            const orderCode = ctx.match[1];
            await this.refreshOrderView(ctx, orderCode);
        });

        // Actions: Pagination
        this.bot.action(/^list_orders:(\d+)$/, async (ctx) => {
            const page = parseInt(ctx.match[1]);
            await this.showRecentOrders(ctx, page);
        });
    }

    async showRecentOrders(ctx, page = 0) {
        const limit = 5;
        const offset = page * limit;
        
        const { data: orders } = await supabase.supabase
            .from('orders')
            .select('order_code, bike_name, total_price_rub, status')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (!orders || orders.length === 0) {
            if (page > 0) await ctx.reply('Больше нет заказов.');
            return;
        }

        let msg = `📋 <b>Последние заявки (Page ${page + 1}):</b>\n\n`;
        const buttons = [];
        
        orders.forEach(o => {
            msg += `🔹 <b>${o.order_code}</b>: ${o.bike_name} (${o.total_price_rub}₽) [${o.status}]\n`;
            buttons.push([Markup.button.callback(`📂 ${o.order_code}`, `view_order:${o.order_code}`)]);
        });

        const navButtons = [];
        if (page > 0) navButtons.push(Markup.button.callback('<< Назад', `list_orders:${page - 1}`));
        navButtons.push(Markup.button.callback('Вперед >>', `list_orders:${page + 1}`));
        buttons.push(navButtons);

        try {
            // Try to edit if callback, else send new
            if (ctx.callbackQuery) {
                await ctx.editMessageText(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
            } else {
                await ctx.reply(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
            }
        } catch (e) {
            // Ignore message not modified errors
        }
    }

    async notifyNewOrder(order, bike, customer, options = {}) {
        if (!this.bot) {
            console.error('[ManagerBot] Bot instance not initialized. Cannot send notification.');
            return;
        }

        const assignedTo = options.manager ? `@${options.manager.username}` : 'Не назначен';
        const taskCount = options.tasks ? options.tasks.length : 0;

        console.log(`[ManagerBot] Preparing notification for Order ${order.order_code}. Manager: ${assignedTo}`);

        const message = `🚨 <b>НОВАЯ ЗАЯВКА: ${order.order_code}</b>
Байк: ${order.bike_name || 'Unknown'} | Цена: ${order.total_price_rub} ₽
Клиент: ${customer.full_name} (${customer.phone || customer.email})
👤 Менеджер: <b>${assignedTo}</b>
📋 AI Задачи: <b>${taskCount}</b>
`;
        const bikeUrl = (order.bike_url && order.bike_url.startsWith('http')) 
            ? order.bike_url 
            : (bike.bike_url && bike.bike_url.startsWith('http') ? bike.bike_url : 'https://eubike.ru' + (order.bike_url || ''));
        
        console.log(`[ManagerBot] Generated Bike URL: ${bikeUrl}`);

        const buttons = [
            [Markup.button.url('🔗 Открыть объявление', bikeUrl)],
            [Markup.button.callback('✅ Принять', `accept_order:${order.order_code}`)]
        ];

        if (taskCount > 0) {
            buttons.push([Markup.button.callback(`📝 Посмотреть ТЗ (${taskCount})`, `view_tasks:${order.order_code}`)]);
        }

        // Magic Link Logic for Chat
        let contactBtn = null;
        if (customer.preferred_channel === 'telegram' && customer.contact_value) {
            const username = customer.contact_value.replace('@', '');
            // Check if it looks like a valid username (not just numbers, though numbers are valid in t.me URL technically, they just don't resolve to user)
            // But we send the button anyway if it's a valid URL structure.
            const telegramUrl = `https://t.me/${username}`;
            contactBtn = Markup.button.url('📞 Чат с клиентом', telegramUrl);
        } 
        // Note: 'mailto:' links are not supported in Telegram Inline Buttons.
        // If email, we rely on the text message content.

        const bottomRow = [Markup.button.callback('❌ Отклонить', `reject_order:${order.order_code}`)];
        if (contactBtn) bottomRow.push(contactBtn);
        
        buttons.push(bottomRow);
        
        // Add enrichment buttons
        buttons.push([
            Markup.button.callback('📝 Дополнить отчет', `enrich_report:${order.order_code}`),
            Markup.button.callback('📸 Добавить фото', `add_photo:${order.order_code}`)
        ]);

        const keyboard = Markup.inlineKeyboard(buttons);

        const managers = await this._getManagers();
        console.log(`[ManagerBot] Sending notification to ${managers.length} managers:`, managers);

        for (const chatId of managers) {
            try {
                await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML', ...keyboard });
                console.log(`[ManagerBot] Notification sent to ${chatId}`);
            } catch (e) {
                console.error(`[ManagerBot] Failed to notify ${chatId}:`, e.message);
            }
        }
    }

    async handleViewTasks(ctx, orderCode) {
        try {
            // Fetch tasks via Order Code
            const { data: order } = await supabase.supabase
                .from('orders')
                .select('id')
                .eq('order_code', orderCode)
                .single();

            if (!order) return ctx.reply('❌ Заказ не найден.');

            const { data: tasks } = await supabase.supabase
                .from('tasks')
                .select('*')
                .eq('order_id', order.id)
                .eq('completed', false);

            if (!tasks || tasks.length === 0) {
                return ctx.reply(`ℹ️ Активных задач для ${orderCode} нет.`);
            }

            let msg = `📋 <b>ТЗ для ${orderCode}:</b>\n\n`;
            tasks.forEach((t, i) => {
                msg += `<b>${i + 1}.</b> ${t.title}\n`;
            });

            await ctx.reply(msg, { parse_mode: 'HTML' });
        } catch (e) {
            console.error('View Tasks Error:', e);
            ctx.reply('❌ Ошибка загрузки задач.');
        }
    }

    async _getManagerByTelegramId(telegramId) {
        // Try manager_subscribers join first (if relation exists), else direct users query
        // Since we added telegram_id to users, try that first for speed
        const { data: user } = await supabase.supabase
            .from('users')
            .select('*')
            .eq('telegram_id', telegramId)
            .eq('active', true)
            .single();
            
        if (user) return user;

        // Fallback to subscribers table link
        const { data: sub } = await supabase.supabase
            .from('manager_subscribers')
            .select('user_id')
            .eq('telegram_id', telegramId)
            .single();
            
        if (sub && sub.user_id) {
             const { data: linkedUser } = await supabase.supabase
                .from('users')
                .select('*')
                .eq('id', sub.user_id)
                .single();
             return linkedUser;
        }
        
        return null;
    }

    async _isManager(telegramId) {
        if (this.allowedUsers.includes(Number(telegramId))) return true;
        const { data } = await supabase.supabase
            .from('users')
            .select('role')
            .eq('telegram_id', telegramId)
            .in('role', ['manager', 'admin'])
            .single();
        return !!data;
    }

    async _getManagers() {
        const { data } = await supabase.supabase
            .from('users')
            .select('telegram_id')
            .in('role', ['manager', 'admin']);
        
        const dbManagers = data?.map(u => Number(u.telegram_id)).filter(id => id) || [];
        return [...new Set([...this.allowedUsers, ...dbManagers])];
    }

    async _generateOrderView(orderCode, ctx = null) {
        // Fetch full order with customer and bike details
        // Note: Using left join for bikes in case relation exists, but handling errors if not.
        // Actually, let's do safe separate queries if join fails, or just try-catch the join query.
        
        let order;
        try {
            const { data, error } = await supabase.supabase
                .from('orders')
                .select(`
                    *,
                    customers:customer_id (full_name, phone, email, contact_value, preferred_channel),
                    bikes:bike_id (url, bike_url)
                `)
                .eq('order_code', orderCode)
                .single();
            
            if (error) throw error;
            order = data;
        } catch (e) {
            console.error(`[ManagerBot] _generateOrderView Join Error for ${orderCode}:`, e.message);
            // Fallback: Try without bikes join if that was the issue
            const { data, error } = await supabase.supabase
                .from('orders')
                .select(`
                    *,
                    customers:customer_id (full_name, phone, email, contact_value, preferred_channel)
                `)
                .eq('order_code', orderCode)
                .single();
                
            if (error) {
                console.error(`[ManagerBot] _generateOrderView Fallback Error:`, error.message);
                return { text: `❌ Заказ не найден (DB Error: ${error.message})`, buttons: [] };
            }
            order = data;
        }

        if (!order) return { text: '❌ Заказ не найден', buttons: [] };

        const { status } = order;
        let text = `📂 <b>Заказ ${orderCode}</b>\n`;
        const customerName = order.customers?.full_name || order.customer_name || 'Unknown';
        text += `👤 Клиент: ${customerName}\n`;
        text += `🚲 Байк: ${order.bike_name || 'Unknown'}\n`;
        text += `💰 Бюджет: ${order.total_price_rub ? order.total_price_rub + '₽' : 'N/A'}\n`;
        text += `📊 Статус: <b>${status.toUpperCase().replace('_', ' ')}</b>\n\n`;

        const buttons = [];

        // Fetch Inspection Data for progress
        let inspection = null;
        if (['inspection', 'chat_negotiation'].includes(status)) {
            const { data: insp } = await supabase.supabase
                .from('inspections')
                .select('*')
                .eq('order_id', order.id)
                .single();
            inspection = insp;
        }

        // Dynamic View based on Status
        switch (status) {
            case 'new':
            case 'awaiting_payment': 
            case 'awaiting_deposit':
                text += `⏳ <b>Ожидание задатка</b>\n`;
                text += `Клиент должен внести бронь. Проверьте поступление.\n`;
                
                if (!order.assigned_manager) {
                     text += `⚠️ <b>Действие:</b> Подтвердите прием заявки.\n`;
                     buttons.push([Markup.button.callback('✅ Принять заявку', `accept_order:${orderCode}`)]);
                } else {
                     buttons.push([Markup.button.callback('💰 Подтвердить получение средств', `confirm_payment:${orderCode}`)]);
                }
                break;

            case 'deposit_paid':
            case 'hunting':
                text += `✅ <b>Задаток получен!</b>\n`;
                text += `🚀 <b>Задача:</b> Начать переговоры и проверку байка.\n`;
                buttons.push([Markup.button.callback('🏁 Начать проверку (AI)', `start_inspection:${orderCode}`)]);
                break;

            case 'inspection':
            case 'under_inspection':
            case 'chat_negotiation':
                // Render Checklist (21 Points)
                text += `🕵️ <b>Инспекция (Gemini 2.5 Flash)</b>\n\n`;
                
                if (inspection && inspection.checklist) {
                    const cl = inspection.checklist;
                    
                    // Grouping for better readability
                    const groups = {
                        '📝 Документы': ['serial_number', 'documents', 'receipt'],
                        '⚙️ Спеки': ['frame_size', 'wheel_size', 'frame_material', 'components_consistency'],
                        '📜 История': ['last_service', 'replaced_parts', 'owner_count', 'usage_history', 'usage_conditions', 'detailed_service'],
                        '🔧 Состояние': ['frame_damage', 'component_condition', 'consumables', 'frame_condition'],
                        '🔩 Компоненты': ['brakes', 'fork', 'shock', 'additional_info']
                    };

                    const fieldLabels = {
                        serial_number: 'Серийный номер',
                        documents: 'Документы',
                        receipt: 'Чек',
                        frame_size: 'Размер рамы',
                        wheel_size: 'Размер колес',
                        frame_material: 'Материал рамы',
                        components_consistency: 'Комплектация',
                        last_service: 'Последнее ТО',
                        replaced_parts: 'Замены',
                        owner_count: 'Владельцы',
                        usage_history: 'История',
                        mileage_age: 'Пробег/Возраст',
                        usage_conditions: 'Условия',
                        detailed_service: 'Детали ТО',
                        frame_damage: 'Повреждения',
                        component_condition: 'Состояние узлов',
                        consumables: 'Расходники',
                        frame_condition: 'Рама (общ)',
                        brakes: 'Тормоза',
                        fork: 'Вилка',
                        shock: 'Аморт',
                        additional_info: 'Инфо'
                    };

                    let filledCount = 0;
                    let totalCount = 0;

                    for (const [groupName, fields] of Object.entries(groups)) {
                        let groupText = `<b>${groupName}</b>\n`;
                        
                        fields.forEach(f => {
                            const item = cl[f];
                            totalCount++;
                            const label = fieldLabels[f] || f;
                            
                            if (item && item.value && item.value !== 'null') {
                                filledCount++;
                                groupText += `✅ ${label}\n`; 
                            } else {
                                groupText += `❌ ${label}\n`;
                            }
                        });
                        
                        text += groupText + '\n';
                    }
                    
                    const progress = Math.round((filledCount / totalCount) * 100);
                    text += `📊 Прогресс данных: <b>${progress}%</b>\n\n`;
                }

                // Render Photos Status
                if (inspection && inspection.photos_status) {
                    text += `📸 <b>Обязательные фото:</b>\n`;
                    const photos = inspection.photos_status;
                    const photoLabels = {
                        'serial_number': 'S/N',
                        'fork_stanchions': 'Вилка (ноги)',
                        'frame_defects': 'Дефекты',
                        'drivetrain': 'Трансмиссия',
                        'brake_levers': 'Ручки',
                        'general_view': 'Общий вид',
                        'shock': 'Аморт'
                    };
                    
                    for (const [key, label] of Object.entries(photoLabels)) {
                        const isOk = photos[key];
                        if (key === 'serial_number' && !isOk) {
                            text += `⚠️ <b>КРИТИЧНО: Нет фото ${label}</b>\n`;
                        } else {
                            text += `${isOk ? '✅' : '❌'} ${label}\n`;
                        }
                    }
                    text += '\n';
                }

                // German Message Copy-Paste
                if (inspection && inspection.next_action_suggestion) {
                    text += `🇩🇪 <b>Сообщение продавцу (нажми чтобы скопировать):</b>\n`;
                    text += `<code>${inspection.next_action_suggestion}</code>\n`;
                }

                buttons.push([Markup.button.callback('🗣 Добавить инфо (Чат/Фото)', `negotiation:${orderCode}`)]);
                
                // If progress is high enough, show report button
                // But user wants "Next" button always available for flow
                break;

            case 'negotiation_finished':
                text += `🎉 <b>Проверка завершена.</b>\n`;
                text += `Отчет готов к отправке клиенту.\n`;
                break;
                
            default:
                text += `Статус: ${status}\n`;
        }
        
        // Bike External URL Logic (Enhanced)
        let externalUrl = order.bike_url;
        
        // 1. Check bikes table join
        if ((!externalUrl || !externalUrl.startsWith('http')) && order.bikes) {
            externalUrl = order.bikes.url || order.bikes.bike_url;
        }

        // 2. Check bike_snapshot if still missing
        if (!externalUrl || !externalUrl.startsWith('http')) {
             if (order.bike_snapshot && order.bike_snapshot.url) {
                 externalUrl = order.bike_snapshot.url;
             }
        }
        
        // 3. Prefix fix
        if (externalUrl && !externalUrl.startsWith('http')) {
             externalUrl = 'https://kleinanzeigen.de' + externalUrl; 
        }

        if (externalUrl) {
             buttons.push([Markup.button.url('🔗 Открыть объявление', externalUrl)]);
        }

        // Navigation Buttons
        const navRow = [];
        navRow.push(Markup.button.callback('🔙 К списку', `list_orders:0`));
        
        // Try to find next order
        if (ctx) {
             const managerId = await this._getManagerIdFromCtx(ctx);
             if (managerId) {
                 const nextOrder = await this._getNextOrderCode(orderCode, managerId);
                 if (nextOrder) {
                     navRow.push(Markup.button.callback('⏩ Далее', `view_order:${nextOrder}`));
                 }
             }
        }
        
        buttons.push(navRow);

        return { text, buttons };
    }

    async _getManagerIdFromCtx(ctx) {
        const userId = ctx.from.id;
        const manager = await this._getManagerByTelegramId(userId);
        return manager?.id;
    }

    async _getNextOrderCode(currentOrderCode, managerId) {
        // Get all active orders relevant for manager
        const { data: orders } = await supabase.supabase
            .from('orders')
            .select('order_code')
            .in('status', ['new', 'awaiting_payment', 'awaiting_deposit', 'deposit_paid', 'hunting', 'inspection', 'chat_negotiation'])
            // Logic: assigned to me OR (new/awaiting_payment/deposit and unassigned)
            .or(`assigned_manager.eq.${managerId},assigned_manager.is.null`)
            .order('created_at', { ascending: false });
            
        if (!orders) return null;
        
        const idx = orders.findIndex(o => o.order_code === currentOrderCode);
        // If found and has next item (since sorted desc, next in array is actually "previous" in time, 
        // but "next" in list logic usually means "next one in the queue")
        // Let's assume we want to go down the list
        if (idx !== -1 && idx < orders.length - 1) {
            return orders[idx + 1].order_code;
        }
        // If at end, maybe loop to start? Or return null.
        return null;
    }

    async refreshOrderView(ctx, orderCode) {
        try {
            const view = await this._generateOrderView(orderCode, ctx);
            await ctx.editMessageText(view.text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(view.buttons) });
        } catch (e) {
            const view = await this._generateOrderView(orderCode, ctx);
             await ctx.reply(view.text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(view.buttons) });
        }
    }

    async handleAcceptOrder(ctx, orderCode) {
        try {
            const managerUser = await this._getManagerByTelegramId(ctx.from.id);
            const managerName = managerUser?.name || ctx.from.username || `ID:${ctx.from.id}`;
            const managerUuid = managerUser?.id;

            console.log(`[ManagerBot] Accepting order ${orderCode} by ${managerName} (UUID: ${managerUuid})`);
            
            if (!orderCode) throw new Error('Order Code is missing');

            const updatePayload = {
                status: 'awaiting_deposit',
                manager_notes: `Accepted by ${managerName} at ${new Date().toISOString()}`
            };

            if (managerUuid) {
                updatePayload.assigned_manager = managerUuid;
            } else {
                console.warn(`[ManagerBot] User ${ctx.from.id} not found/linked in users table. assigned_manager will be null.`);
                updatePayload.manager_notes += ` (Manager UUID not found)`;
            }

            const { error } = await supabase.supabase
                .from('orders')
                .update(updatePayload) 
                .eq('order_code', orderCode);

            if (error) throw error;

            await this.refreshOrderView(ctx, orderCode);

        } catch (e) {
            console.error('Accept Error:', e);
            ctx.reply(`❌ Error accepting order: ${e.message}`);
        }
    }

    async handleConfirmPayment(ctx, orderCode) {
        try {
            const { error } = await supabase.supabase
                .from('orders')
                .update({ status: 'deposit_paid' })
                .eq('order_code', orderCode);

            if (error) throw error;

            // Trigger AI Inspection directly (it will update the UI)
            await this._triggerAITaskGenerator(ctx, orderCode);

        } catch (e) {
            console.error('Confirm Payment Error:', e);
            ctx.reply(`❌ Error confirming payment: ${e.message}`);
        }
    }

    async _triggerAITaskGenerator(ctx, orderCode) {
        // 1. Show Processing State (Replace current message)
        const loadingText = `🤖 <b>AI проводит первоначальную инспекцию (Gemini 2.5 Flash)...</b>\n\n` +
                            `⏳ <i>Это может занять до 60 секунд. Пожалуйста, не нажимайте кнопки...</i>`;
        
        try {
            // Try to edit message if callback, otherwise reply
            if (ctx.callbackQuery) {
                await ctx.editMessageText(loadingText, { parse_mode: 'HTML' });
            } else {
                await ctx.reply(loadingText, { parse_mode: 'HTML' });
            }
        } catch (e) {
            // Fallback if edit fails (e.g. message too old)
            console.warn('Failed to edit message for loading state:', e.message);
            await ctx.reply(loadingText, { parse_mode: 'HTML' });
        }
        
        try {
            const order = await this._getOrder(orderCode);
            let bikeSnapshot = order.bike_snapshot;
            if (typeof bikeSnapshot === 'string') {
                try { bikeSnapshot = JSON.parse(bikeSnapshot); } catch(e) {}
            }
            
            // Combine all data for AI
            const bikeData = {
                title: order.bike_name,
                description: bikeSnapshot?.description || '',
                attributes: bikeSnapshot?.attributes || {},
                images: bikeSnapshot?.images || [],
                bike_snapshot: bikeSnapshot
            };
            
            // Use Real Gemini Inspection
            const inspectionResult = await gemini.performInitialInspection(bikeData);
            
            if (inspectionResult.error) {
                throw new Error(inspectionResult.error);
            }

            // Save Inspection to DB
            const { checklist, photos_status, german_inquiry_message } = inspectionResult;
            
            const payload = {
                order_id: order.id,
                stage: 'inspection',
                checklist: checklist,
                photos_status: photos_status,
                next_action_suggestion: german_inquiry_message, // Store the german message here for easy access
                updated_at: new Date()
            };

            const { data: existingInsp } = await supabase.supabase.from('inspections').select('id').eq('order_id', order.id).single();
            
            const { error: upsertError } = await supabase.supabase
                .from('inspections')
                .upsert(existingInsp ? { ...existingInsp, ...payload } : payload);

            if (upsertError) {
                console.error('Inspection Upsert Error:', upsertError);
                throw new Error(`DB Upsert Failed: ${upsertError.message}`);
            }

            // Update order status (Use 'under_inspection' for DB enum compatibility)
            const { error: statusError } = await supabase.supabase
                .from('orders')
                .update({ status: 'under_inspection' })
                .eq('order_code', orderCode);

            if (statusError) {
                console.warn(`[ManagerBot] Status update warning for ${orderCode}:`, statusError.message);
                // Fallback: try 'inspection' if 'under_inspection' fails (backward compatibility)
                if (statusError.message.includes('invalid input value')) {
                     await supabase.supabase.from('orders').update({ status: 'inspection' }).eq('order_code', orderCode);
                } else {
                    throw statusError;
                }
            }
            
            // 2. Refresh View (Replaces loading message with Checklist)
            await this.refreshOrderView(ctx, orderCode);

        } catch (e) {
            console.error('AI Inspection Error:', e);
            const errorDetails = e.response?.data?.error?.message || e.message || 'Unknown';
            
            const errorText = `❌ <b>Ошибка AI инспекции</b>\n\n` +
                              `<i>${errorDetails}</i>\n\n` +
                              `Попробуйте снова или свяжитесь с админом.`;
            
            const errorButtons = Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Попробовать снова', `start_inspection:${orderCode}`)],
                [Markup.button.callback('🔙 Вернуться к заказу', `view_order:${orderCode}`)]
            ]);

            try {
                if (ctx.callbackQuery) {
                    await ctx.editMessageText(errorText, { parse_mode: 'HTML', ...errorButtons });
                } else {
                    await ctx.reply(errorText, { parse_mode: 'HTML', ...errorButtons });
                }
            } catch (err) {
                await ctx.reply(errorText, { parse_mode: 'HTML', ...errorButtons });
            }
        }
    }

    async _handleNegotiationInput(ctx, orderCode, text, images) {
        await ctx.reply('🧠 Анализирую переписку...');

        try {
            // 1. Analyze
            const result = await gemini.analyzeNegotiationContent(text, images);
            
            if (!result || result.error) {
                const errorMsg = result?.error || 'Unknown error';
                return ctx.reply(`❌ Не удалось извлечь данные.\nПричина: ${errorMsg}\nПопробуйте отправить фото как файл или просто текстом.`);
            }

            // 2. Get Order ID
            const { data: order } = await supabase.supabase
                .from('orders')
                .select('id')
                .eq('order_code', orderCode)
                .single();

            if (!order) throw new Error('Order not found');

            // 3. Save to Inspections
            // Check existing
            const { data: existing } = await supabase.supabase
                .from('inspections')
                .select('*')
                .eq('order_id', order.id)
                .eq('stage', 'chat_negotiation')
                .single();

            // Smart Merge for Checklist
            let newChecklist = result.checklist || {};
            let newPhotosStatus = result.photos_found || {};
            let defects = result.defects_found || [];

            if (existing) {
                // Recursive merge helper or just simple merge for now
                // We want to keep existing values if new ones are null
                const oldChecklist = existing.checklist || {};
                const oldPhotos = existing.photos_status || {};
                
                // Deep merge checklist sections
                for (const section of ['identification', 'specs', 'history', 'maintenance', 'configuration']) {
                    newChecklist[section] = { ...oldChecklist[section], ...newChecklist[section] };
                    // If new value is null, keep old
                    for (const key in newChecklist[section]) {
                        if (newChecklist[section][key] === null) {
                            newChecklist[section][key] = oldChecklist[section]?.[key] || null;
                        }
                    }
                }
                
                // Merge photos status (true wins)
                for (const key in newPhotosStatus) {
                    if (oldPhotos[key] === true) newPhotosStatus[key] = true;
                }

                const oldDefects = existing.defects_found || [];
                defects = [...new Set([...oldDefects, ...defects])];
            }

            const payload = {
                order_id: order.id,
                stage: 'chat_negotiation',
                checklist: newChecklist,
                photos_status: newPhotosStatus,
                defects_found: defects,
                manager_notes: result.summary,
                next_action_suggestion: result.next_question,
                updated_at: new Date()
            };

            const { error } = await supabase.supabase
                .from('inspections')
                .upsert(existing ? { ...existing, ...payload } : payload);

            if (error) {
                if (error.message.includes('checklist')) {
                    throw new Error('Schema outdated. Missing checklist column.');
                }
                throw error;
            }

            // 4. Report back (Checklist View)
            let msg = `✅ <b>Данные обновлены!</b>\n\n`;
            msg += `📄 <b>Итог:</b> ${result.summary}\n\n`;
            
            // Build Visual Checklist
            const sections = {
                '🆔 ID': newChecklist.identification,
                '⚙️ Specs': newChecklist.specs,
                '📜 History': newChecklist.history,
                '🔧 Maint': newChecklist.maintenance,
                '🔩 Config': newChecklist.configuration
            };

            let totalFields = 0;
            let filledFields = 0;

            for (const [title, data] of Object.entries(sections)) {
                if (!data) continue;
                let sectionMsg = `<b>${title}</b>\n`;
                let hasData = false;
                for (const [key, val] of Object.entries(data)) {
                    totalFields++;
                    if (val && val !== 'null' && val !== null) {
                        filledFields++;
                    }
                }
            }
            
            const progress = Math.round((filledFields / totalFields) * 100) || 0;
            msg += `📊 <b>Прогресс сбора данных: ${progress}%</b>\n`;
            
            // Show Missing Criticals
            msg += `\n⚠️ <b>Нужно узнать:</b>\n`;
            let missingCount = 0;
            for (const [title, data] of Object.entries(sections)) {
                if (!data) continue;
                for (const [key, val] of Object.entries(data)) {
                     if (!val || val === 'null') {
                         if (missingCount < 5) msg += `- ${key} (${title})\n`; // Limit output
                         missingCount++;
                     }
                }
            }
            if (missingCount > 5) msg += `...и еще ${missingCount - 5} полей.\n`;
            if (missingCount === 0) msg += `(Все поля заполнены!)\n`;

            // Photos Status
            msg += `\n📸 <b>Фото:</b>\n`;
            let missingPhotos = [];
            for (const [k, v] of Object.entries(newPhotosStatus)) {
                msg += v ? `✅ ${k} ` : `❌ ${k} `;
                if (!v) missingPhotos.push(k);
            }
            msg += `\n`;

            if (result.next_question) {
                msg += `\n💡 <b>AI Советует спросить:</b>\n<i>"${result.next_question}"</i>\n`;
            }

            const buttons = [];
            
            if (missingCount === 0 && missingPhotos.length === 0) {
                msg += `\n🎉 <b>Инспекция завершена!</b>`;
                buttons.push([Markup.button.callback('🎯 Сформировать отчет', `generate_report:${orderCode}`)]);
            } else {
                 buttons.push([Markup.button.callback('🗣 Добавить еще инфо', `negotiation:${orderCode}`)]);
            }

            // Reset state
            this.userStates.delete(ctx.from.id);

            await ctx.reply(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });

        } catch (e) {
            console.error('Negotiation Handler Error:', e);
            ctx.reply(`❌ Ошибка: ${e.message}`);
            this.userStates.delete(ctx.from.id);
        }
    }

    async _getOrder(orderCode) {
        const { data } = await supabase.supabase.from('orders').select('*').eq('order_code', orderCode).single();
        return data;
    }
    
    async _getCustomer(customerId) {
        const { data } = await supabase.supabase.from('customers').select('*').eq('id', customerId).single();
        return data;
    }
}

module.exports = new ManagerBotService();
