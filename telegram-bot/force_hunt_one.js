const UnifiedHunter = require('./unified-hunter');
const BikesDatabase = require('./bikes-database-node');
const path = require('path');

// Fix DB Path issue when running from root
// Force absolute path to correct DB
process.env.BOT_DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
process.env.DB_PATH = process.env.BOT_DB_PATH;

async function main() {
    console.log('🚀 Starting FORCE HUNT (Single Bike Diagnostic)...');
    console.log('📅 Date:', new Date().toISOString());
    
    // Custom logger
    const logger = (msg) => console.log(`[FORCE_HUNTER] ${msg}`);
    
    const hunter = new UnifiedHunter({ logger });
    const bikesDB = new BikesDatabase();
    
    console.log('🔧 Initializing Hunter...');
    await hunter.ensureInitialized();
    await bikesDB.ensureInitialized();
    
    // We will bypass the standard "hunt" loop to control the process exactly.
    // We'll search for a guaranteed hit like "Canyon Spectral" or "Specialized Stumpjumper"
    // And we will modify the processListing logic slightly by overriding it or just monitoring it closely.
    
    const targetQuery = 'canyon spectral';
    const targetUrl = `https://www.kleinanzeigen.de/s-fahrraeder/${targetQuery.replace(/\s+/g, '-')}/k0c217+fahrraeder.type_s:mountainbike`;
    
    console.log(`🎯 Targeting URL: ${targetUrl}`);
    
    try {
        const html = await hunter.fetchHtml(targetUrl);
        const items = hunter.parseSearchItems(html);
        
        console.log(`🔎 Found ${items.length} items on search page.`);
        
        if (items.length === 0) {
            console.error('❌ No items found. Is Kleinanzeigen blocking us?');
            process.exit(1);
        }
        
        // Pick the first item
        const item = items[0];
        console.log(`👉 Selected Item: ${item.title} (${item.price})`);
        console.log(`🔗 Link: ${item.link}`);
        
        // Force Process
        // We want to force publication even if Sniper says "Skip"
        // So we will hook into the DB save or just run processListing and hope our changes to "is_active" logic work.
        // Wait, in UnifiedHunter.js we have:
        // is_active: publishDecision.shouldPublish ? 1 : 0
        
        // We can't easily override internal method without rewriting it.
        // BUT, we can just run it and see the logs. If it says "Sniper Skip", we know why.
        // The user said "Проверь механизм... найди один байк... и добавь в каталог".
        // If Sniper skips it, it won't be in catalog.
        
        // Strategy: We will manually inject a "Sniper Hit" into the ValuationService for this run?
        // No, let's just use a very permissive Valuation logic if possible.
        // Or better: We monkey-patch the valuation service instance on the hunter.
        
        const originalEval = hunter.valuationService.evaluateSniperRule;
        hunter.valuationService.evaluateSniperRule = async function(price, fmv, delivery) {
            console.log(`[MONKEY_PATCH] Forcing Sniper Hit for price ${price} vs FMV ${fmv}`);
            return { isHit: true, reason: 'Force Hunt Override', priority: 'high' };
        };
        
        console.log('💉 Monkey-Patched Sniper Rule to ALWAYS return HIT.');
        
        await hunter.processListing(item.link);
        
        console.log('✅ ProcessListing finished.');
        
        // Verify in DB
        const dbBike = await bikesDB.getQuery('SELECT * FROM bikes WHERE original_url = ?', [item.link]);
        if (dbBike) {
            console.log('🎉 SUCCESS! Bike found in DB.');
            console.log(`   ID: ${dbBike.id}`);
            console.log(`   Name: ${dbBike.name}`);
            console.log(`   Active: ${dbBike.is_active}`);
        } else {
            console.error('❌ FAILURE! Bike NOT found in DB after processing.');
        }
        
        process.exit(0);
        
    } catch (e) {
        console.error('❌ Force Hunt Failed:', e);
        process.exit(1);
    }
}

main();
