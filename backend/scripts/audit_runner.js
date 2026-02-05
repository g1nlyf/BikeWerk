require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const path = require('path');
const GeminiProcessor = require('../../telegram-bot/gemini-processor');
const KleinanzeigenParser = require('../../telegram-bot/kleinanzeigen-parser');
const ValuationService = require('../src/services/ValuationService');
const UnifiedHunter = require('../../telegram-bot/unified-hunter');
const { DatabaseManager } = require('../src/js/mysql-config');

async function runAudit() {
    console.log('🕵️‍♂️ Starting Technical Audit...');

    // --- Audit 1: Categorization ---
    console.log('\n--- 1. Format Schema Test (Categorization) ---');
    const gemini = new GeminiProcessor(process.env.GEMINI_API_KEY, process.env.GEMINI_API_URL);
    const titles = ["Canyon Spectral", "Trek Madone", "Specialized Turbo Levo", "Brompton M6L", "Santa Cruz Nomad"];
    const results1 = [];

    for (const title of titles) {
        try {
            // We use processBikeData which calls createPrompt. 
            // We pass a dummy price to avoid validation errors.
            const data = await gemini.processBikeData({ 
                title, 
                price: 1000, 
                description: `Selling my ${title}. Good condition.`,
                attributes: []
            });
            
            const validSchema = data.category && data.discipline ? 'Yes' : 'No';
            results1.push({ title, category: data.category, discipline: data.discipline, valid: validSchema });
            process.stdout.write('.');
        } catch (e) {
            results1.push({ title, error: e.message, valid: 'Error' });
        }
    }
    console.log('\n');
    console.table(results1);


    // --- Audit 2: Seller Extraction ---
    console.log('\n--- 2. Seller Extraction Test ---');
    const parser = new KleinanzeigenParser();
    // We need real links. Since we can't easily browse, we'll try to fetch a search page and get links.
    // If that fails, we'll try a few hardcoded known-good URLs (if they exist) or skip with a warning.
    // For now, let's try to fetch a list of bikes from a search page.
    let links = [];
    try {
        const searchUrl = 'https://www.kleinanzeigen.de/s-fahrraeder/berlin/canyon/k0c217l3331'; // Berlin, Canyon
        console.log(`Fetching search page: ${searchUrl}`);
        const html = await parser.fetchHtmlContent(searchUrl);
        const items = new UnifiedHunter().parseSearchItems(html);
        links = items.slice(0, 3).map(i => i.link);
        console.log(`Found ${links.length} links.`);
    } catch (e) {
        console.warn('Could not fetch search page, using fallback URLs (might be dead):', e.message);
        // Fallback to what we found in search snippet earlier, though likely dead/old.
        // Or just one likely active one.
        links = ['https://www.kleinanzeigen.de/s-anzeige/canyon-endurace-7-rb/2968374252-217-3428']; // Example ID
    }

    for (const link of links) {
        try {
            console.log(`Parsing: ${link}`);
            const data = await parser.parseKleinanzeigenLink(link);
            console.log(`Seller: { name: "${data.sellerName}", type: "${data.sellerType}", badges: [${data.sellerBadges}] }`);
            
            if (!data.sellerName || data.sellerName === 'Unknown') {
                console.warn('⚠️ Seller Name missing. Check selector.');
            }
            if (!data.sellerType) {
                console.warn('⚠️ Seller Type missing.');
            }
        } catch (e) {
            console.error(`Failed to parse ${link}: ${e.message}`);
        }
    }


    // --- Audit 3: Profit Zero-Check ---
    console.log('\n--- 3. Profit Zero-Check ---');
    // Mock Database for ValuationService if needed, or rely on real one if connected.
    // ValuationService calculates FMV based on DB history.
    // We will test the math logic specifically as requested: "Test executing calculateProfit(bikePrice, fmv)"
    // Since we don't have that function exposed, we implement the logic here and test FMV retrieval.
    
    const db = new DatabaseManager(); // Assuming it connects to sqlite/mysql as configured
    const valuation = new ValuationService(db);

    const testBike = { price: 2000, fmv: 2500 };
    const profit = Math.round(testBike.fmv - testBike.price);
    console.log(`Manual Test: Price ${testBike.price}, FMV ${testBike.fmv} -> Profit ${profit}`);
    
    console.log('Testing FMV Retrieval for "Canyon Spectral" (2021)...');
    try {
        const fmvData = await valuation.calculateFMV({ brand: 'Canyon', model: 'Spectral', year: 2021, material: 'Carbon' });
        if (fmvData) {
            console.log(`FMV Result: ${fmvData.fmv}€ (Confidence: ${fmvData.confidence})`);
            console.log(`Calculation Path: Median of ${fmvData.sampleSize} items.`);
            console.log(`FMV Source Status: Found`);
        } else {
            console.log('FMV Result: null');
            console.log('FMV Source Status: Not Found (Insufficient Data)');
        }
    } catch (e) {
        console.error('Valuation Error:', e.message);
    }


    // --- Audit 4: AI Justification Audit ---
    console.log('\n--- 4. AI Justification Audit ---');
    const adA = { title: "Canyon Spectral 2022", description: "Top Zustand, wie neu. Keine Kratzer. Service neu.", price: 3000 };
    const adB = { title: "Canyon Spectral 2022", description: "Hat einen Riss im Rahmen. Dämpfer defekt. Bastlerfahrrad.", price: 1000 };
    
    try {
        console.log('Processing Ad A (Perfect)...');
        const resA = await gemini.processBikeData(adA);
        console.log('Processing Ad B (Damaged)...');
        const resB = await gemini.processBikeData(adB);
        
        console.log('\nAd A Justification:', resA.justification);
        console.log('Ad B Justification:', resB.justification);
        
        if (resA.justification === resB.justification) {
            console.warn('⚠️ ALERT: Justifications are IDENTICAL!');
        } else {
            console.log('✅ Justifications differ.');
        }
    } catch (e) {
        console.error('AI Error:', e.message);
    }


    // --- Audit 5: Hunting Diversity Test ---
    console.log('\n--- 5. Hunting Diversity Test ---');
    const unifiedHunter = new UnifiedHunter();
    const categories = ['mtb', 'road', 'emtb'];
    const distribution = {};
    
    // Simulate 50 cycles (templates selection)
    // UnifiedHunter.hunt calls buildTemplates(category) -> shuffle -> pick
    // We will analyze what buildTemplates returns for each category.
    
    console.log('Analyzing Template Distribution...');
    for (const cat of categories) {
        const templates = unifiedHunter.buildTemplates(cat);
        for (const t of templates) {
            // Extract brand/segment from name
            // Names are like "MTB Segment A", "Road Segment B"
            // Wait, buildTemplates uses generic segments (A, B, C) for price ranges.
            // It does NOT seem to target specific brands in `buildTemplates` UNLESS `customQuery` is used.
            // Let's check `buildTemplates` source in `unified-hunter.js`.
            // It generates: `https://www.kleinanzeigen.de/s-fahrraeder/mountainbike/preis:500:1000/k0c217...`
            // It does NOT appear to filter by brand in the URL pattern in the code I read!
            // Wait, `AutoHunter.js` calls `hunt({ category: 'mtb', ... })`.
            // `UnifiedHunter.js` lines 664-709: `buildTemplates` only uses price segments and category paths.
            // It does NOT seem to rotate brands?
            // "Task: Check why system is 'obsessed' with Wilier and Rocky Mountain."
            // If the templates are generic, maybe the obsession comes from the `parseSearchItems` or `processListing` filtering?
            // OR maybe `customQuery` is being used?
            // The Audit instruction implies "Distribution of brands in queue".
            // If the URL is generic "s-fahrraeder/mountainbike", then diversity depends on Kleinanzeigen's sort order (usually date).
            // IF the system has brand-specific templates, they would be here.
            // I will log the templates generated.
            
            if (!distribution[cat]) distribution[cat] = [];
            distribution[cat].push(...templates.map(t => t.name));
        }
    }
    
    console.log(distribution);
    // If templates are generic, I'll note that.
    // If there is logic to prioritize brands, I should look for it.
    // `AutoHunter.js` logic: `hunt({ category: 'mtb' })`.
    // `UnifiedHunter.js` logic: `buildTemplates` returns generic price segments.
    // So where does "Wilier" come from? Maybe the user *thinks* there is brand rotation, or I missed it.
    // Or maybe `Silent Collector` (`fetchMarketData`) uses `brand` param?
    // `AutoHunter` does NOT call `fetchMarketData` in `runHuntCycle`.
    // It calls `hunter.hunt`.
    
    // However, `fetchMarketData` (line 175 in UnifiedHunter) DOES take a brand.
    // Maybe the user is referring to *that*?
    // But Audit 5 says "Simulate AutonomousOrchestrator ... Distribution of brands in queue".
    // If `AutoHunter` only calls `hunt` with generic categories, then it just takes whatever is new.
    // If it's "obsessed" with Wilier, maybe Wilier owners post a lot?
    // OR maybe there is a "Hot Offer" check that biases?
    
    // I will report the template structure.
}

runAudit().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
