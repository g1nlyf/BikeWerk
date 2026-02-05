const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../telegram-bot/.env') });

const KleinanzeigenParser = require('../telegram-bot/kleinanzeigen-parser');
const GeminiProcessor = require('../telegram-bot/gemini-processor');
const BikesDatabase = require('../telegram-bot/bikes-database-node');
const ValuationService = require('../backend/src/services/ValuationService');

// Init Services
const parser = new KleinanzeigenParser();
const bikesDB = new BikesDatabase();
const valuationService = new ValuationService(bikesDB);
const gp = new GeminiProcessor(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');

// Try attaching multi-key
// try {
//     gp.setMultiKeyClient(geminiClient);
// } catch (e) {}

// Helper: Search and pick a candidate
async function findCandidate(query, minPrice, maxPrice, mustHavePickup = false) {
    const slug = query.toLowerCase().replace(/\s+/g, '-');
    const priceStr = `preis:${minPrice}:${maxPrice}`;
    // Base URL for bicycles category
    const url = `https://www.kleinanzeigen.de/s-fahrraeder/${priceStr}/${slug}/k0c210+fahrraeder.versand_s:nein`; // k0c210 is bicycles. 
    // Wait, 'Nur Abholung' filter? 
    // +fahrraeder.versand_s:nein might not be standard.
    // Let's just search and filter manually.
    
    // Standard Search URL
    const searchUrl = `https://www.kleinanzeigen.de/s-fahrraeder/${priceStr}/${slug}/k0c210`;
    
    console.log(`🔎 Searching: ${query} (${minPrice}-${maxPrice}€)... URL: ${searchUrl}`);
    
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html'
        };
        const res = await axios.get(searchUrl, { headers });
        const $ = cheerio.load(res.data);
        
        const items = [];
        $('.ad-listitem').each((i, el) => {
            const $el = $(el);
            const link = $el.find('a.ellipsis').attr('href');
            if (!link) return;
            
            const title = $el.find('a.ellipsis').text().trim();
            const priceText = $el.find('.aditem-main--middle--price-shipping--price').text().trim();
            const shippingText = $el.find('.aditem-main--middle--price-shipping--shipping').text().trim();
            
            if (link.includes('/s-anzeige/')) {
                items.push({
                    url: 'https://www.kleinanzeigen.de' + link,
                    title,
                    priceText,
                    shippingText
                });
            }
        });

        console.log(`   Found ${items.length} items.`);

        // Filter
        for (const item of items) {
            // Check pickup requirement
            if (mustHavePickup) {
                if (!item.shippingText.includes('Nur Abholung')) continue;
            }
            
            return item; // Return first match
        }
        
        return null;

    } catch (e) {
        console.error(`   ❌ Search failed: ${e.message}`);
        return null;
    }
}

async function runBattleTest() {
    console.log('⚔️ STARTING LIVE BATTLE TEST ⚔️');
    console.log('================================');
    
    await bikesDB.ensureInitialized();

    const scenarios = [
        {
            name: 'Goal A: High-End (Specialized S-Works > 3000€)',
            query: 'Specialized S-Works',
            min: 3000,
            max: 15000,
            pickup: false
        },
        {
            name: 'Goal B: Mid-Range Pickup (Cube/Scott 800-1500€)',
            query: 'Cube Stereo', // Specific model to get good hits
            min: 800,
            max: 1500,
            pickup: true
        },
        {
            name: 'Goal C: The Year Trap (Canyon Spectral)',
            query: 'Canyon Spectral',
            min: 1500,
            max: 4000,
            pickup: false
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🎯 SCENARIO: ${scenario.name}`);
        const candidate = await findCandidate(scenario.query, scenario.min, scenario.max, scenario.pickup);
        
        if (!candidate) {
            console.log('   ⚠️ No suitable candidate found.');
            continue;
        }

        console.log(`   🔗 Selected: ${candidate.url}`);
        console.log(`   🏷️ Metadata: ${candidate.title} | ${candidate.priceText} | ${candidate.shippingText}`);

        try {
            // 1. Parser
            console.log('   📥 Parsing...');
            const rawData = await parser.parseKleinanzeigenLink(candidate.url);
            
            // 2. Gemini
            console.log('   🤖 Gemini Deep Archeology...');
            const finalData = await gp.processBikeData(rawData);
            
            // 3. Profit Calc
            const fmvData = await valuationService.calculateFMV(finalData.brand, finalData.model, finalData.year);
            const fmv = fmvData.price || 0;
            
            // Calc Shipping
            let shippingCost = 0;
            if (finalData.deliveryOption === 'pickup-only') {
                shippingCost = 150; // Estimated concierge pickup cost
            } else {
                shippingCost = 50; // Standard shipping
            }
            
            const listingPrice = finalData.price || 0;
            const profit = fmv - (listingPrice + shippingCost);
            const margin = fmv > 0 ? (profit / fmv) * 100 : 0;

            // 4. Decision
            let decision = 'REJECT';
            let reason = 'Low Margin';
            
            if (finalData.deliveryOption === 'available' && margin > 15) {
                decision = 'ACCEPT (Express Purchase)';
                reason = `High Margin (${margin.toFixed(1)}%) & Shipping Available`;
            } else if (finalData.deliveryOption === 'pickup-only' && margin > 25) {
                decision = 'ACCEPT (Concierge Buyout)';
                reason = `Super High Margin (${margin.toFixed(1)}%) justifies Pickup`;
            } else if (margin <= 0) {
                reason = 'Negative Profit';
            }

            // Output Log
            console.log('\n   📋 BATTLE LOG:');
            console.log(`   - Model: ${finalData.brand} ${finalData.model} (${finalData.year || 'Unknown Year'})`);
            console.log(`   - Specs: Size ${finalData.frameSize} | Wheels ${finalData.wheelDiameter} | ${finalData.category}`);
            console.log(`   - Condition: ${finalData.condition} (Rating: ${finalData.conditionRating}/10)`);
            console.log(`   - Logistics: ${finalData.deliveryOption} (Parsed from: "${candidate.shippingText}" + Desc)`);
            console.log(`   - Financials: Ask ${listingPrice}€ | FMV ${fmv}€ | Est. Ship ${shippingCost}€`);
            console.log(`   - Profit: ${profit.toFixed(0)}€ (${margin.toFixed(1)}%)`);
            console.log(`   - DECISION: ${decision} [${reason}]`);
            console.log(`   - Description Snippet: "${finalData.description.substring(0, 100)}..."`);

        } catch (e) {
            console.error(`   ❌ Processing Failed: ${e.message}`);
        }
        
        // Pause to avoid rate limits
        await new Promise(r => setTimeout(r, 3000));
    }
}

runBattleTest();
