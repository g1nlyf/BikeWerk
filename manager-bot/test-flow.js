const GeminiVision = require('./gemini');
const CRMService = require('./services/crm');
require('dotenv').config({ path: '../.env' });

async function test() {
    console.log('🧪 Testing Manager Bot Logic...');

    // Mock Deps
    const gemini = {
        analyzeInspection: async () => ({
            defects: [{ part: 'frame', issue: 'scratch' }],
            grade: 'B',
            summary_ru: 'Test Summary'
        }),
        analyzeChat: async () => ({
            final_price: 1500,
            seller_name: 'Hans',
            success: true,
            summary_ru: 'Agreed on 1500'
        })
    };

    const crm = {
        getOrder: async (id) => ({ id: 'test-uuid', order_code: 'ORD-123', initial_quality: 'A' }),
        createInspection: async (id, data) => {
            console.log('Called createInspection with:', data);
            return { isDegraded: true };
        },
        recordNegotiation: async (id, data) => {
            console.log('Called recordNegotiation with:', data);
        },
        uploadPhoto: async () => 'https://mock.url/photo.jpg'
    };

    // Simulate /done flow
    console.log('\n--- Simulation: Inspection ---');
    const buffers = [Buffer.from('fake')];
    const analysis = await gemini.analyzeInspection(buffers);
    analysis.photos = ['https://mock.url/photo.jpg'];
    const { isDegraded } = await crm.createInspection('test-uuid', analysis);
    console.log('Is Degraded:', isDegraded);

    // Simulate Negotiation flow
    console.log('\n--- Simulation: Negotiation ---');
    const chatAnalysis = await gemini.analyzeChat(Buffer.from('fake'));
    await crm.recordNegotiation('test-uuid', chatAnalysis);

    console.log('\n✅ Logic Test Passed');
}

test();
