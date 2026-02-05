
const ValuationService = require('../backend/src/services/ValuationService');

console.log('💎 Verifying "Gold Mine" (Salvage Arbitrage)...');

// Mock DB
const mockDB = {};
const service = new ValuationService(mockDB);

async function run() {
    const tests = [
        {
            name: 'Standard Bike (No Arbitrage)',
            price: 2000,
            fmv: 2200,
            desc: 'Normal bike',
            expectGem: false
        },
        {
            name: 'Broken Frame but High End Parts (The Gem)',
            price: 800, // Cheap because broken
            fmv: 3500, // FMV of working bike
            desc: 'Carbon frame crack, but Fox Factory fork, SRAM AXS groupset.',
            expectGem: true
        },
        {
            name: 'Low Value Scrap',
            price: 100,
            fmv: 200,
            desc: 'Rust bucket',
            expectGem: false
        }
    ];

    for (const t of tests) {
        const bikeData = { price: t.price, description: t.desc };
        const result = await service.calculateSalvageValue(bikeData, t.fmv);
        
        const success = result.isGem === t.expectGem;
        console.log(`[${success ? '✅' : '❌'}] ${t.name}: Value ${result.value}€ vs Price ${t.price}€ -> Gem: ${result.isGem}`);
        if (!success) {
            console.log('   Debug:', result);
        }
    }
}

run().catch(console.error);
