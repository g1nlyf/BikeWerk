
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lclalsznmrjgqsgaqtps.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbGFsc3pubXJqZ3FzZ2FxdHBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk3ODkwOCwiZXhwIjoyMDc2NTU0OTA4fQ.NIGp4ueVE74uwmhFn1AH8yzhtVmm7SCRmDz2-2cBHqA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- CHECKING RECENT DATA ---');

    // 1. Check latest lead/order
    const { data: leads, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (leadError) console.error('Lead Error:', leadError);
    else console.log('Latest Lead:', leads.length > 0 ? leads[0] : 'None');

    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('*, customer:customers(*)')
        .order('created_at', { ascending: false })
        .limit(1);

    if (orderError) console.error('Order Error:', orderError);
    else {
        const order = orders && orders.length > 0 ? orders[0] : null;
        console.log('Latest Order:', order);
        if (order) {
            console.log('  -> Customer ID Match:', order.customer_id === order.customer?.id);
            console.log('  -> Bike Snapshot Present:', !!order.bike_snapshot);
            console.log('  -> Checklist:', order.bike_snapshot?.inspection_data?.checklist?.slice(0, 5));
            console.log('  -> Assignee:', order.assignee);
            console.log('  -> Status:', order.order_status);
        }
    }

    // 2. Check transactions
    if (orders && orders.length > 0) {
        const orderId = orders[0].id;
        const { data: trans, error: transError } = await supabase
            .from('transactions')
            .select('*')
            .eq('order_id', orderId);

        if (transError) console.error('Trans Error:', transError);
        else console.log('Transactions for latest order:', trans);

        // 3. Check shipments
        const { data: ships, error: shipError } = await supabase
            .from('shipments')
            .select('*')
            .eq('order_id', orderId);

        if (shipError) console.error('Ship Error:', shipError);
        else console.log('Shipments for latest order:', ships);
    }
}

checkData();
