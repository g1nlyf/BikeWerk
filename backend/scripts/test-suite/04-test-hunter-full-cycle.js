// backend/scripts/test-suite/04-test-hunter-full-cycle.js

const { execSync } = require('child_process');
const path = require('path');

console.log('TEST 3.1: Hunter Full Cycle (16 Stages)\n');
console.log('='.repeat(60) + '\n');

try {
  const scriptPath = path.resolve(__dirname, '../test-hunter-full-cycle.js');
  execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
  console.log('TEST 3.1 COMPLETE\n');
} catch (error) {
  console.log('FAIL: Hunter crashed\n');
  process.exit(1);
}