const supabase = require('../backend/src/services/supabase');
const managerBot = require('../backend/src/services/ManagerBotService');

// Force-Mock user 1076231865 as target
const TARGET_TELEGRAM_ID = 1076231865;

async function runEmergencyTest() {
    console.log('🚨 Starting Emergency Bot Test...');
    
    // 1. Fetch ANY valid order to use as payload
    const { data: order, error } = await supabase.supabase
        .from('orders')
        .select('*')
        .limit(1)
        .single();

    if (error || !order) {
        console.error('❌ No orders found in DB. Create one first.');
        process.exit(1);
    }

    console.log(`📦 Using Order: ${order.order_code}`);

    // 2. Construct Notification Payload
    // FIX: bike_url must be absolute for Telegram button
    let bikeUrl = order.bike_url || 'https://buycycle.com/test';
    if (!bikeUrl.startsWith('http')) {
        bikeUrl = 'https://eubike.ru' + bikeUrl;
    }

    const bike = {
        bike_url: bikeUrl,
        bike_name: order.bike_name || 'Test Bike'
    };

    const customer = {
        full_name: 'Test Customer',
        phone: '+79990000000',
        email: 'test@test.com',
        preferred_channel: 'telegram',
        contact_value: '@test_user'
    };

    const options = {
        manager: { username: 'Vlad' },
        tasks: ['Test Task 1', 'Test Task 2']
    };

    // 3. Force Send via Bot
    // We bypass the internal _getManagers() and send directly to TARGET_TELEGRAM_ID
    console.log(`📨 Sending notification to ${TARGET_TELEGRAM_ID}...`);
    
    try {
        // We can't easily access bot instance from outside class if it's not exposed.
        // But managerBot exports an instance of ManagerBotService.
        // Let's monkey-patch _getManagers for this test OR just add a direct send method.
        // Actually, notifyNewOrder calls _getManagers. Let's mock it.
        
        managerBot._getManagers = async () => [TARGET_TELEGRAM_ID];
        
        await managerBot.notifyNewOrder(order, bike, customer, options);
        console.log('✅ Notification sent (check Telegram).');
        
    } catch (e) {
        console.error('❌ Failed to send:', e);
    }
}

runEmergencyTest();
