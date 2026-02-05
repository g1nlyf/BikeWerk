const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const UnifiedHunter = require('./unified-hunter');

async function main() {
    const quota = Number(process.env.HUNT_QUOTA || 100);
    console.log(`🚀 Starting Manual Hunt (Target: ${quota} bikes)...`);
    console.log('📅 Date:', new Date().toISOString());
    
    const logger = (msg) => console.log(`[HUNTER] ${msg}`);
    
    const hunter = new UnifiedHunter({ logger });
    
    console.log('🔧 Initializing Hunter...');
    await hunter.ensureInitialized();
    
    try {
        console.log(`🎯 engaging hunt({ category: "auto", quota: ${quota} })...`);
        await hunter.hunt({
            category: 'auto',
            quota
        });
        console.log('✅ Manual Hunt Completed Successfully.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Manual Hunt Failed:', e);
        process.exit(1);
    }
}

main();
