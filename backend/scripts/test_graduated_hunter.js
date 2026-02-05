const GraduatedHunter = require('../src/services/graduated-hunter');

async function test() {
    console.log('🧪 Testing Graduated Hunter...');

    // Mock Bike 1: Tier 1, Good Deal
    // We saw Nomad 2022 avg price is likely around 2400-3000 based on sample.
    // Let's set price low to ensure discount.
    const bike1 = {
        brand: 'Santa Cruz',
        model: 'Nomad',
        year: 2022,
        price: 2000, 
        description: 'Great condition, Fox Factory',
        quality_score: 85
    };

    console.log('\n🚲 Testing Bike 1 (Tier 1 Success Candidate)...');
    console.log('Bike:', bike1.brand, bike1.model, bike1.year, '€' + bike1.price);
    const res1 = await GraduatedHunter.evaluateBike(bike1);
    console.log('Result:', JSON.stringify(res1, null, 2));

    // Mock Bike 2: Tier 3, Low Discount
    // Cube Stereo is Tier 2 in config? Let's check PriorityMatrix logic.
    // Cube is Tier 2 in brands-config.json.
    // Tier 3 is Giant, etc.
    // Let's use Giant Trance (Tier 3).
    const bike2 = {
        brand: 'Giant',
        model: 'Trance',
        year: 2021,
        price: 2000, // Likely high price for Trance, so low discount or negative
        description: 'Good bike',
        quality_score: 80
    };

    console.log('\n🚲 Testing Bike 2 (Tier 3 Fail Candidate)...');
    console.log('Bike:', bike2.brand, bike2.model, bike2.year, '€' + bike2.price);
    const res2 = await GraduatedHunter.evaluateBike(bike2);
    console.log('Result:', JSON.stringify(res2, null, 2));

    // Mock Bike 3: Red Flag
    const bike3 = {
        brand: 'YT',
        model: 'Capra',
        year: 2023,
        price: 1500, // Good price but defective
        description: 'Verkaufe mein Capra. Leider Rahmen Riss am Steuerrohr. Defekt.',
        quality_score: 90
    };

    console.log('\n🚲 Testing Bike 3 (Red Flag)...');
    console.log('Bike:', bike3.brand, bike3.model, bike3.year, '€' + bike3.price);
    const res3 = await GraduatedHunter.evaluateBike(bike3);
    console.log('Result:', JSON.stringify(res3, null, 2));
    
    process.exit(0);
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});
