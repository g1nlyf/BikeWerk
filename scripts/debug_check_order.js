
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificOrder() {
    const id = 'ORD-20260111-0279';
    console.log(`Checking order ${id}...`);
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
    
    if (data) {
        console.log('Found:', data.id);
    } else {
        console.log('Not found via ID:', error?.message);
        // Try code
        const { data: d2 } = await supabase.from('orders').select('*').eq('order_code', id).single();
        if (d2) console.log('Found via Code:', d2.id);
        else console.log('Not found via Code either');
    }
}

checkSpecificOrder();
