const gemini = require('../backend/src/services/geminiProcessor');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function verifyManagerCopilot() {
    console.log('🚀 Starting Manager Co-Pilot Verification (Sprint 2)...');

    // 1. Verify Task Generation
    console.log('\n🧪 Testing AI Task Generator...');
    const mockOrder = { id: 'test-order-1', order_code: 'ORD-TEST' };
    const mockBike = { 
        brand: 'Specialized', 
        model: 'Tarmac SL7', 
        price: 4500, 
        category: 'road',
        frame_material: 'carbon',
        condition: 'used' 
    };

    try {
        const tasks = await gemini.generateManagerTasks(mockOrder, mockBike);
        console.log(`✅ Generated ${tasks.length} tasks.`);
        if (tasks.length > 0) {
            console.log('Sample Task:', JSON.stringify(tasks[0], null, 2));
            
            // Check for context awareness
            const hasFrameTask = tasks.some(t => t.bike_component === 'frame' || t.title.toLowerCase().includes('frame'));
            if (hasFrameTask) {
                console.log('✅ AI correctly identified Carbon Frame context.');
            } else {
                console.warn('⚠️ AI might have missed Carbon Frame context (Check prompt or response).');
            }
        } else {
            console.error('❌ No tasks generated.');
        }
    } catch (e) {
        console.error('❌ Task Generation Failed:', e.message);
    }

    // 2. Verify Chat Intelligence
    console.log('\n🧪 Testing Chat Intelligence (Text Only)...');
    const mockChat = `
    Seller: Yes, the battery has 15 cycles only. I have the keys and charger.
    Buyer: Great, any scratches on stanchions?
    Seller: No, stanchions are pristine. The fork was serviced last month.
    `;
    
    try {
        const analysis = await gemini.analyzeNegotiationChat(mockChat, []);
        console.log('✅ Analysis Result Summary:', analysis.summary);
        
        if (analysis.tasks_to_close && analysis.tasks_to_close.length > 0) {
            console.log('✅ AI identified tasks to close:', analysis.tasks_to_close.map(t => t.topic).join(', '));
        } else {
            console.warn('⚠️ No tasks identified to close (Expected battery/suspension checks).');
        }
    } catch (e) {
        console.error('❌ Chat Analysis Failed:', e.message);
    }
}

verifyManagerCopilot();
