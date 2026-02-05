const UnifiedHunter = require('./unified-hunter');
const BikesDatabase = require('./bikes-database-node');

async function main() {
    console.log('🚀 Starting FORCE HUNT FAST (Timeout 10s)...');
    
    const logger = (msg) => console.log(`[FAST_HUNTER] ${msg}`);
    const hunter = new UnifiedHunter({ logger });
    
    // Force shorter timeout
    hunter.geminiProcessor.timeout = 10000;
    
    await hunter.ensureInitialized();
    
    const targetQuery = 'canyon spectral';
    const targetUrl = `https://www.kleinanzeigen.de/s-fahrraeder/${targetQuery.replace(/\s+/g, '-')}/k0c217+fahrraeder.type_s:mountainbike`;
    
    // Monkey Patch Sniper
    hunter.valuationService.evaluateSniperRule = async function() {
        return { isHit: true, reason: 'Force Hunt Fast', priority: 'high' };
    };
    
    try {
        const html = await hunter.fetchHtml(targetUrl);
        const items = hunter.parseSearchItems(html);
        if (items.length === 0) process.exit(1);
        
        const item = items[0];
        console.log(`👉 Processing: ${item.title}`);
        
        await hunter.processListing(item.link);
        console.log('✅ Finished.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

main();
