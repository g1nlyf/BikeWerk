const bookingService = require('../backend/src/services/BookingService');
const supabase = require('../backend/src/services/supabase');

async function verifySprint2Final() {
    try {
        console.log('🚀 Starting Sprint 2.1 Verification...');

        const payload = {
            bike_id: 'test-ems-final',
            customer: {
                name: 'Trae Final',
                email: 'trae@final.com',
                phone: '+1234567890',
                full_name: 'Trae Final Fullname'
            },
            bike_details: {
                brand: 'Canyon',
                model: 'Ultimate',
                price: 2000,
                image_url: 'http://test.com/image.jpg',
                bike_url: 'http://mobile.de/canyon-ultimate', // Must be saved to orders.bike_url
                shipping_option: 'EMS'
            },
            total_price_rub: 0, 
            booking_amount_rub: 0,
            exchange_rate: 105,
            final_price_eur: 0,
            delivery_method: 'EMS'
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

        // 2. Check Bike URL (Directly in Orders)
        const orderUrl = order.bike_url;
        const isOrderUrlSaved = orderUrl === 'http://mobile.de/canyon-ultimate';
        console.log(`[${isOrderUrlSaved ? 'PASS' : 'FAIL'}] Bike URL (Orders Table): ${orderUrl}`);

        // 3. Check Full Name
        const customerName = order.customer.full_name;
        const isNameSaved = customerName === 'Trae Final Fullname';
        console.log(`[${isNameSaved ? 'PASS' : 'FAIL'}] Customer Full Name: ${customerName}`);

        // 4. Check Price Calculation (EMS vs Cargo)
        // 2000 + 220(EMS) + 80(Ins) + 155.4(Fee) + 400(Margin) = 2855.4 EUR
        // 2855.4 * 105 = 299,817 RUB
        const expectedEur = 2855.4;
        const actualEur = order.final_price_eur;
        const diff = Math.abs(actualEur - expectedEur);
        const isPriceCorrect = diff < 1.0; 
        console.log(`[${isPriceCorrect ? 'PASS' : 'FAIL'}] Price Check: ${actualEur} EUR (Expected ~${expectedEur})`);

        if (isEMS && isOrderUrlSaved && isNameSaved && isPriceCorrect) {
            console.log('\n🎉 SPRINT 2.1 VERIFIED SUCCESSFULLY!');
        } else {
            console.error('\n❌ VERIFICATION FAILED');
        }

        console.log('\n📄 ORDER JSON:');
        console.log(JSON.stringify(order, null, 2));

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

verifySprint2Final();
