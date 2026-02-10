// Debug helper: use env vars; never hardcode keys.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY;
const db = null; // No local DB needed for this test

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and/or SUPABASE_* key env vars.');
}

console.log('Connecting to Supabase URL (redacted).');
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    console.log('\n--- Checking ORDERS ---');
    // Test 1: Simple Select
    let { data, error } = await supabase.from('orders').select('count', { count: 'exact', head: true });
    if (error) {
        console.error('Orders HEAD Error:', error.message);
    } else {
        console.log('Orders table exists. Count:', data); // data is null for HEAD, count is in count
    }

    // Test 2: Filter by status
    console.log('Testing filter by status "pending_manager"...');
    ({ data, error } = await supabase
        .from('orders')
        .select('id, status')
        .eq('status', 'pending_manager')
        .limit(1));

    if (error) console.error('Orders Filter Error:', error);
    else console.log('Orders Filter Success:', data);
}

async function checkLeads() {
    console.log('\n--- Checking LEADS ---');
    // Test 1: Check "leads" table
    let { error: err1 } = await supabase.from('leads').select('count', { count: 'exact', head: true });
    if (err1) console.log('"leads" table check failed:', err1.message);
    else console.log('"leads" table exists.');

    // Test 2: Check "applications" table
    let { error: err2 } = await supabase.from('applications').select('count', { count: 'exact', head: true });
    if (err2) console.log('"applications" table check failed:', err2.message);
    else console.log('"applications" table exists.');

    // Test Upgrade
    const tableName = !err1 ? 'leads' : (!err2 ? 'applications' : null);
    if (!tableName) {
        console.error('Neither "leads" nor "applications" table found!');
        return;
    }

    console.log(`Using table: ${tableName}`);
    const { data: leads } = await supabase.from(tableName).select('id').limit(1);

    if (leads && leads.length > 0) {
        console.log('Attempting update on lead:', leads[0].id);
        const { error } = await supabase
            .from(tableName)
            .update({ application_notes: 'Debug update ' + new Date().toISOString() })
            .eq('id', leads[0].id);

        if (error) console.error('Update Error:', error);
        else console.log('Update Success');
    } else {
        console.log('No leads found to update.');
    }
}

(async () => {
    await checkOrders();
    await checkLeads();
})();
