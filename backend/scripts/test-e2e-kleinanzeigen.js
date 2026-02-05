/**
 * test-e2e-kleinanzeigen.js
 * End-to-End тест полного pipeline через Kleinanzeigen
 */

const KleinanzeigenCollector = require('../src/scrapers/kleinanzeigen-collector');
const UnifiedNormalizer = require('../src/services/UnifiedNormalizer');
const DatabaseService = require('../src/services/DatabaseService');

async function testE2EKleinanzeigen() {
    console.log('🧪 E2E TEST: KLEINANZEIGEN FULL PIPELINE\n');
    console.log('📋 Pipeline stages:');
    console.log('   1. Manual Target → gap analysis simulation');
    console.log('   2. Kleinanzeigen → scraping');
    console.log('   3. UnifiedNormalizer → Gemini processing');
    console.log('   4. DatabaseService → save to DB\n');

    const stats = {
        scraped: 0,
        filtered_inactive: 0,
        filtered_junk: 0,
        normalized: 0,
        saved: 0,
        duplicates: 0,
        failed: 0
    };

    try {
        // === STAGE 1: GAP ANALYSIS ===
        console.log('▶️ STAGE 1: GAP ANALYSIS');
        
        const dbService = new DatabaseService();
        
        // Для теста используем фиксированную модель с дефицитом
        const testTarget = {
            brand: 'Canyon',
            model: 'Neuron',
            category: 'MTB',
            discipline: 'Trail',
            minPrice: 800,
            maxPrice: 3000
        };

        console.log(`   🎯 Target: ${testTarget.brand} ${testTarget.model}`);
        console.log(`   💰 Price range: €${testTarget.minPrice}-${testTarget.maxPrice}\n`);

        // === STAGE 2: KLEINANZEIGEN SCRAPING ===
        console.log('▶️ STAGE 2: KLEINANZEIGEN SCRAPING');
        
        // Note: KleinanzeigenCollector methods are static
        const term = `${testTarget.brand} ${testTarget.model}`;
        const scrapedResults = await KleinanzeigenCollector.searchBikes(term, {
            minPrice: testTarget.minPrice,
            maxPrice: testTarget.maxPrice,
            limit: 5
        });

        // We need deep scraping for full details
        const fullResults = [];
        for (const item of scrapedResults) {
            console.log(`   🔎 Deep scraping: ${item.url}`);
            const details = await KleinanzeigenCollector.scrapeListing(item.url);
            if (details) {
                fullResults.push({ ...item, ...details });
            } else {
                // If null, it was filtered (inactive/junk/error)
                // We count this as filtered_inactive or filtered_junk depending on logs, 
                // but here we just know it was filtered.
                // scrapeListing logs "Skipping inactive..."
            }
        }

        stats.scraped = scrapedResults.length;
        // activeResults are those that passed deep scraping
        const activeResults = fullResults;
        stats.filtered_inactive = stats.scraped - activeResults.length;
        
        console.log(`   ✅ Scraped (Search): ${stats.scraped}`);
        console.log(`   ✅ Active (Deep): ${activeResults.length}\n`);
        
        if (stats.filtered_inactive > 0) {
            console.log(`   🗑️ Filtered inactive/failed: ${stats.filtered_inactive}\n`);
        }

        // === STAGE 3: NORMALIZATION (GEMINI) ===
        console.log('▶️ STAGE 3: GEMINI NORMALIZATION');
        
        // UnifiedNormalizer.normalize is static
        const normalized = [];

        for (const rawBike of activeResults) {
            console.log(`   🤖 Processing: ${rawBike.title?.substring(0, 50)}...`);
            
            try {
                // Prepare rawBike for normalizer
                const rawBikeForNormalizer = {
                    ...rawBike,
                    source: 'kleinanzeigen',
                    external_id: rawBike.external_id || rawBike.id
                };

                const result = await UnifiedNormalizer.normalize(rawBikeForNormalizer, 'kleinanzeigen', { useGemini: true });
                
                // Проверяем на JUNK (InputSanitizer мог отфильтровать)
                if (result.internal?.tags?.includes('junk_listing')) {
                    console.log(`      🗑️ Junk filtered`);
                    stats.filtered_junk++;
                } else {
                    console.log(`      ✅ Quality: ${result.quality_score}`);
                    normalized.push(result);
                    stats.normalized++;
                }
            } catch (error) {
                if (error.message.includes('JUNK_LISTING')) {
                    console.log(`      🗑️ Junk filtered: ${error.message}`);
                    stats.filtered_junk++;
                } else {
                    console.log(`      ❌ Failed: ${error.message}`);
                    stats.failed++;
                }
            }
        }

        console.log(`\n   ✅ Normalized: ${stats.normalized}/${activeResults.length}\n`);

        // === STAGE 4: DATABASE SAVE ===
        console.log('▶️ STAGE 4: DATABASE SAVE');
        
        if (normalized.length > 0) {
            const saveResults = await dbService.saveBikesToDB(normalized);
            
            stats.saved = saveResults.inserted || 0;
            stats.duplicates = saveResults.duplicates || 0;
            stats.failed += saveResults.failed || 0;

            console.log(`   ✅ Saved: ${stats.saved}`);
            if (stats.duplicates > 0) {
                console.log(`   ⚠️ Duplicates skipped: ${stats.duplicates}`);
            }
            if (saveResults.failed > 0) {
                console.log(`   ❌ Save failed: ${saveResults.failed}`);
            }
        } else {
            console.log(`   ⚠️ Nothing to save (all filtered/failed)`);
        }

        // === SUMMARY ===
        console.log('\n📊 E2E TEST SUMMARY:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Total scraped (search): ${stats.scraped}`);
        console.log(`   Filtered (inactive):    ${stats.filtered_inactive}`);
        console.log(`   Filtered (junk):        ${stats.filtered_junk}`);
        console.log(`   Normalized (Gemini):    ${stats.normalized}`);
        console.log(`   Saved to DB:            ${stats.saved}`);
        console.log(`   Duplicates:             ${stats.duplicates}`);
        console.log(`   Failed:                 ${stats.failed}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const successRate = stats.scraped > 0 
            ? ((stats.saved / stats.scraped) * 100).toFixed(1)
            : 0;
        
        console.log(`\n✅ SUCCESS RATE: ${successRate}% (${stats.saved}/${stats.scraped})\n`);

    } catch (error) {
        console.error('\n❌ E2E TEST FAILED:', error.message);
        console.error(error.stack);
    }

    process.exit(0);
}

testE2EKleinanzeigen();
