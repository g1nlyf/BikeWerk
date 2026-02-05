// backend/scripts/test-suite/test-fixes-qrst.js

const SmartURLBuilder = require('../../../telegram-bot/smart-url-builder');
const SmartTargetStrategy = require('../../services/smart-target-strategy');
const ValuationService = require('../../services/valuation-service');
const UnifiedHunter = require('../../../telegram-bot/unified-hunter');

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║   🧪 COMPREHENSIVE TEST: FIX Q-R-S-T                 ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// ═══════════════════════════════════════════════════════
// TEST 1: FIX Q - SmartURLBuilder
// ═══════════════════════════════════════════════════════
console.log('═'.repeat(60));
console.log('TEST 1: FIX Q - SmartURLBuilder (Minimum Price)');
console.log('═'.repeat(60) + '\n');

const urlBuilder = new SmartURLBuilder();

// Test Case 1.1: Default minPrice = 500
totalTests++;
const url1 = urlBuilder.buildSearchURL({
  brand: 'Specialized',
  category: 'MTB'
});

console.log('Test 1.1: Default minimum price');
console.log(`URL: ${url1}`);

if (url1.includes('preis:500:')) {
  console.log('✅ PASS: URL contains preis:500:\n');
  passedTests++;
} else {
  console.log('❌ FAIL: Missing preis:500: in URL\n');
  failedTests++;
}

// Test Case 1.2: Brand + Model search
totalTests++;
const url2 = urlBuilder.buildSearchURL({
  brand: 'Specialized',
  model: 'Demo',
  category: 'DH',
  minPrice: 2000,
  maxPrice: 6000
});

console.log('Test 1.2: Brand + Model with price range');
console.log(`URL: ${url2}`);

const hasModelInURL = url2.includes('specialized-demo');
const hasPriceRange = url2.includes('preis:2000:6000');

if (hasModelInURL && hasPriceRange) {
  console.log('✅ PASS: URL contains model and price range\n');
  passedTests++;
} else {
  console.log('❌ FAIL: Missing model or price range\n');
  console.log(`  Model in URL: ${hasModelInURL}`);
  console.log(`  Price range: ${hasPriceRange}\n`);
  failedTests++;
}

// Test Case 1.3: Marburg location + shipping
totalTests++;
const url3 = urlBuilder.buildSearchURL({
  brand: 'Santa Cruz',
  model: 'Heckler',
  category: 'eMTB',
  minPrice: 3000,
  location: 'marburg',
  shippingRequired: false
});

console.log('Test 1.3: Marburg location + no shipping required');
console.log(`URL: ${url3}`);

const hasMarburg = url3.includes('marburg');
const hasLocationCode = url3.includes('k0c217l4825r100');
const hasNoShipping = url3.includes('versand_s:nein') || !url3.includes('versand_s:ja'); 

if (hasMarburg && hasLocationCode && hasNoShipping) {
  console.log('✅ PASS: Marburg location and shipping correct\n');
  passedTests++;
} else {
  console.log('❌ FAIL: Location or shipping incorrect\n');
  failedTests++;
}

// ═══════════════════════════════════════════════════════
// TEST 2: FIX R - Smart Funnel Filter
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('TEST 2: FIX R - Smart Funnel Filter');
console.log('═'.repeat(60) + '\n');

const hunter = new UnifiedHunter();

const testListings = [
  { title: 'Specialized Power Sattel Tarmac', price: 79 },
  { title: 'Santa Cruz Bronson 2024 XL Carbon', price: 2800 },
  { title: 'YT Capra Rahmen defekt', price: 1200 },
  { title: 'Canyon Spectral Laufräder Set', price: 450 },
  { title: 'Trek Remedy Fully MTB 2022 L', price: 1800 },
  { title: 'Gabel Fox 36', price: 600 },
  { title: 'Cube Stereo Hybrid 160 2023 M', price: 3500 }
];

console.log('Test 2.1: Filtering test cases\n');

// Test Case 2.1: Apply filter
totalTests++;

(async () => {
  const filtered = await hunter.applyFunnelFilter(testListings);
  
  console.log(`\nOriginal listings: ${testListings.length}`);
  console.log(`After filter: ${filtered.length}\n`);
  
  // Expected: Should block Sattel, Rahmen, Laufräder, Gabel (price), keep 3
  const expectedPass = 3;
  
  console.log('Expected to pass:');
  console.log('  ✓ Santa Cruz Bronson (valid bike)');
  console.log('  ✓ Trek Remedy (valid bike)');
  console.log('  ✓ Cube Stereo (valid bike)\n');
  
  console.log('Expected to block:');
  console.log('  ✗ Sattel (stop-word)');
  console.log('  ✗ Rahmen defekt (stop-word)');
  console.log('  ✗ Laufräder Set (stop-word + parts pattern)');
  console.log('  ✗ Gabel (stop-word + price < 500)\n');
  
  if (filtered.length === expectedPass) {
    console.log('✅ PASS: Filter blocked correct number of items\n');
    passedTests++;
  } else {
    console.log(`❌ FAIL: Expected ${expectedPass}, got ${filtered.length}\n`);
    failedTests++;
  }
  
  // ═══════════════════════════════════════════════════════
  // TEST 3: FIX S - Smart Target Strategy
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 3: FIX S - Smart Target Strategy');
  console.log('═'.repeat(60) + '\n');
  
  const strategy = new SmartTargetStrategy();
  
  // Test Case 3.1: Generate targets with correct distribution
  totalTests++;
  
  console.log('Test 3.1: Generating 100 targets\n');
  
  const targets = await strategy.generateTargets(100);
  
  console.log(`Total targets generated: ${targets.length}\n`);
  
  // Count by tier
  const tierCounts = {
    budget: targets.filter(t => t.tier === 'budget').length,
    mid: targets.filter(t => t.tier === 'mid').length,
    premium: targets.filter(t => t.tier === 'premium').length,
    high_end: targets.filter(t => t.tier === 'high_end').length
  };
  
  console.log('Distribution by tier:');
  console.log(`  Budget (€500-1200):      ${tierCounts.budget} (expected ~15)`);
  console.log(`  Mid (€1200-2500):        ${tierCounts.mid} (expected ~35)`);
  console.log(`  Premium (€2500-4000):    ${tierCounts.premium} (expected ~30)`);
  console.log(`  High-End (€4000-8000):   ${tierCounts.high_end} (expected ~20)\n`);
  
  // Check if distribution is reasonable (±5 from expected)
  const budgetOK = Math.abs(tierCounts.budget - 15) <= 5;
  const midOK = Math.abs(tierCounts.mid - 35) <= 5;
  const premiumOK = Math.abs(tierCounts.premium - 30) <= 5;
  const highEndOK = Math.abs(tierCounts.high_end - 20) <= 5;
  
  if (budgetOK && midOK && premiumOK && highEndOK) {
    console.log('✅ PASS: Distribution within acceptable range\n');
    passedTests++;
  } else {
    console.log('❌ FAIL: Distribution outside acceptable range\n');
    failedTests++;
  }
  
  // Test Case 3.2: Check model-specific targets
  totalTests++;
  
  console.log('Test 3.2: Model-specific targets\n');
  
  const sampleTargets = targets.slice(0, 5);
  console.log('Sample targets:');
  sampleTargets.forEach((t, i) => {
    console.log(`  ${i+1}. ${t.brand} ${t.model} (${t.category}, €${t.minPrice}-${t.maxPrice})`);
  });
  console.log('');
  
  const hasModels = targets.every(t => t.model && t.model.length > 0);
  
  if (hasModels) {
    console.log('✅ PASS: All targets have specific models\n');
    passedTests++;
  } else {
    console.log('❌ FAIL: Some targets missing models\n');
    failedTests++;
  }
  
  // ═══════════════════════════════════════════════════════
  // TEST 4: FIX T - High-End Valuation
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 4: FIX T - High-End Valuation');
  console.log('═'.repeat(60) + '\n');
  
  const valuationService = new ValuationService();
  
  // Test Case 4.1: High-end bike (€4000+)
  totalTests++;
  
  console.log('Test 4.1: High-end bike valuation\n');
  
  const highEndBike = {
    brand: 'Specialized',
    model: 'Stumpjumper',
    year: 2024,
    frame_size: 'L',
    frame_material: 'carbon',
    price: 4299
  };
  
  console.log('Input bike:');
  console.log(`  ${highEndBike.brand} ${highEndBike.model}`);
  console.log(`  Year: ${highEndBike.year}`);
  console.log(`  Price: €${highEndBike.price}\n`);
  
  const fmv = await valuationService.calculateFMV(highEndBike);
  
  console.log(`Calculated FMV: €${fmv}\n`);
  
  // For €4299 bike, FMV should be at least €4000 (not €1874 like before)
  const fmvReasonable = fmv >= 4000;
  
  if (fmvReasonable) {
    const margin = ((fmv - highEndBike.price) / highEndBike.price * 100).toFixed(1);
    console.log(`Margin: ${margin}%`);
    console.log('✅ PASS: FMV is reasonable for high-end bike\n');
    passedTests++;
  } else {
    console.log('❌ FAIL: FMV too low for high-end bike\n');
    console.log(`  Expected: ≥ €4000`);
    console.log(`  Got: €${fmv}\n`);
    failedTests++;
  }
  
  // Test Case 4.2: Mid-range bike (should use normal valuation)
  totalTests++;
  
  console.log('Test 4.2: Mid-range bike valuation\n');
  
  const midRangeBike = {
    brand: 'Canyon',
    model: 'Spectral',
    year: 2022,
    frame_size: 'M',
    price: 2000
  };
  
  console.log('Input bike:');
  console.log(`  ${midRangeBike.brand} ${midRangeBike.model}`);
  console.log(`  Price: €${midRangeBike.price}\n`);
  
  const fmv2 = await valuationService.calculateFMV(midRangeBike);
  
  console.log(`Calculated FMV: €${fmv2}\n`);
  
  if (fmv2 && fmv2 > 0) {
    const margin = ((fmv2 - midRangeBike.price) / midRangeBike.price * 100).toFixed(1);
    console.log(`Margin: ${margin}%`);
    console.log('✅ PASS: FMV calculated for mid-range bike\n');
    passedTests++;
  } else {
    console.log('❌ FAIL: FMV calculation failed\n');
    failedTests++;
  }
  
  // ═══════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL TEST REPORT');
  console.log('═'.repeat(60) + '\n');
  
  console.log(`Total Tests:  ${totalTests}`);
  console.log(`Passed:       ${passedTests} ✅`);
  console.log(`Failed:       ${failedTests} ❌\n`);
  
  const successRate = (passedTests / totalTests * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%\n`);
  
  if (failedTests === 0) {
    console.log('🎉 ALL TESTS PASSED! Smart Hunter 2.0 is ready for production.\n');
  } else {
    console.log(`⚠️  ${failedTests} test(s) failed. Review required.\n`);
  }
  
  console.log('═'.repeat(60) + '\n');
  
})();
