require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://lclalsznmrjgqsgaqtps.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbGFsc3pubXJqZ3FzZ2FxdHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5Nzg5MDgsImV4cCI6MjA3NjU1NDkwOH0.nyTQDoddHyrY4_QizmQFLue8EjNqeQaJ0U021Hbc7YI'
);

async function inspect() {
    console.log('🔍 Probing Status Enum...');
    
    // Attempt to insert with invalid value to see error message which usually lists valid enums
    const { error } = await supabase
        .from('orders')
        .insert({
            order_code: `TEST-${Date.now()}`,
            status: 'INVALID_ENUM_PROBE' 
        });

    if (error) {
        console.log('Error Message:', error.message);
    } else {
        console.log('Unexpected success (should have failed)');
    }
}

inspect();