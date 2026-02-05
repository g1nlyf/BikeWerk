const path = require('path');
const BikesDatabase = require('../telegram-bot/bikes-database-node');
const ValuationService = require('../backend/src/services/ValuationService');
const KleinanzeigenParser = require('../telegram-bot/kleinanzeigen-parser');
const GeminiProcessor = require('../telegram-bot/gemini-processor');
const { geminiClient } = require('../telegram-bot/autocat-klein/src/lib/geminiClient.js'); // Ensure multi-key

// Setup
const bikesDB = new BikesDatabase();
const valuationService = new ValuationService(bikesDB);
const parser = new KleinanzeigenParser();
const gp = new GeminiProcessor(process.env.GEMINI_API_KEY || '', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');

// Try to attach multi-key client if available
try {
    gp.setMultiKeyClient(geminiClient);
} catch (e) {
    console.warn('Multi-key client not available, using single key');
}

async function start() {
    console.log('🏗️ Starting Sniper Catalog Filler (Premium Only)...');
    await bikesDB.ensureInitialized();

    // 1. Get 50 recent candidates from market_history
    // We filter those that are NOT already in 'bikes' table (by source_url)
    const candidates = await bikesDB.allQuery(`
        SELECT mh.* 
        FROM market_history mh
        LEFT JOIN bikes b ON mh.source_url = b.url
        WHERE b.id IS NULL 
        ORDER BY mh.scraped_at DESC 
        LIMIT 50
    `);

    console.log(`🔍 Found ${candidates.length} candidates in Market Lake.`);

    let addedCount = 0;

    for (const candidate of candidates) {
        try {
            console.log(`\n🧐 Analyzing: ${candidate.brand} ${candidate.model_name} (${candidate.price_eur}€)`);
            
            // 2. FMV & Sniper Check
            // We use ValuationService to check if it's a "Sniper Hit"
            // Note: candidate.shipping_option might be null, default to 'pickup-only' if unknown for safety
            const shipping = candidate.shipping_option === 'available' ? 'available' : 'pickup-only';
            
            // ValuationService.evaluateSniperRule(price, fmv, shippingOption)
            // But first we need FMV. ValuationService has calculateFMV(brand, model, year)
            // We might not have 'year' in market_history accurately, so we estimate or use model.
            
            const fmvData = await valuationService.calculateFMV(candidate.brand, candidate.model_name, candidate.year || null);
            const fmv = fmvData.price;

            if (!fmv || fmv === 0) {
                console.log(`   ⏭️ No FMV data for ${candidate.brand} ${candidate.model_name}. Skipping.`);
                continue;
            }

            const sniperResult = await valuationService.evaluateSniperRule(candidate.price_eur, fmv, shipping);
            
            if (!sniperResult.isHit) {
                console.log(`   📉 Not a deal. FMV: ${fmv}, Price: ${candidate.price_eur}. Priority: ${sniperResult.priority}`);
                continue;
            }

            console.log(`   🎯 SNIPER HIT! FMV: ${fmv}, Price: ${candidate.price_eur} (-${Math.round((1 - candidate.price_eur/fmv)*100)}%)`);

            // 3. Deep Analysis (The "Gold Standard")
            console.log(`   📥 Deep Parsing ${candidate.source_url}...`);
            const rawData = await parser.parseKleinanzeigenLink(candidate.source_url);
            
            // Add attributes/description for "Deep Text Archeology"
            console.log(`   🤖 Gemini Analysis (Deep Archeology)...`);
            const processedData = await gp.processBikeData(rawData);

            // 4. Save to Catalog
            // We set is_active = 1 because it's a verified deal
            const bikeId = `${candidate.brand.toLowerCase()}-${candidate.model_name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
            
            const bikeRecord = {
                ...processedData,
                id: bikeId,
                url: candidate.source_url,
                is_active: 1,
                is_hot_offer: 1, // It's a sniper hit
                logistics_priority: sniperResult.priority, // 'high' or 'medium'
                source: 'sniper_auto',
                condition_score: processedData.conditionRating || 7, // Fallback
                condition_grade: 'B' // Placeholder, should be calculated
            };

            // Map fields for addBike
            // We need to match addBike signature or use SQL directly if addBike is strict
            // bikesDB.addBike handles most mapping.
            
            await bikesDB.addBike(bikeRecord);
            console.log(`   ✅ Added to Catalog: ${bikeRecord.brand} ${bikeRecord.model}`);
            addedCount++;

        } catch (e) {
            console.error(`   ❌ Error processing candidate ${candidate.id}:`, e.message);
        }
    }

    console.log(`\n🏁 Catalog Fill Complete. Added ${addedCount} premium bikes.`);
}

start();
