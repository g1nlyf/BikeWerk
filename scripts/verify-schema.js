const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function verifySchema() {
    console.log('🔍 Verifying Schema for Sprint 2...');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Missing Supabase credentials');
        process.exit(1);
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Check negotiations table
    console.log('Checking negotiations table...');
    const { data, error } = await supabase.from('negotiations').select('id').limit(1);
    
    if (error) {
        console.error('❌ Negotiations table check failed:', error.message);
        console.log('⚠️  ACTION REQUIRED: Run backend/migrations/sprint2_manager_copilot.sql in Supabase SQL Editor.');
    } else {
        console.log('✅ Negotiations table exists.');
    }

    // 2. Check tasks table columns
    console.log('Checking tasks table columns...');
    // We try to select the new column. If it fails, the column likely doesn't exist.
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('ai_generated').limit(1);
    
    if (tasksError) {
        console.error('❌ Tasks table column check failed:', tasksError.message);
        console.log('⚠️  ACTION REQUIRED: Run backend/migrations/sprint2_manager_copilot.sql in Supabase SQL Editor.');
    } else {
        console.log('✅ Tasks table has ai_generated column.');
    }
}

verifySchema();
