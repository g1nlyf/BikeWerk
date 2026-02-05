const ValuationService = require('../backend/src/services/ValuationService');
const BikesDatabase = require('./bikes-database-node');
const path = require('path');

async function runTest() {
    console.log('🧪 Starting Sniper Integration Test...');

    // 1. Setup
    // Mock DB just to avoid file operations, or use real one if needed.
    // For this test, we test ValuationService logic primarily.
    const valuation = new ValuationService();

    // 2. Mock Data
    const mockListings = [
        // Case A: Shipping, Price 800 (80% of 1000) <= 85% -> Should be Verified Shipping
        { title: 'Bike A (Ship, Cheap)', price: 800, shipping: 'available', fmv: 1000 }, 
        // Case B: Shipping, Price 900 (90% of 1000) > 85% -> Should be Rejected (Lake)
        { title: 'Bike B (Ship, Expensive)', price: 900, shipping: 'available', fmv: 1000 },
        // Case C: Pickup, Price 700 (70% of 1000) <= 75% -> Should be Hunter Deal
        { title: 'Bike C (Pickup, Cheap)', price: 700, shipping: 'pickup-only', fmv: 1000 },
        // Case D: Pickup, Price 800 (80% of 1000) > 75% -> Should be Rejected (Lake)
        { title: 'Bike D (Pickup, Mid)', price: 800, shipping: 'pickup-only', fmv: 1000 },
        // Case E: Pickup, Price 1100 > 1000 -> Rejected
        { title: 'Bike E (Pickup, Expensive)', price: 1100, shipping: 'pickup-only', fmv: 1000 },
    ];

    let stats = {
        processed: 0,
        published: 0,
        rejected: 0,
        verifiedShipping: 0,
        hunterDeals: 0
    };

    console.log('\nProcessing Listings...');
    // console.table(mockListings);

    for (const listing of mockListings) {
        stats.processed++;
        const sniperResult = await valuation.evaluateSniperRule(listing.price, listing.fmv, listing.shipping);
        
        console.log(`\nChecking: ${listing.title}`);
        console.log(`Price: ${listing.price}, FMV: ${listing.fmv}, Shipping: ${listing.shipping}`);
        console.log(`Sniper Result: IsHit=${sniperResult.isHit}, Priority=${sniperResult.priority}, Reason=${sniperResult.reason}`);

        if (sniperResult.isHit) {
            stats.published++;
            if (listing.shipping === 'available') stats.verifiedShipping++;
            else stats.hunterDeals++;
        } else {
            stats.rejected++;
        }
    }

    console.log('\n📊 Final Stats:');
    console.table(stats);

    // Assertions
    const pass = 
        stats.verifiedShipping === 1 && // Bike A
        stats.hunterDeals === 1 &&      // Bike C
        stats.rejected === 3;           // Bike B, D, E

    if (pass) {
        console.log('\n✅ TEST PASSED: Sniper logic works correctly.');
    } else {
        console.error('\n❌ TEST FAILED: Stats do not match expected values.');
    }
}

runTest().catch(console.error);
