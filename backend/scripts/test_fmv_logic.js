const UnifiedHunter = require('../../telegram-bot/unified-hunter');
const hunter = new UnifiedHunter();
const fs = require('fs');
const path = require('path');

async function test() {
    console.log('Testing FMV Logic...');
    
    // Mock logger to avoid spam
    hunter.log = (msg) => console.log(`[HUNTER_LOG] ${msg}`);
    
    await hunter.ensureInitialized();
    
    // 1. Check Coverage (using a likely existing brand/model or just generic)
    // We assume DB has some data. If not, it returns 0.
    const count = await hunter.checkFMVCoverage('Specialized', 'Stumpjumper');
    console.log(`Coverage for Specialized Stumpjumper: ${count}`);
    
    // 2. Log Skipped
    console.log('Logging skipped target TestBrand/TestModel...');
    hunter.logSkippedTarget('TestBrand', 'TestModel', 5);
    
    // 3. Verify File
    const file = path.resolve(__dirname, '../config/skipped_targets.json');
    if (fs.existsSync(file)) {
        console.log('✅ skipped_targets.json exists');
        const content = JSON.parse(fs.readFileSync(file, 'utf8'));
        console.log('Content:', JSON.stringify(content['TestBrand TestModel'], null, 2));
        
        if (content['TestBrand TestModel'].coverage === 5) {
            console.log('✅ Log content correct');
        } else {
            console.error('❌ Log content incorrect');
        }
    } else {
        console.error('❌ skipped_targets.json NOT created');
    }
}

test().then(() => {
    console.log('Done');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
