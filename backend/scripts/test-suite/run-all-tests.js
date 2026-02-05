// backend/scripts/test-suite/run-all-tests.js

const { execSync } = require('child_process');

const tests = [
  '01-verify-data-lake.js',
  '02-test-brand-extraction.js',
  '03-test-fmv-accuracy.js',
  '04-test-hunter-full-cycle.js'
];

console.log('🧪 EUBIKE SYSTEM TEST SUITE\n');
console.log('═'.repeat(60) + '\n');

let totalPassed = 0;
let totalFailed = 0;

tests.forEach((test, i) => {
  console.log(`\n📝 Running Test ${i + 1}/${tests.length}: ${test}\n`);
  
  try {
    // Check if test 04, use ts-node if needed? No, let's try node first.
    // If unified-hunter.js requires .ts, we might need to handle that.
    // But for now, standard node.
    const output = execSync(`node backend/scripts/test-suite/${test}`, {
      encoding: 'utf-8',
      stdio: 'inherit'
    });
    
    totalPassed++;
    
  } catch (error) {
    console.log(`\n❌ Test ${test} FAILED\n`);
    totalFailed++;
  }
});

console.log('\n' + '═'.repeat(60));
console.log('🏁 ALL TESTS COMPLETE\n');
console.log(`Passed: ${totalPassed}/${tests.length}`);
console.log(`Failed: ${totalFailed}/${tests.length}\n`);

if (totalFailed === 0) {
  console.log('✅ SYSTEM READY FOR PRODUCTION\n');
} else {
  console.log('⚠️  SOME TESTS FAILED - REVIEW REQUIRED\n');
}
