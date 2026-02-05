
const KillSwitchFilter = require('../telegram-bot/KillSwitchFilter');

console.log('🛡️ Verifying "Shield of the Empire" (Kill-Switch)...');

const filter = new KillSwitchFilter();

const tests = [
    {
        name: 'Valid Bike',
        input: { title: 'Specialized Enduro', price: 2500, description: 'Great bike, top condition. Always serviced at local dealer. New tires and chain. Ready to ride immediately.', images: ['img1.jpg'] },
        expectKill: false
    },
    {
        name: 'Trash Price (< 50€)',
        input: { title: 'Old Bike', price: 40, description: 'Okay.', images: ['img1.jpg'] },
        expectKill: true,
        reason: 'Price < 50€'
    },
    {
        name: 'Search Request (Suche)',
        input: { title: 'Suche Specialized Enduro', price: 2000, description: 'I am looking for...', images: ['img1.jpg'] },
        expectKill: true,
        reason: 'Search request'
    },
    {
        name: 'No Images',
        input: { title: 'Ghost Bike', price: 1000, description: 'Invisible.', images: [] },
        expectKill: true,
        reason: 'No images'
    },
    {
        name: 'Short Description',
        input: { title: 'Bike', price: 500, description: 'Good.', images: ['img1.jpg'] },
        expectKill: true,
        reason: 'Description < 50 chars'
    }
];

let passed = 0;
for (const t of tests) {
    const result = filter.evaluate(t.input);
    const success = result.shouldKill === t.expectKill;
    console.log(`[${success ? '✅' : '❌'}] ${t.name}: ${result.shouldKill ? 'KILLED' : 'PASSED'} (${result.reason || 'OK'})`);
    if (success) passed++;
}

if (passed === tests.length) {
    console.log('✨ All Shield Tests Passed!');
} else {
    console.error('⚠️ Some Shield Tests Failed.');
    process.exit(1);
}
