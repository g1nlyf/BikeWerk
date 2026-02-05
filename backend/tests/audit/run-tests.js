const { execSync } = require('child_process');

const tests = [
    'test-scoring.js',
    'test-inspector.js',
    'test-bounty-match.js',
    'test-finance.js',
    'test-market-sense.js',
    'test-frontend-integration.js'
];

console.log("🚀 Starting Audit Tests...\n");

tests.forEach(test => {
    console.log(`\n---------------------------------------------------`);
    console.log(`Running ${test}...`);
    try {
        const output = execSync(`node ${test}`, { cwd: __dirname, encoding: 'utf8' });
        console.log(output);
    } catch (e) {
        console.error(`❌ ${test} FAILED`);
        console.error(e.message);
        console.error(e.stdout);
        console.error(e.stderr);
    }
});

console.log(`\n---------------------------------------------------`);
console.log("🏁 Audit Tests Completed.");
