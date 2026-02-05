
const { Telegraf } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Config
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.MANAGER_BOT_TOKEN || '';
const PROXY_URL = process.env.GEMINI_PROXY_URL || process.env.PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
const ADMIN_ID = process.env.ADMIN_CHAT_ID || '';

async function checkBot() {
    console.log('🤖 Bot Emergency Check Started...');
    if (!BOT_TOKEN) {
        throw new Error('BOT_TOKEN is not configured');
    }
    if (!ADMIN_ID) {
        throw new Error('ADMIN_CHAT_ID is not configured');
    }
    console.log(`📡 Using Proxy: ${PROXY_URL || 'none'}`);

    try {
        const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;
        
        // Telegraf Instance with Proxy
        const bot = new Telegraf(BOT_TOKEN, {
            telegram: {
                agent: agent
            }
        });

        // 1. Get Me (Connectivity Test)
        console.log('🔍 Checking connectivity (getMe)...');
        const me = await bot.telegram.getMe();
        console.log(`✅ Connected as @${me.username} (ID: ${me.id})`);

        // 2. Send Message
        console.log(`📨 Sending "System Online" to ${ADMIN_ID}...`);
        await bot.telegram.sendMessage(ADMIN_ID, '🚨 System Online: Proxy Check Passed (Telegraf)');
        console.log('✅ Message sent successfully.');

    } catch (error) {
        console.error('❌ Bot Check Failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

checkBot();
