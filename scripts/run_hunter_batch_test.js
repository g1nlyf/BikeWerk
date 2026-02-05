const UnifiedHunter = require('../telegram-bot/unified-hunter');
const BikesDatabase = require('../telegram-bot/bikes-database-node');
const SmartURLBuilder = require('../telegram-bot/smart-url-builder');
const path = require('path');

// Force absolute path to correct DB
process.env.BOT_DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
process.env.DB_PATH = process.env.BOT_DB_PATH;

async function main() {
    console.log('🚀 Starting BATCH HUNTER TEST (Target: 10 Bikes)...');
    console.log('📅 Date:', new Date().toISOString());
    console.log(`📂 DB Path: ${process.env.DB_PATH}`);

    const successes = [];
    const failures = [];
    
    // Custom logger to track stages
    const logger = (msg) => {
        console.log(`[BATCH_HUNTER] ${msg}`);
        // Simple stage tracking via regex
        if (msg.includes('✅ PUBLISHED')) {
            // Success detected
        }
    };
    
    const hunter = new UnifiedHunter({ logger });
    const bikesDB = new BikesDatabase();
    const urlBuilder = new SmartURLBuilder();
    
    await hunter.ensureInitialized();
    await bikesDB.ensureInitialized();

    // Queries to ensure we find enough items
    const queries = [
        'specialized stumpjumper',
        'canyon spectral',
        'trek fuel ex',
        'cube stereo',
        'yt capra',
        'santa cruz nomad',
        'commencal meta',
        'orbea oiz',
        'scott spark',
        'cannondale scalpel'
    ];

    let processedCount = 0;
    let successCount = 0;
    const TARGET_SUCCESS = 10;

    for (const query of queries) {
        if (successCount >= TARGET_SUCCESS) break;

        // Use SmartURLBuilder to ensure we match the production logic (minPrice: 500, etc.)
        // query is "brand model", so we split it.
        const [brand, ...modelParts] = query.split(' ');
        const model = modelParts.join(' ');

        const searchUrl = urlBuilder.buildSearchURL({
            brand: brand,
            model: model,
            category: 'MTB',
            minPrice: 500,
            location: 'global',
            shippingRequired: true
        });

        console.log(`\n🔎 Searching: ${query} (${searchUrl})`);

        try {
            const html = await hunter.fetchHtml(searchUrl);
            const items = hunter.parseSearchItems(html);
            
            console.log(`   Found ${items.length} listings.`);

            // TEST FIX R: Apply Funnel Filter
            console.log('   🛡️ Applying Smart Funnel Filter...');
            const filteredItems = await hunter.applyFunnelFilter(items);
            console.log(`   🛡️ Filtered: ${filteredItems.length} passed.`);

            for (const item of filteredItems) {
                if (successCount >= TARGET_SUCCESS) break;
                
                // Skip if already in DB (quick check)
                const exists = await bikesDB.getBikeByOriginalUrl(item.link);
                if (exists) {
                    console.log(`   ⏭️ Skipped (Exists): ${item.title}`);
                    continue;
                }

                console.log(`\n👉 Processing (${successCount + 1}/${TARGET_SUCCESS}): ${item.title}`);
                
                // FORCE HIT for testing if needed, but let's try real logic first.
                // If you want to force add, uncomment below:
                // hunter.valuationService.evaluateSniperRule = async () => ({ isHit: true, reason: 'Batch Test Override', priority: 'high' });

                const result = await hunter.processListing(item.link);
                
                if (result) {
                    successCount++;
                    successes.push(item.title);
                    console.log(`   ✅ SUCCESS #${successCount}`);
                } else {
                    failures.push(item.title);
                    console.log(`   ❌ FAILED/SKIPPED`);
                }
                
                processedCount++;
                // Small delay to be polite
                await new Promise(r => setTimeout(r, 3000));
            }

        } catch (e) {
            console.error(`   ⚠️ Error searching ${query}: ${e.message}`);
        }
        
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 BATCH TEST COMPLETE');
    console.log(`Total Processed: ${processedCount}`);
    console.log(`Total Added: ${successCount}`);
    console.log('════════════════════════════════════════════════════════════');
    
    console.log('\n✅ Added Bikes:');
    successes.forEach((t, i) => console.log(`   ${i+1}. ${t}`));
    
    console.log('\n❌ Failed/Skipped Samples (First 5):');
    failures.slice(0, 5).forEach((t, i) => console.log(`   ${i+1}. ${t}`));

    // Final DB Check
    const count = await bikesDB.getQuery('SELECT COUNT(*) as c FROM bikes');
    console.log(`\n📚 Final DB Count: ${count.c}`);
}

main().catch(console.error);
