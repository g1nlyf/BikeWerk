const supabaseService = require('../src/services/supabase');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../telegram-bot/.env') });

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.ADMIN_BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';

async function checkStaleOrders() {
    console.log('🕵️ CRM Monitor: Checking for stale orders...');
    
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
        console.warn('⚠️ BOT_TOKEN / ADMIN_CHAT_ID missing. Skipping Telegram alerts.');
        return;
    }

    const staleOrders = await supabaseService.listActiveOrders();
    console.log(`Found ${staleOrders.length} stale orders.`);

    for (const order of staleOrders) {
        if (!ADMIN_CHAT_ID) continue;

        const message = `
⚠️ **Внимание: Зависший заказ**
Заказ #${order.order_code}
Статус: ${order.status}
Не обновлялся более 24 часов.

👉 /order ${order.order_code}
`;
        try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: ADMIN_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            });
            console.log(`Sent alert for ${order.order_code}`);
        } catch (e) {
            console.error(`Failed to send alert: ${e.message}`);
        }
    }
}

// Run if called directly
if (require.main === module) {
    checkStaleOrders()
        .then(() => process.exit(0))
        .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { checkStaleOrders };
