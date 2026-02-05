const bookingService = require('../backend/src/services/BookingService');
const supabase = require('../backend/src/services/supabase');

async function verifySprint2() {
    try {
        console.log('🚀 Starting Sprint 2 Verification...');

        const payload = {
            bike_id: 'test-ems-bike',
            customer: {
                name: 'Trae Test',
                email: 'trae@test.com',
                phone: '+1234567890',
                full_name: 'Trae Test Fullname' // Testing persistence
            },
            bike_details: {
                brand: 'Specialized',
                model: 'Tarmac SL7',
                price: 1000,
                image_url: 'http://test.com/image.jpg',
                bike_url: 'http://mobile.de/s-works-tarmac' // Testing persistence
            },
            // Frontend might send these, but backend should recalculate
            total_price_rub: 0, 
            booking_amount_rub: 0,
            exchange_rate: 105,
            final_price_eur: 0,
            delivery_method: 'EMS' // Testing Logic Sync
        };

        console.log('📦 Creating Booking with EMS...');
        const result = await bookingService.createBooking(payload);
        console.log('✅ Booking Created:', result.order_code);

        // Fetch Order and Lead to verify
        const { data: order } = await supabase.supabase
            .from('orders')
            .select('*, lead:leads(*), customer:customers(*)')
            .eq('order_code', result.order_code)
            .single();

        console.log('\n📊 VERIFICATION RESULTS:');
        
        // 1. Check Delivery Method
        const isEMS = order.delivery_method === 'EMS';
        console.log(`[${isEMS ? 'PASS' : 'FAIL'}] Delivery Method: ${order.delivery_method} (Expected: EMS)`);

        // 2. Check Bike URL (in Lead)
        const leadUrl = order.lead.bike_url;
        const isUrlSaved = leadUrl === 'http://mobile.de/s-works-tarmac';
        console.log(`[${isUrlSaved ? 'PASS' : 'FAIL'}] Bike URL Saved: ${leadUrl}`);

        // 3. Check Full Name
        const customerName = order.customer.full_name;
        const isNameSaved = customerName === 'Trae Test Fullname';
        console.log(`[${isNameSaved ? 'PASS' : 'FAIL'}] Customer Full Name: ${customerName}`);

        // 4. Check Price Calculation (EMS vs Cargo)
        // 1000 + 220(EMS) + 40(Ins) + 85.4(Fee) + 250(Margin) = 1595.4 EUR
        // 1595.4 * 105 = 167,517 RUB
        const expectedEur = 1595.4;
        const actualEur = order.final_price_eur;
        const diff = Math.abs(actualEur - expectedEur);
        const isPriceCorrect = diff < 1.0; // Allow small rounding diff
        console.log(`[${isPriceCorrect ? 'PASS' : 'FAIL'}] Price Check: ${actualEur} EUR (Expected ~${expectedEur})`);

        if (isEMS && isUrlSaved && isNameSaved && isPriceCorrect) {
            console.log('\n🎉 SPRINT 2 VERIFIED SUCCESSFULLY!');
        } else {
            console.error('\n❌ VERIFICATION FAILED');
        }

        // Print JSON for user
        console.log('\n📄 ORDER JSON:');
        console.log(JSON.stringify(order, null, 2));

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

verifySprint2();
