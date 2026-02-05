import 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import axios from 'axios'
import express from 'express'

const token = process.env.TG_CLIENT_BOT_TOKEN
const adminChatId = process.env.TG_ADMIN_CHAT_ID
// Force 3000 if not set, or use specific var
const PORT = process.env.TG_BOT_PORT || 3000
const BASE = process.env.BACKEND_BASE_URL || 'http://localhost:8082/api'

if (!token) {
  console.error('TG_CLIENT_BOT_TOKEN env is required')
  process.exit(1)
}

const bot = new Telegraf(token)
const app = express()
app.use(express.json())

const state = new Map()

// --- Euphoria Constants ---

const STATUS_MAP = {
  'new': '⏳ Бронирование',
  'created': '⏳ Бронирование',
  'pending': '🕵️ Ожидает проверки',
  'searching': '🕵️ Идёт Охота',
  'hunting': '🕵️ Идёт Охота',
  'verified': '✅ Проверен экспертом',
  'found': '✅ Найден',
  'awaiting_payment': '💳 Ожидает оплаты',
  'paid': '💰 Оплачен',
  'preparing': '🛠 Подготовка',
  'shipped': '🚚 В пути',
  'delivered': '📦 Доставлен',
  'completed': '🎉 Завершен',
  'cancelled': '❌ Отменён'
}

const MAIN_KEYBOARD = Markup.keyboard([
  ['📦 Мои заказы', '🔍 Трекинг'],
  ['🚲 Каталог', '🔥 Скидки'],
  ['💬 Личный Консьерж', '⚙️ Настройки']
]).resize()

const MESSAGES = {
  welcome: '👋 *Добро пожаловать в EUBike Premium!*\n\nЯ ваш персональный ассистент по покупке велосипедов из Европы.\n\nВыберите действие в меню ниже: 👇',
  
  trackingAsk: '🔍 *Магический Трекинг*\n\nВведите номер заказа (например `1001`), и я покажу его статус.',
  trackingNotFound: '😔 *Заказ не найден*\n\nВозможно, номер введен с ошибкой?',
  
  supportIntro: '💬 *Личный Консьерж*\n\nВы на прямой линии с вашим персональным менеджером. Опишите вопрос или пожелание — мы ответим мгновенно.',
  supportSent: '📨 *Сообщение отправлено*\nВаш консьерж уже видит его.',
  
  catalogAsk: '🚲 *Поиск в каталоге*\n\nНапишите бренд или модель (например: "Canyon Ultimate").',
  catalogEmpty: '😔 По вашему запросу ничего не найдено.',
  
  dealsEmpty: '❄️ *Тишина в эфире*\n\nГорячих предложений пока нет, но охота продолжается!',
}

// --- Helpers ---

const getStatusEmoji = (status) => {
    if (['new', 'created', 'pending'].includes(status)) return '⏳';
    if (['searching', 'hunting'].includes(status)) return '🕵️';
    if (['verified', 'found'].includes(status)) return '✅';
    if (['paid', 'awaiting_payment'].includes(status)) return '💳';
    if (['shipped'].includes(status)) return '🚚';
    if (['delivered', 'completed'].includes(status)) return '🎉';
    return 'ℹ️';
}

const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'EUR' }).format(price).replace('€', '€');
}

// --- Card Generator ---

const sendOrderCard = async (ctx, orderId, isWelcome = false) => {
    try {
        const r = await axios.get(`${BASE}/v1/crm/orders/${encodeURIComponent(orderId)}`)
        const d = r.data?.data || r.data
        if (!d?.order) throw new Error('Not found')
        
        const order = d.order
        const bike = d.bike || {} // Assuming backend returns bike info in payload if available
        
        // Determine Visuals
        const status = order.status || order.state || 'new'
        const statusText = STATUS_MAP[status] || status
        const emoji = getStatusEmoji(status)
        
        // Caption
        let caption = isWelcome ? `👋 *Привет, ${ctx.from.first_name}!*\n\n` : ''
        caption += `📦 *Заказ #${order.order_number || order.id}*\n`
        caption += `${emoji} Статус: *${statusText}*\n\n`
        
        if (bike.brand) {
            caption += `🚲 *${bike.brand} ${bike.model || ''}*\n`
            if (bike.price) caption += `💶 Бюджет/Цена: *${formatPrice(bike.price)}*\n`
        }
        
        if (order.notes) caption += `\n📝 _${order.notes}_\n`
        
        // Progress Bar (Fake but Euphoric)
        const progressMap = {
            'new': '🟦⬜️⬜️⬜️⬜️',
            'searching': '🟦🟦⬜️⬜️⬜️',
            'verified': '🟦🟦🟦⬜️⬜️',
            'paid': '🟦🟦🟦🟦⬜️',
            'shipped': '🟦🟦🟦🟦🟦'
        }
        const progress = progressMap[status] || '🟦⬜️⬜️⬜️⬜️'
        caption += `\nПрогресс: ${progress}`

        // Dynamic Buttons
        const btns = []
        
        if (['searching', 'hunting'].includes(status)) {
            btns.push([
                Markup.button.callback('🕵️ Прогресс поиска', `progress:${order.id}`),
                Markup.button.callback('📜 Заметки', `notes:${order.id}`)
            ])
        } else if (['verified', 'found'].includes(status)) {
            btns.push([
                Markup.button.callback('📄 Смотреть отчет', `report:${order.id}`),
                Markup.button.url('💳 Оплатить', `http://localhost:5173/checkout/${order.id}`)
            ])
        } else if (['shipped'].includes(status)) {
            btns.push([
                Markup.button.callback('🚚 Где мой байк?', `track:${order.id}`)
            ])
        }
        
        btns.push([Markup.button.callback('💬 Связаться с экспертом', `support_ord:${order.id}`)])
        
        // Send
        const extra = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) }
        
        // If we have an image, send photo
        if (bike.main_image || bike.image_url) {
            const imgUrl = bike.main_image || bike.image_url
            // Handle relative URLs if necessary
            const fullUrl = imgUrl.startsWith('http') ? imgUrl : `http://localhost:8082${imgUrl}`
            try {
                await ctx.replyWithPhoto(fullUrl, { caption, ...extra })
            } catch (e) {
                // Fallback if image fails
                await ctx.reply(caption, extra)
            }
        } else {
            await ctx.reply(caption, extra)
        }
        
        return order
        
    } catch (e) {
        console.error('Card Error:', e)
        await ctx.reply(MESSAGES.trackingNotFound, { parse_mode: 'Markdown' })
        return null
    }
}

// --- Handlers ---

// 1. Deep Linking & Start
bot.start(async (ctx) => {
    const payload = ctx.startPayload
    if (payload) {
        // "Magic" Tracking
        try {
            const r = await axios.post(`${BASE}/tg/consume-link`, { payload })
            if (r.data?.success) {
                const { order_id } = r.data
                // Subscribe
                await axios.post(`${BASE}/tg/subscribe`, { 
                    chat_id: String(ctx.chat.id), 
                    order_id, 
                    user_id: r.data.user_id 
                })
                
                // Show "Euphoric" Card
                await ctx.reply('🚀 *Синхронизация с системой...*', { parse_mode: 'Markdown' })
                await new Promise(r => setTimeout(r, 1000)) // Fake delay for effect
                
                await sendOrderCard(ctx, order_id, true)
                return
            }
        } catch (e) {
            console.error('Deep link error:', e)
        }
    }
    await ctx.reply(MESSAGES.welcome, { parse_mode: 'Markdown', ...MAIN_KEYBOARD })
})

// 2. Tracking
bot.hears('🔍 Трекинг', (ctx) => {
    state.set(ctx.chat.id, { mode: 'await_tracking' })
    ctx.reply(MESSAGES.trackingAsk, { parse_mode: 'Markdown' })
})

// 3. My Orders
bot.hears('📦 Мои заказы', async (ctx) => {
    try {
        const chatId = String(ctx.chat.id)
        const r = await axios.get(`${BASE}/tg/subscriptions/${chatId}`)
        const list = r.data?.subscriptions || []
        
        if (!list.length) {
            return ctx.reply('📭 У вас пока нет активных заказов.', { parse_mode: 'Markdown' })
        }
        
        await ctx.reply(`📋 *Ваши заказы (${list.length}):*`, { parse_mode: 'Markdown' })
        for (const sub of list) {
            await sendOrderCard(ctx, sub.order_id)
        }
    } catch (e) {
        ctx.reply('⚠️ Ошибка загрузки.')
    }
})

// 4. Support (Concierge)
bot.hears(['💬 Личный Консьерж', '💬 Поддержка'], (ctx) => {
    state.set(ctx.chat.id, { mode: 'await_support' })
    ctx.reply(MESSAGES.supportIntro, { parse_mode: 'Markdown', ...Markup.keyboard(['❌ Отмена']).resize() })
})

bot.hears('❌ Отмена', (ctx) => {
    state.delete(ctx.chat.id)
    ctx.reply('Действие отменено.', MAIN_KEYBOARD)
})

// 5. Catalog
bot.hears('🚲 Каталог', (ctx) => {
    state.set(ctx.chat.id, { mode: 'await_catalog' })
    ctx.reply(MESSAGES.catalogAsk, { parse_mode: 'Markdown' })
})

// Text Handler
bot.on('text', async (ctx) => {
    const st = state.get(ctx.chat.id)
    const text = ctx.message.text.trim()
    
    // Admin Reply Handling (Simplified)
    // If Admin replies to a forwarded message, it usually works if bot is admin in group? 
    // Actually, simple "reply" logic needs mapping.
    // For now, we implement User -> Admin forwarding.
    
    if (st && st.mode === 'await_tracking') {
        await sendOrderCard(ctx, text)
        state.delete(ctx.chat.id)
        return
    }
    
    if (st && st.mode === 'await_catalog') {
        // ... (Catalog logic similar to previous, simplified here)
         try {
            const r = await axios.get(`${BASE}/catalog/bikes`, { params: { search: text, limit: 3 } })
            const items = r.data?.bikes || []
            if (!items.length) {
                await ctx.reply(MESSAGES.catalogEmpty)
            } else {
                for (const b of items) {
                    const caption = `🚲 *${b.brand} ${b.model}*\n💶 *${b.price} €*\n\n${b.description ? b.description.slice(0, 100) + '...' : ''}`
                    const btns = Markup.inlineKeyboard([Markup.button.url('🔗 Открыть', `http://localhost:5173/product/${b.id}`)])
                    await ctx.reply(caption, { parse_mode: 'Markdown', ...btns })
                }
            }
        } catch (e) {
            ctx.reply('⚠️ Ошибка поиска.')
        }
        state.delete(ctx.chat.id)
        return
    }
    
    if (st && st.mode === 'await_support') {
        // Forward to Admin
        if (adminChatId) {
            const forwardMsg = `📩 *Вопрос от клиента* (@${ctx.from.username || 'id'+ctx.from.id}):\n\n${text}\n\n_Ответьте командой /reply ${ctx.chat.id} ВашОтвет_`
            await ctx.telegram.sendMessage(adminChatId, forwardMsg, { parse_mode: 'Markdown' })
        }
        await ctx.reply(MESSAGES.supportSent, { parse_mode: 'Markdown', ...MAIN_KEYBOARD })
        state.delete(ctx.chat.id)
        return
    }
})

// Admin Reply Command
bot.command('reply', async (ctx) => {
    // Format: /reply CHAT_ID MESSAGE
    const parts = ctx.message.text.split(' ')
    if (parts.length < 3) return
    
    const targetId = parts[1]
    const msg = parts.slice(2).join(' ')
    
    try {
        await ctx.telegram.sendMessage(targetId, `👨‍💼 *Ответ Консьержа:*\n\n${msg}`, { parse_mode: 'Markdown' })
        await ctx.reply('✅ Ответ отправлен.')
    } catch (e) {
        await ctx.reply('❌ Ошибка отправки: ' + e.message)
    }
})

// Callbacks
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data
    // ... Implement logic for 'progress:', 'notes:', 'report:'
    // For Euphoria Demo, just show alert
    if (data.startsWith('progress:')) {
        await ctx.answerCbQuery('🕵️ Инспектор уже в пути! Проверяем 12 точек рамы...')
    } else if (data.startsWith('notes:')) {
        await ctx.answerCbQuery('📝 Заметок пока нет.')
    } else if (data.startsWith('report:')) {
        await ctx.answerCbQuery('📄 Отчет загружается...')
        // Could send a PDF or link
    } else if (data.startsWith('support_ord:')) {
        state.set(ctx.chat.id, { mode: 'await_support' })
        await ctx.reply(MESSAGES.supportIntro, { parse_mode: 'Markdown', ...Markup.keyboard(['❌ Отмена']).resize() })
        await ctx.answerCbQuery()
    }
})

// --- Internal API for Webhooks ---

app.post('/webhook/bounty', async (req, res) => {
    // { chat_id, bike_name, price, discount, image_url, link }
    const { chat_id, bike_name, price, discount, image_url, link } = req.body
    
    if (!chat_id) return res.status(400).send('No chat_id')
    
    const caption = `🎯 *ПРЯМОЕ ПОПАДАНИЕ! (Bounty)*\n\n` +
                    `🚲 *${bike_name}*\n` +
                    `💶 Цена: *${price}* (Выгода: *${discount}*)\n\n` +
                    `🟢 *Grade A (Идеальное состояние)*\n\n` +
                    `_Инспектор нашел этот байк специально для вас. Успейте забрать!_`
                    
    const btns = Markup.inlineKeyboard([
        [Markup.button.url('⚡️ Забрать сейчас', link || 'http://localhost:5173')],
        [Markup.button.callback('👀 Подробнее', 'bounty_details')]
    ])
    
    try {
        if (image_url) {
            await bot.telegram.sendPhoto(chat_id, image_url, { caption, parse_mode: 'Markdown', ...btns })
        } else {
            await bot.telegram.sendMessage(chat_id, caption, { parse_mode: 'Markdown', ...btns })
        }
        res.json({ success: true })
    } catch (e) {
        console.error('Bounty send error:', e)
        res.status(500).json({ error: e.message })
    }
})

app.post('/webhook/notify', async (req, res) => {
    const { chat_id, text, image_url } = req.body
    try {
        if (image_url) {
            await bot.telegram.sendPhoto(chat_id, image_url, { caption: text, parse_mode: 'Markdown' })
        } else {
            await bot.telegram.sendMessage(chat_id, text, { parse_mode: 'Markdown' })
        }
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

// --- Launch ---

// Start Express
app.listen(PORT, () => {
    console.log(`🤖 Bot API listening on port ${PORT}`)
})

// Start Bot
bot.launch()
  .then(() => console.log('🚀 User Euphoria Bot 2.0 started!'))
  .catch((e) => console.error('Bot launch failed:', e))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
