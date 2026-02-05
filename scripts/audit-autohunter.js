const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

// Register ts-node with loose config to bypass strict errors in legacy code
try {
    require('ts-node').register({
        transpileOnly: true,
        skipProject: true, // Ignore tsconfig.json to avoid NodeNext conflicts
        compilerOptions: {
            module: 'commonjs',
            moduleResolution: 'node',
            target: 'es2019',
            allowJs: true,
            esModuleInterop: true
        }
    });
} catch (e) {
    console.warn('⚠️ ts-node register failed (maybe already registered):', e.message);
}

const { AutoHunter } = require('../backend/src/services/autoHunter');
const { DatabaseManager } = require('../backend/src/js/mysql-config');

async function runAudit() {
    console.log('🧪 Starting "The Grand System Integrity & Data Flow Audit"...');
    console.log('=============================================================');

    const dbManager = new DatabaseManager();
    await dbManager.initialize();

    const hunter = new AutoHunter(dbManager);
    await hunter.ensureServices();

    // Mock the runHuntCycle to run a specific test case instead of full cycle
    console.log('🏹 Initiating Audit Hunt (Target: 1 bike, Category: MTB)...');
    
    // We override the runHuntCycle or just call runTestAutocat via a exposed method if available, 
    // or we can use the hunter's internal methods if we access them.
    // AutoHunter uses `runTestAutocat` from `telegram-bot/test-autocat.js`.
    // We can call `runTestAutocat` directly if we import it, but we want to use AutoHunter context.
    // However, AutoHunter.runHuntCycle is hardcoded to 10 bikes.
    
    // Let's modify the hunter instance to run a smaller batch or just call the logic directly.
    // Since `runTestAutocat` is imported in `autoHunter.js` but not exposed as a method of the class (it's a standalone function used inside),
    // we should rely on the modifications we made to `test-autocat.js` and call it directly here.
    
    const { runTestAutocat } = require('../telegram-bot/test-autocat.js');
    
    try {
        // Task 3: Mass Hunt (100 raw + 10 catalog)
        // We will run 10 separate hunts of 1 bike each to leverage key rotation efficiently, or just one big one.
        // Actually, runTestAutocat loop can handle 10.
        // But for "Silent Collector" (100 raw), we need to trigger search but maybe filter stricter or just let it run.
        // The prompt says: "Collect 100 raw items... Select 10 best candidates".
        
        console.log('🚀 Starting Mass Hunt (100 Raw, 10 Catalog)...');
        
        // We'll use a mix of popular brands to fill the lake
        const queries = [
            'Canyon Endurace', 'Specialized Tarmac', 'Trek Domane', 
            'Scott Addict', 'Cube Stereo', 'Giant Defy', 
            'Orbea Orca', 'Rose Backroad', 'Radon Slide', 'Santa Cruz Hightower'
        ];
        
        // We want ~100 raw items. Each query returns ~20 items. 5 queries is enough.
        // But we want 10 catalog items (saved). So we aim for 1-2 saved per query.
        
        for (const query of queries) {
             console.log(`\n🏹 Hunting for: ${query}...`);
             // We ask for 1 bike to be saved per query.
             // This implies it will scan pages until it finds 1 good one.
             // In doing so, it will log all seen items to market_history.
             await runTestAutocat(hunter.mockBot, 'admin_mass_hunt', `1 ${query}`);
             
             // Short pause to be polite
             await new Promise(r => setTimeout(r, 2000));
        }
        
        console.log('✅ Hunt Audit Complete.');
        console.log('=============================================================');
        console.log('🔥 Triggering Hot Offer Processing (Stage 4 & 5)...');
        
        // Force process hot offers immediately
        await hunter.processHotOffers();
        
        console.log('=============================================================');
        console.log('🎉 Audit Finished. Check logs above for [STAGE] details.');
        
    } catch (e) {
        console.error('❌ Audit Failed:', e);
    }
}

runAudit();
