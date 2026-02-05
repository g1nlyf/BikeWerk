const path = require('path');
// Register ts-node to handle TS imports in dependencies
require('ts-node').register({
    project: path.resolve(__dirname, '../../telegram-bot/tsconfig.json'), // Point to tsconfig if exists, or just default
    transpileOnly: true
});

const axios = require('axios');
const cheerio = require('cheerio');
const BikesDatabase = require('../../telegram-bot/bikes-database-node');
const { runTestAutocat } = require('../../telegram-bot/test-autocat');

// --- Silent Collector Configuration ---
const SILENT_TARGET = 100;
const CATALOG_TARGET = 100;
const DB_PATH = path.resolve(__dirname, '../../database/eubike.db');

// Search Templates (simplified)
const SEARCH_TEMPLATES = [
    { name: 'mtb', url: 'https://www.kleinanzeigen.de/s-fahrraeder/mountainbike/seite:{page}/c217+fahrraeder.art_s:mountainbike' },
    { name: 'road', url: 'https://www.kleinanzeigen.de/s-fahrraeder/herren/seite:{page}/c217+fahrraeder.art_s:herren+fahrraeder.typ_s:rennrad' },
    { name: 'ebike', url: 'https://www.kleinanzeigen.de/s-fahrraeder/herren/seite:{page}/c217+fahrraeder.art_s:herren+fahrraeder.typ_s:elektrofahrrad' }
];

// --- Helpers (Copied/Adapted from test-autocat.js to ensure independence for silent phase) ---

async function fetchHtml(url) {
    try {
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            timeout: 20000
        });
        return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    } catch (e) {
        console.error(`Error fetching ${url}: ${e.message}`);
        return null;
    }
}

function parseSearchItems(html) {
    if (!html) return [];
    const $ = cheerio.load(html);
    const items = [];
    $('article.aditem').each((_, el) => {
        const $el = $(el);
        const linkEl = $el.find('a.ellipsis');
        const link = linkEl.attr('href');
        const title = linkEl.text().trim();
        const price = $el.find('.aditem-main--middle--price-shipping--price').text().trim();
        let oldPrice = '';
        const strike = $el.find('s, del, .struck-price').first();
        if (strike && strike.length) oldPrice = strike.text().trim();
        const location = $el.find('.aditem-main--top--left').text().trim();
        
        if (link && title) {
            const fullUrl = link.startsWith('http') ? link : `https://www.kleinanzeigen.de${link}`;
            items.push({ title, price, oldPrice, link: fullUrl, location, date: new Date().toISOString(), snippet: '' });
        }
    });
    return items;
}

// --- Main Execution ---

async function runMassHunt() {
    console.log('🚀 Starting Mass Hunt Operation');
    console.log(`🎯 Targets: ${SILENT_TARGET} Raw Items (Silent) + ${CATALOG_TARGET} Processed Items (Catalog)`);

    const db = new BikesDatabase();
    // No need to init db path manually if it's hardcoded in the class, but let's be safe
    // db.dbPath is set in constructor.

    // Phase 1: Silent Collector
    console.log('\n📡 Phase 1: Silent Collector (Data Lake Filling)...');
    let collectedCount = 0;
    let pageIndex = 1;
    let templateIndex = 0;

    while (collectedCount < SILENT_TARGET) {
        const template = SEARCH_TEMPLATES[templateIndex];
        const url = template.url.replace('{page}', pageIndex);
        
        console.log(`   🔎 Scanning [${template.name}] Page ${pageIndex}...`);
        
        const html = await fetchHtml(url);
        const items = parseSearchItems(html);
        
        if (items.length > 0) {
            // Save to market_history
            await db.logMarketHistory(items);
            collectedCount += items.length;
            console.log(`      ✅ Found ${items.length} items. Total Collected: ${collectedCount}/${SILENT_TARGET}`);
        } else {
            console.log('      ⚠️ No items found on this page.');
        }

        // Rotate templates and pages
        templateIndex++;
        if (templateIndex >= SEARCH_TEMPLATES.length) {
            templateIndex = 0;
            pageIndex++;
        }
        
        // Anti-bot delay
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n✅ Phase 1 Complete. Collected ${collectedCount} raw items.`);

    // Phase 2: Catalog Hunt (Gemini Processing)
    console.log('\n🤖 Phase 2: Catalog Hunt (Gemini Processing)...');
    
    const mockBot = {
        sendMessage: async (chatId, text) => {
            // Clean up logs a bit
            if (!text.includes('HTML FETCHED')) {
                console.log(`   [Bot]: ${text}`);
            }
        }
    };

    try {
        console.log('   Starting sub-hunt for 20 MTB Enduro...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '20 mtb enduro');
        
        console.log('   Starting sub-hunt for 15 MTB DH...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '15 mtb dh');
        
        console.log('   Starting sub-hunt for 7 MTB Trail...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '7 mtb trail');
        
        console.log('   Starting sub-hunt for 3 MTB XC...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '3 mtb xc');
        
        console.log('   Starting sub-hunt for 15 Gravel Allroad...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '15 gravel allroad');
        
        console.log('   Starting sub-hunt for 7 Gravel Race...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '7 gravel race');
        
        console.log('   Starting sub-hunt for 3 Gravel Bikepacking...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '3 gravel bikepacking');
        
        console.log('   Starting sub-hunt for 8 Road Endurance...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '8 road endurance');
        
        console.log('   Starting sub-hunt for 8 Road Aero...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '8 road aero');
        
        console.log('   Starting sub-hunt for 3 Road Climbing...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '3 road climbing');
        
        console.log('   Starting sub-hunt for 1 Road TT...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '1 road tt');
        
        console.log('   Starting sub-hunt for 8 eMTB Enduro...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '8 emtb enduro');
        
        console.log('   Starting sub-hunt for 1 Kids Specialized...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '1 kids specialized');
        
        console.log('   Starting sub-hunt for 1 Kids Early Rider...');
        await runTestAutocat(mockBot, 'mass_hunt_admin', '1 kids early rider');
        
    } catch (e) {
        console.error('❌ Phase 2 Failed:', e);
    }

    console.log('\n🎉 Mass Hunt Operation Completed.');
    process.exit(0);
}

runMassHunt().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
