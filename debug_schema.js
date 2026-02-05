
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Testing ID vs OrderCode...');
    
    const orderCode = 'G1nlyF';

    // Test 1: Query by ID (expect error)
    console.log(`Test 1: Querying 'id' with "${orderCode}"...`);
    const { error: idError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderCode);
        
    if (idError) {
        console.log('Test 1 Result: Error as expected:', idError.message);
    } else {
        console.log('Test 1 Result: No error (Unexpected if id is UUID)');
    }

    // Test 2: Query by order_code (expect success)
    console.log(`Test 2: Querying 'order_code' with "${orderCode}"...`);
    const { error: codeError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_code', orderCode);
        
    if (codeError) {
        console.log('Test 2 Result: Error:', codeError.message);
    } else {
        console.log('Test 2 Result: Success');
    }
}

checkSchema();
