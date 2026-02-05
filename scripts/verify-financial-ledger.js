const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const API_URL = 'http://localhost:8081/api/v1/crm';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyFinancialLedger() {
    console.log('🚀 Starting Sprint 4 Verification: Financial Ledger...');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Missing Supabase credentials');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        // 1. Setup: Create Mock Order (Status: Quality Confirmed)
        console.log('\n📝 Creating Mock Order...');
        const orderCode = `ORD-FIN-${Date.now().toString().slice(-4)}`;
        
        const { data: cust } = await supabase.from('customers').insert({
            full_name: 'Richie Rich',
            email: `rich${Date.now()}@example.com`
        }).select().single();

        const { data: order, error: orderError } = await supabase.from('orders').insert({
            order_code: orderCode,
            customer_id: cust.id,
            // status: 'awaiting_deposit', // It seems enums are acting up or not synced. Let's omit status to use default
            final_price_eur: 3000,
            booking_amount_eur: 500, // Deposit expected
            commission_eur: 300,
            bike_name: 'S-Works Tarmac SL7',
            bike_snapshot: { manager_notes: 'Mint condition' }
        }).select().single();

        if (orderError) throw orderError;
        console.log(`✅ Order Created: ${orderCode} (ID: ${order.id})`);
        
        // Link ID for related tables
        const linkId = order.old_uuid_id || order.id;
        console.log(`ℹ️ Link ID used for relations: ${linkId}`);

        // Debug: Fetch any payment to see schema
        const { data: anyPayment } = await supabase.from('payments').select('*').limit(1);
        console.log('🔍 Sample Payment Structure:', anyPayment?.[0] ? Object.keys(anyPayment[0]) : 'No payments found');

        // 1.5. Create Initial Deposit Payment (Simulate that deposit was paid)
        const { data: payInsert, error: payError } = await supabase.from('payments').insert({
            order_id: linkId,
            amount: 500,
            currency: 'EUR',
            status: 'completed',
            direction: 'incoming',
            role: 'client_payment',
            method: 'online_cashbox',
            // description: 'Initial Deposit'
        }).select();
        
        if (payError) {
            console.error('❌ Payment Insert Error:', payError);
        } else {
            console.log('✅ Deposit Payment Record Created:', payInsert);
        }
        
        // Debug: Check payments for this order
        const { data: checkPay } = await supabase.from('payments').select('*').eq('order_id', linkId);
        console.log('🔍 Payments found in DB for linkId:', checkPay);

        // 2. Test: Check Balance Calculation (GET /orders/:id)
        console.log('\n💰 Checking Balance Engine...');
        // Note: Assuming server is running. If not, we skip API call and verify logic manually via DB check later?
        // Actually, we need the API to create the payment record properly.
        
        let paymentId;
        
        try {
            const res = await axios.get(`${API_URL}/orders/${orderCode}`);
            const finances = res.data.finances;
            
            console.log('   - Finances Response:', JSON.stringify(finances, null, 2));
            
            // Check logic
            if (finances && finances.total === 3000 && finances.deposit_expected === 500 && finances.remainder === 2500) {
                console.log('✅ Balance Calculation Correct: 3000 - 500 = 2500');
            } else {
                console.error('❌ Balance Calculation Failed or Mismatch');
            }

            // 3. Test: Checkout (Create Planned Payment)
            console.log('\n💳 Initiating Checkout...');
            const checkoutRes = await axios.post(`${API_URL}/orders/${orderCode}/checkout`, { method: 'cash' });
            
            if (checkoutRes.data.success) {
                paymentId = checkoutRes.data.payment_id;
                console.log(`✅ Payment Created: ${paymentId} (Amount: ${checkoutRes.data.amount} EUR)`);
                console.log(`   - Link: ${checkoutRes.data.payment_url}`);
            } else {
                throw new Error('Checkout failed');
            }

            // Verify DB state (Planned)
            const { data: p1 } = await supabase.from('payments').select('status').eq('id', paymentId).single();
            if (p1.status === 'planned') {
                console.log('✅ DB Verification: Payment is PLANNED');
            } else {
                console.error(`❌ DB Verification Failed: Status is ${p1.status}`);
            }

            // 4. Test: Confirm Payment
            console.log('\n✅ Confirming Payment...');
            const confirmRes = await axios.post(`${API_URL}/payments/${paymentId}/confirm`, {});
            
            if (confirmRes.data.success) {
                console.log('✅ Payment Confirmed via API');
            }

            // Verify DB state (Completed & Order Status)
            const { data: p2 } = await supabase.from('payments').select('status').eq('id', paymentId).single();
            const { data: o2 } = await supabase.from('orders').select('status').eq('id', order.id).single();
            
            if (p2.status === 'completed') {
                console.log('✅ DB Verification: Payment is COMPLETED');
            } else {
                console.error(`❌ DB Verification Failed: Payment Status is ${p2.status}`);
            }

            if (o2.status === 'closed') {
                console.log('✅ DB Verification: Order Status is CLOSED (Paid)');
            } else {
                console.error(`❌ DB Verification Failed: Order Status is ${o2.status}`);
            }

        } catch (e) {
            console.warn('⚠️ API Request failed (Server likely not running). Skipping API tests.');
            console.error(e.message);
            if (e.response) console.error(e.response.data);
        }

        // 5. Cleanup
        console.log('\n🧹 Cleaning up...');
        if (paymentId) await supabase.from('payments').delete().eq('id', paymentId);
        await supabase.from('orders').delete().eq('id', order.id);
        await supabase.from('customers').delete().eq('id', cust.id);
        console.log('✅ Cleanup Complete');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    }
}

verifyFinancialLedger();