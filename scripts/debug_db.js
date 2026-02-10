const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Use env vars; never hardcode credentials.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL and/or SUPABASE_* key env vars.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugOrder() {
    console.log('🔍 Inspecting TASKS table...');
    const { data: sample, error } = await supabase
        .from('tasks')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error fetching tasks:', error);
    } else if (sample && sample.length > 0) {
        console.log('✅ Sample Task Columns:', Object.keys(sample[0]));
    } else {
        console.log('⚠️ No tasks found, cannot inspect columns easily via SELECT *');
        // Try inserting a dummy task to fail and see error, or just assume empty
    }
}

debugOrder();
