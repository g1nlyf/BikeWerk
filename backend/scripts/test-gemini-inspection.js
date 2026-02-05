const gemini = require('../src/services/geminiProcessor');

const mockBike = {
    title: 'Specialized Enduro Comp 2021',
    description: 'Great condition, recently serviced. New chain and cassette. Minor scratches on frame.',
    attributes: {
        Frame: 'Carbon',
        Size: 'L',
        Wheel: '29'
    },
    images: [
        'https://images.unsplash.com/photo-1576435728678-68d01da13e31?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80' // Random bike image
    ]
};

async function test() {
    console.log('🚀 Starting Gemini Inspection Test...');
    try {
        const start = Date.now();
        const result = await gemini.performInitialInspection(mockBike);
        const duration = (Date.now() - start) / 1000;
        
        console.log(`✅ Finished in ${duration}s`);
        
        if (result.error) {
            console.error('❌ API Error:', result.error);
        } else {
            console.log('✅ Checklist Generated:', Object.keys(result.checklist).length, 'items');
            console.log('✅ German Message:', result.german_inquiry_message);
        }
        
    } catch (e) {
        console.error('❌ Test Failed:', e);
    }
}

test();
