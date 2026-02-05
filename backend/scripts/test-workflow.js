const supabaseService = require('../src/services/supabase');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function testWorkflow() {
    console.log('🚀 Testing End-to-End Supabase Workflow (Dual-Write)...');

    // 1. Mock Local Data
    const mockOrder = {
        order_code: 'TEST-FLOW-' + Date.now(),
        status: 'new',
        total_amount: 2500,
        bike_id: 'BIKE-X-999',
        created_at: new Date().toISOString(),
        manager_notes: 'Test note from manager',
        magic_link_token: 'magic-' + Date.now()
    };

    const mockCustomer = {
        id: '123e4567-e89b-12d3-a456-426614174000', // random uuid
        email: `test-${Date.now()}@example.com`,
        phone: '+1234567890',
        name: 'Test Customer',
        telegram_id: '123456'
    };

    // 2. Sync to Supabase
    console.log('📤 Syncing Order...');
    const synced = await supabaseService.syncOrder(mockOrder, mockCustomer);
    
    if (synced) {
        console.log('✅ Sync Successful.');
        
        // 3. Test Retrieve by Code (Unpack check)
        console.log('📥 Retrieving by Code...');
        const retrieved = await supabaseService.getOrder(mockOrder.order_code);
        if (retrieved && retrieved.bike_id === mockOrder.bike_id) {
            console.log('✅ Retrieval Unpacked Correctly:', retrieved.bike_id);
        } else {
            console.error('❌ Retrieval Failed or Unpack Broken:', retrieved);
        }

        // 4. Test Magic Link Retrieval
        console.log('🔮 Retrieving by Magic Token:', mockOrder.magic_link_token);
        const magic = await supabaseService.getOrderByToken(mockOrder.magic_link_token);
        if (magic && magic.order_code === mockOrder.order_code) {
            console.log('✅ Magic Link Retrieval Works!');
        } else {
            console.error('❌ Magic Link Retrieval Failed. (Check JSON filter syntax)');
        }

        // 5. Test Timeline Update
        console.log('⏱ Adding Timeline Event...');
        const updated = await supabaseService.addTimelineEvent(mockOrder.order_code, {
            title: 'Test Event',
            description: 'Something happened',
            status: 'negotiation'
        });
        
        if (updated && updated.timeline_events.length > 0 && updated.status === 'negotiation') {
            console.log('✅ Timeline Updated & Status Changed.');
        } else {
            console.error('❌ Timeline Update Failed.');
        }

    } else {
        console.error('❌ Sync Failed.');
    }
}

testWorkflow();
