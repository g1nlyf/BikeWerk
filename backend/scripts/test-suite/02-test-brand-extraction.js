// backend/scripts/test-suite/02-test-brand-extraction.js

const { extractBrand, extractFrameSize, extractYear } = require('../../scripts/fill-data-lake');

const testCases = [
  {
    title: 'YT Industries Capra Pro Race 2023 L',
    expected: { brand: 'YT', size: 'L', year: 2023 }
  },
  {
    title: 'Santa Cruz Heckler 6 CC 2022 Größe M',
    expected: { brand: 'Santa Cruz', size: 'M', year: 2022 }
  },
  {
    title: 'Specialized S-Works Enduro 2021 19 Zoll',
    expected: { brand: 'Specialized', size: 'L', year: 2021 } // 19 inch -> L
  },
  {
    title: 'Canyon Torque CF 8 2024 XL Carbon',
    expected: { brand: 'Canyon', size: 'XL', year: 2024 }
  }
];

console.log('🔬 TEST 1.2: Brand/Size/Year Extraction\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, i) => {
  console.log(`Test ${i + 1}: "${test.title}"`);
  
  const brand = extractBrand(test.title);
  const size = extractFrameSize(test.title);
  const year = extractYear(test.title);
  
  const brandMatch = brand === test.expected.brand;
  const sizeMatch = size === test.expected.size;
  const yearMatch = year === test.expected.year;
  
  if (brandMatch && sizeMatch && yearMatch) {
    console.log(`  ✅ PASS: ${brand} / ${size} / ${year}\n`);
    passed++;
  } else {
    console.log(`  ❌ FAIL:`);
    if (!brandMatch) console.log(`     Brand: got "${brand}", expected "${test.expected.brand}"`);
    if (!sizeMatch) console.log(`     Size: got "${size}", expected "${test.expected.size}"`);
    if (!yearMatch) console.log(`     Year: got "${year}", expected "${test.expected.year}"`);
    console.log('');
    failed++;
  }
});

console.log(`\n📊 Results: ${passed}/${testCases.length} passed, ${failed} failed\n`);
