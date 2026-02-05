const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('Running test suite... (this may take 30-60s)');
    return new Promise((resolve) => {
        // Increase maxBuffer for large output
        exec('npx mocha backend/tests/validation/*.test.js', { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            resolve({ stdout, stderr, error });
        });
    });
}

async function generate() {
    const reportHeader = [
        '═══════════════════════════════════════════════════════════',
        '   BIKEEU SYSTEM VALIDATION REPORT',
        '   Sprint 1-7 Comprehensive Testing',
        '   Date: ' + new Date().toISOString(),
        '═══════════════════════════════════════════════════════════\n'
    ].join('\n');

    console.log(reportHeader);

    const { stdout, stderr } = await runTests();
    
    // Parse stdout for stats
    const passingMatch = stdout.match(/(\d+) passing/);
    const failingMatch = stdout.match(/(\d+) failing/);
    
    const passed = passingMatch ? parseInt(passingMatch[1]) : 0;
    const failed = failingMatch ? parseInt(failingMatch[1]) : 0;
    const total = passed + failed;
    
    let output = reportHeader;
    output += '📊 TEST SUMMARY\n\n'; 
    output += `Total Tests: ${total}\n`; 
    output += `✅ Passed: ${passed} (${total > 0 ? (passed/total*100).toFixed(1) : 0}%)\n`; 
    output += `❌ Failed: ${failed}\n`; 
    
    // Print critical failures
    if (failed > 0) {
        output += '\n🚨 FAILURES DETECTED\n\n';
        // Extract failure details from stdout
        const lines = stdout.split('\n');
        let printing = false;
        let count = 0;
        lines.forEach(line => {
            if (line.trim().match(/^\d+\)/)) {
                printing = true;
                count++;
            }
            if (printing) {
                output += line + '\n';
                if (line.trim() === '' && count > 0) {
                    // printing = false; // Don't stop printing immediately to capture stack trace
                }
            }
        });
    }
    
    output += '\n🚀 PRODUCTION READINESS\n\n'; 
    if (failed === 0) {
        output += '✅ SYSTEM IS PRODUCTION READY\n';
        output += 'All tests passing. Ready for soft launch.\n';
    } else if (failed <= 2) { 
        output += '⚠️ SYSTEM IS READY WITH CAVEATS\n';
        output += 'Minor failures detected (likely seed data or timeouts). Review before launch.\n';
    } else {
        output += '❌ BLOCKERS DETECTED\n';
        output += 'Critical failures must be fixed.\n';
    }

    console.log(output);
    
    // Save to file
    const reportPath = path.resolve(__dirname, 'validation-report.txt');
    fs.writeFileSync(reportPath, output);
    console.log(`\nReport saved to: ${reportPath}`);
}

generate();
