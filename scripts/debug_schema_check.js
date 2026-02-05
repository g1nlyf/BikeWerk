
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking Orders...');
    const { data: order, error: orderError } = await supabase.from('orders').select('id, old_uuid_id').limit(1).single();
    if (order) {
        console.log('Order Sample:', order);
        console.log('Order ID Type:', typeof order.id);
        console.log('Order UUID Type:', typeof order.old_uuid_id);
    } else {
        console.log('Error fetching order:', orderError);
    }

    console.log('\nChecking Inspections...');
    const { data: insp, error: inspError } = await supabase.from('inspections').select('id, order_id').limit(1);
    if (insp && insp.length > 0) {
        console.log('Inspection Sample:', insp[0]);
        console.log('Inspection Order ID Type:', typeof insp[0].order_id);
    } else {
        console.log('Error fetching inspection:', inspError);
        // Try inserting a dummy to check error if table exists
    }

    console.log('\nChecking Tasks...');
    const { data: task, error: taskError } = await supabase.from('tasks').select('id, order_id').limit(1);
    if (task && task.length > 0) {
        console.log('Task Sample:', task[0]);
        console.log('Task Order ID Type:', typeof task[0].order_id);
    } else {
        console.log('Error fetching task:', taskError);
    }
}

checkSchema();
