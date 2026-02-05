
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeep() {
    // Check Orders Columns
    console.log('--- ORDERS Columns ---');
    // We can't query information_schema easily via supabase-js unless exposed via rpc, but we can infer from a full select
    const { data: order } = await supabase.from('orders').select('*').limit(1);
    if (order && order.length > 0) {
        console.log(Object.keys(order[0]));
        console.log('Sample:', order[0]);
    }

    // Check Tasks Columns
    console.log('\n--- TASKS Columns ---');
    const { data: task } = await supabase.from('tasks').select('*').limit(1);
    if (task && task.length > 0) {
        console.log(Object.keys(task[0]));
        console.log('Sample:', task[0]);
    }

    // Check Negotiations Columns
    console.log('\n--- NEGOTIATIONS Columns ---');
    const { data: neg } = await supabase.from('negotiations').select('*').limit(1);
    if (neg && neg.length > 0) {
        console.log('Sample:', neg[0]);
    } else console.log('No negotiations found');

    // Check Payments Columns
    console.log('\n--- PAYMENTS Columns ---');
    const { data: pay } = await supabase.from('payments').select('*').limit(1);
    if (pay && pay.length > 0) {
        console.log('Sample:', pay[0]);
    } else console.log('No payments found');

    // Check Shipments Columns
    console.log('\n--- SHIPMENTS Columns ---');
    const { data: ship } = await supabase.from('shipments').select('*').limit(1);
    if (ship && ship.length > 0) {
        console.log('Sample:', ship[0]);
    } else console.log('No shipments found');
}

checkDeep();
