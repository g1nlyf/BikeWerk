const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const API_URL = 'http://localhost:8089/api/v1/crm'; // Assuming 8089 is the port (or whatever port we use)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyLogisticsFlow() {
    console.log('🚀 Starting Sprint 5 Verification: Logistics Flow...');
    
    let orderId = null;
    let paymentId = null;
    let shipmentId = null;
    const orderCode = `ORD-LOG-${Math.floor(Math.random() * 10000)}`;
    const custEmail = `logistics_test_${Date.now()}@test.com`;

    try {
        // 1. Create Mock Customer & Order
        console.log('\n📝 Creating Mock Order...');
        const { data: cust } = await supabase.from('customers').insert({
            email: custEmail,
            full_name: 'Logistics Tester',
            phone: '+491510000000'
        }).select().single();

        const { data: order, error: orderError } = await supabase.from('orders').insert({
            order_code: orderCode,
            customer_id: cust.id,
            status: 'awaiting_payment',
            final_price_eur: 3000,
            booking_amount_eur: 500,
            commission_eur: 300,
            bike_name: 'Specialized Tarmac SL7',
            bike_snapshot: { 
                brand: 'Specialized', 
                model: 'Tarmac SL7', 
                year: 2022, 
                frame_material: 'Carbon', 
                serial_number: 'WSBC601000100N' 
            }
        }).select().single();

        if (orderError) throw orderError;
        orderId = order.id;
        const uuid = order.old_uuid_id || order.id;
        console.log(`✅ Order Created: ${orderCode} (ID: ${orderId})`);

        // 2. Pay Full Amount (Simulate Closed Order)
        console.log('\n💳 Paying Order...');
        // Create full payment directly via DB to skip checkout/confirm for speed if needed, 
        // BUT we need to trigger the logic in confirm endpoint. So we MUST use API.
        
        // 2.1 Checkout (Full Amount)
        // Using a port that is running the server. I should check which port is active or start one.
        // Assuming 8081 based on previous steps, but I will need to start the server on a known port.
        
        const checkoutRes = await axios.post(`${API_URL}/orders/${orderCode}/checkout`, { 
            method: 'online_cashbox',
            amount: 3000 
        });
        
        if (!checkoutRes.data.success) throw new Error('Checkout failed');
        paymentId = checkoutRes.data.payment_id;
        console.log(`✅ Payment Created: ${paymentId}`);

        // 2.2 Confirm Payment (Triggers Logistics)
        console.log('✅ Confirming Payment (Triggers Shipment Creation)...');
        const confirmRes = await axios.post(`${API_URL}/payments/${paymentId}/confirm`, {});
        if (!confirmRes.data.success) throw new Error('Payment confirmation failed');
        console.log('✅ Payment Confirmed');

        // 3. Verify Shipment Creation
        console.log('\n📦 Verifying Shipment Creation...');
        // Wait a bit for async Gemini (though the endpoint awaits it? No, wait, in code it awaited geminiClient)
        // In crm.ts: await geminiClient.generateCustomsDescription... yes it awaits.
        
        const { data: shipment, error: shipError } = await supabase.from('shipments')
            .select('*')
            .eq('order_id', orderId) // orderId here is the readable ID
            .single();

        if (shipError || !shipment) {
             // Try looking up by old_uuid if FK is tricky
             const { data: shipment2 } = await supabase.from('shipments').select('*').eq('order_id', uuid).single();
             if (!shipment2) throw new Error('Shipment not found in DB');
             shipmentId = shipment2.id;
             console.log('✅ Shipment Found (via UUID)!');
             console.log('   - Customs Decl:', shipment2.ruspost_status?.customs_declaration);
        } else {
             shipmentId = shipment.id;
             console.log('✅ Shipment Found!');
             console.log('   - Customs Decl:', shipment.ruspost_status?.customs_declaration);
        }

        if (!shipmentId) throw new Error('Shipment ID missing');

        // 4. Test Logistics Updates
        console.log('\n🚚 Testing Logistics Updates...');
        
        // 4.1 Update Warehouse Status
        const update1 = await axios.post(`${API_URL}/shipments/${shipmentId}/update`, {
            warehouse_received: true
        });
        if (update1.data.shipment.warehouse_received) console.log('✅ Warehouse Received Updated');
        else console.error('❌ Warehouse Received Update Failed');

        // 4.2 Update Photos
        const update2 = await axios.post(`${API_URL}/shipments/${shipmentId}/update`, {
            warehouse_photos_received: true
        });
        if (update2.data.shipment.warehouse_photos_received) console.log('✅ Warehouse Photos Updated');
        else console.error('❌ Warehouse Photos Update Failed');

        // 4.3 Add Tracking
        const update3 = await axios.post(`${API_URL}/shipments/${shipmentId}/update`, {
            tracking_number: 'TRACK123456DE'
        });
        if (update3.data.shipment.tracking_number === 'TRACK123456DE') console.log('✅ Tracking Number Updated');
        else console.error('❌ Tracking Number Update Failed');

        // 5. Cleanup
        console.log('\n🧹 Cleaning up...');
        await supabase.from('shipments').delete().eq('id', shipmentId);
        await supabase.from('payments').delete().eq('id', paymentId);
        await supabase.from('orders').delete().eq('id', orderId); // using readable ID or UUID? table uses readable ID as PK now? 
        // schema says orders PK is id (text).
        // Let's try deleting by ID.
        await supabase.from('customers').delete().eq('id', cust.id);
        console.log('✅ Cleanup Complete');

    } catch (error) {
        console.error('❌ Verification Failed:', error.message);
        if (error.response) console.error('   API Error:', error.response.data);
    }
}

verifyLogisticsFlow();
