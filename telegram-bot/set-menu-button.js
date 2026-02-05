const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.ADMIN_BOT_TOKEN;
const adminId = process.env.ADMIN_CHAT_ID || process.env.ADMINCHATID;
const appUrl = process.env.ADMIN_APP_URL || 'https://t.me/EUBikeAdminBot/app'; // Adjust if using direct link

if (!token) {
    console.error('❌ ADMIN_BOT_TOKEN is missing');
    process.exit(1);
}

const bot = new TelegramBot(token);

async function setMenuButton() {
    try {
        console.log(`Setting menu button for Admin ID: ${adminId}...`);
        
        // Set for specific chat (Admin only)
        await bot.setChatMenuButton({
            chat_id: adminId,
            menu_button: JSON.stringify({
                type: 'web_app',
                text: 'Open Admin',
                web_app: { url: appUrl }
            })
        });

        console.log('✅ Menu Button set successfully!');
    } catch (error) {
        console.error('❌ Failed to set menu button:', error.message);
    }
}

setMenuButton();
