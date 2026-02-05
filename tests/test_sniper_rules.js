
const ValuationService = require('../backend/src/services/ValuationService');

// Mock DB not needed for evaluateSniperRule as it doesn't use this.db
const service = new ValuationService({});

async function runTests() {
    console.log('🧪 Testing Sniper Rules...');
    
    const FMV = 2000;
    
    // Case 1: Shipping Available (Threshold 85% = 1700)
    console.log('\nCase 1: Shipping Available (FMV 2000, Threshold 1700)');
    
    let res = await service.evaluateSniperRule(1600, FMV, 'available');
    console.log(`Price 1600: Hit=${res.isHit}, Priority=${res.priority} (Expected: true, high)`);
    if(res.isHit !== true || res.priority !== 'high') console.error('FAIL');

    res = await service.evaluateSniperRule(1800, FMV, 'available');
    console.log(`Price 1800: Hit=${res.isHit}, Priority=${res.priority} (Expected: false, none)`);
    if(res.isHit !== false) console.error('FAIL');

    // Case 2: Pickup Only (Threshold 75% = 1500)
    console.log('\nCase 2: Pickup Only (FMV 2000, Threshold 1500)');

    res = await service.evaluateSniperRule(1400, FMV, 'pickup');
    console.log(`Price 1400: Hit=${res.isHit}, Priority=${res.priority} (Expected: true, medium)`);
    if(res.isHit !== true || res.priority !== 'medium') console.error('FAIL');

    res = await service.evaluateSniperRule(1600, FMV, 'pickup');
    console.log(`Price 1600: Hit=${res.isHit}, Priority=${res.priority} (Expected: false, none)`);
    if(res.isHit !== false) console.error('FAIL');

    console.log('\n✅ Sniper Rule Tests Completed');
}

runTests().catch(console.error);
