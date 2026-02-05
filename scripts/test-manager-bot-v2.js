
const managerBot = require('../backend/src/services/ManagerBotService');
const bookingService = require('../backend/src/services/BookingService');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

// Force bot to notify even if not triggered by booking (Mock)
async function testBot() {
    console.log('🤖 Testing Manager Bot V2.0 Notification...');
    
    const mockOrder = {
        order_code: 'ORD-TEST-999',
        bike_name: 'Specialized S-Works Tarmac SL7',
        final_price_eur: 4500,
        total_price_rub: 450000,
        booking_amount_rub: 9000,
        delivery_method: 'Premium',
        exchange_rate: 100,
        bike_url: 'https://www.kleinanzeigen.de/s-anzeige/specialized-s-works-tarmac-sl7/test'
    };
    
    const mockCustomer = {
        full_name: 'Test Manager User',
        phone: '+79991234567',
        email: 'manager@test.com'
    };
    
    try {
        await managerBot.notifyNewBooking(mockOrder, { location: 'Berlin' }, mockCustomer);
        console.log('✅ Notification sent (Check Telegram)');
    } catch (e) {
        console.error('❌ Notification failed:', e.message);
    }
    
    // Keep alive briefly to allow async send
    setTimeout(() => process.exit(0), 5000);
}

testBot();
