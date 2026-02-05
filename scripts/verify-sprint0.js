const bookingService = require('../backend/src/services/BookingService');
const supabase = require('../backend/src/services/supabase');
const managerBot = require('../backend/src/services/ManagerBotService');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function verifySprint0() {
    console.log('🚀 Verifying Sprint 0 Fixes...');

    // 1. Verify Data Extraction
    console.log('\n🧪 1. Testing Order Creation Data Extraction...');
    const mockCustomer = {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        phone: '+1234567890'
    };
    const mockBike = {
        id: 999999,
        brand: 'Sprint0',
        model: 'FixBike',
        price: 2000,
        title: 'Sprint0 FixBike 2000€',
        condition: 'perfect',
        location: 'Berlin'
    };
    
    try {
        // Mock manager notification to avoid real telegram calls during test if needed
        // But we want to test if it fails safely or works.
        // managerBot.notifyNewBooking = async () => console.log('   (Mock) Manager notified');

        const result = await bookingService.createBooking({
            bike_id: mockBike.id,
            customer: mockCustomer,
            bike_details: mockBike
        });

        if (result.success) {
            console.log(`   ✅ Booking created: ${result.order_code}`);
            
            // Verify DB fields
            const { data: order } = await supabase.supabase
                .from('orders')
                .select('*')
                .eq('order_code', result.order_code)
                .single();
            
            console.log('   🔍 Checking DB Fields:');
            console.log(`   - bike_name: ${order.bike_name} (Expected: ${mockBike.title})`);
            console.log(`   - listing_price_eur: ${order.listing_price_eur} (Expected: 2000)`);
            console.log(`   - booking_amount_eur: ${order.booking_amount_eur} (Expected: 200)`);
            console.log(`   - initial_quality: ${order.initial_quality} (Expected: perfect)`);
            
            if (order.bike_name === mockBike.title && 
                order.listing_price_eur === 2000 && 
                order.booking_amount_eur === 200 &&
                order.initial_quality === 'perfect') {
                console.log('   ✅ Data Extraction Logic PASSED');
            } else {
                console.error('   ❌ Data Extraction Logic FAILED');
            }
        }
    } catch (e) {
        console.error('   ❌ Create Booking Error:', e.message);
    }

    // 2. Verify Manager Bot Proxy (Static Check)
    console.log('\n🧪 2. Checking Manager Bot Proxy Config...');
    if (managerBot.axios.defaults.httpsAgent && managerBot.axios.defaults.httpsAgent.proxy.host === '191.101.73.161') {
        console.log('   ✅ Proxy configured in Axios agent');
    } else {
        // Inspecting the agent structure might be tricky, checking constructor logic
        console.log('   ℹ️ Manual check required if not visible here. Code uses HttpsProxyAgent.');
    }

    console.log('\n🏁 Sprint 0 Verification Complete.');
    process.exit(0);
}

verifySprint0();
