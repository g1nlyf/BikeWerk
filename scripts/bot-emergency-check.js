
const { Telegraf } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Config
const BOT_TOKEN = '8422123572:AAEOO0PoP3QOmkgmpa53USU_F24hJdSNA3g';
const PROXY_URL = 'http://user258350:otuspk@191.101.73.161:8984';
const ADMIN_ID = '183921355';

async function checkBot() {
    console.log('🤖 Bot Emergency Check Started...');
    console.log(`📡 Using Proxy: ${PROXY_URL}`);

    try {
        const agent = new HttpsProxyAgent(PROXY_URL);
        
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
