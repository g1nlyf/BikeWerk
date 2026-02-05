const supabase = require('../backend/src/services/supabase');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function checkDbIntegrity() {
    console.log('🚀 Checking DB Integrity (Last 5 Orders)...');

    const { data: orders, error } = await supabase.supabase
        .from('orders')
        .select('order_code, bike_name, listing_price_eur, final_price_eur, booking_amount_eur, initial_quality, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Failed to fetch orders:', error.message);
        process.exit(1);
    }

    console.table(orders);

    let failed = false;
    for (const order of orders) {
        const issues = [];
        if (!order.bike_name) issues.push('Missing bike_name');
        if (!order.listing_price_eur) issues.push('Missing listing_price_eur');
        if (!order.initial_quality) issues.push('Missing initial_quality');
        if (order.booking_amount_eur === 0 && order.status !== 'new') issues.push('booking_amount_eur is 0');

        if (issues.length > 0) {
            console.error(`⚠️ Order ${order.order_code} has issues: ${issues.join(', ')}`);
            failed = true;
        } else {
            console.log(`✅ Order ${order.order_code} is HEALTHY.`);
        }
    }

    if (failed) {
        console.error('\n❌ DB Integrity Check FAILED: Some orders have missing fields.');
    } else {
        console.log('\n✅ DB Integrity Check PASSED: All recent orders have required fields.');
    }
    
    process.exit(0);
}

checkDbIntegrity();
