const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Hardcode path to .env in backend/
const SUPABASE_URL = 'https://lclalsznmrjgqsgaqtps.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbGFsc3pubXJqZ3FzZ2FxdHBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk3ODkwOCwiZXhwIjoyMDc2NTU0OTA4fQ.NIGp4ueVE74uwmhFn1AH8yzhtVmm7SCRmDz2-2cBHqA';

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
