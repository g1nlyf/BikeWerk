/**
 * test-kleinanzeigen-parser.js
 * Тестирование Kleinanzeigen parser в изоляции
 */

const KleinanzeigenCollector = require('../src/scrapers/kleinanzeigen-collector');

async function testKleinanzeigenParser() {
    console.log('🧪 KLEINANZEIGEN PARSER DIAGNOSTIC TEST\n');

    // Тестовый запрос
    const testQuery = {
        brand: 'Canyon',
        model: 'Neuron',
        minPrice: 500,
        maxPrice: 3000,
        limit: 5
    };

    console.log('📋 Test Query:', testQuery);
    console.log('\n🔍 Starting collection...\n');

    try {
        const term = `${testQuery.brand} ${testQuery.model}`;
        // 1. Search
        const searchResults = await KleinanzeigenCollector.searchBikes(term, {
            minPrice: testQuery.minPrice,
            maxPrice: testQuery.maxPrice,
            limit: testQuery.limit
        });

        console.log(`Found ${searchResults.length} listings in search.`);
        
        const results = [];
        
        // 2. Deep Scrape
        for (const item of searchResults) {
            console.log(`Scraping ${item.url}...`);
            const details = await KleinanzeigenCollector.scrapeListing(item.url);
            if (details) {
                // Merge details with item
                results.push({ ...item, ...details });
            } else {
                console.log(`Skipped (inactive or failed): ${item.url}`);
            }
        }

        console.log(`\n📊 RESULTS SUMMARY:`);
        console.log(`   Total collected: ${results.length}`);

        // Анализируем результаты
        const analysis = {
            valid: [],
            junk: [],
            incomplete: [],
            reserved: [],
            sold: []
        };

        results.forEach((bike, index) => {
            const title = bike.title || '';

            // Классифицируем
            if (/reserviert|gelöscht|gesperrt/i.test(title)) {
                analysis.junk.push({ index, title, reason: 'Reserved/Deleted' });
            } else if (/verkauft|sold/i.test(title)) {
                analysis.sold.push({ index, title, reason: 'Sold' });
            } else if (!bike.price || bike.price <= 0) {
                analysis.incomplete.push({ index, title, reason: 'No price' });
            } else if (!bike.description || bike.description.length < 10) {
                analysis.incomplete.push({ index, title, reason: 'No description' });
            } else {
                analysis.valid.push({ index, title });
            }
        });

        console.log(`\n✅ Valid listings: ${analysis.valid.length}`);
        console.log(`🗑️  Junk (Reserved/Deleted): ${analysis.junk.length}`);
        console.log(`💰 Sold: ${analysis.sold.length}`);
        console.log(`⚠️  Incomplete data: ${analysis.incomplete.length}`);

        // Детальный вывод junk
        if (analysis.junk.length > 0) {
            console.log(`\n🗑️  JUNK LISTINGS (should be filtered):`);
            analysis.junk.forEach(item => {
                console.log(`   ${item.index}. [${item.reason}] ${item.title.substring(0, 80)}`);
            });
        }

        // Детальный вывод sold
        if (analysis.sold.length > 0) {
            console.log(`\n💰 SOLD LISTINGS (should be filtered):`);
            analysis.sold.forEach(item => {
                console.log(`   ${item.index}. ${item.title.substring(0, 80)}`);
            });
        }

        // Детальный вывод incomplete
        if (analysis.incomplete.length > 0) {
            console.log(`\n⚠️  INCOMPLETE LISTINGS:`);
            analysis.incomplete.forEach(item => {
                console.log(`   ${item.index}. [${item.reason}] ${item.title.substring(0, 80)}`);
            });
        }

        // Показываем примеры valid
        if (analysis.valid.length > 0) {
            console.log(`\n✅ VALID LISTINGS (sample 3):`);
            analysis.valid.slice(0, 3).forEach(item => {
                const bike = results[item.index];
                console.log(`\n   ${item.index}. ${bike.title}`);
                console.log(`      Price: €${bike.price}`);
                console.log(`      Description: ${bike.description?.substring(0, 100)}...`);
                console.log(`      Images: ${bike.images?.length || 0}`);
                console.log(`      Location: ${bike.seller_location || 'N/A'}`);
            });
        }

        // Сохраняем результаты для анализа
        const fs = require('fs');
        const path = require('path');
        
        fs.writeFileSync(
            path.join(__dirname, '../logs/kleinanzeigen-diagnostic.json'),
            JSON.stringify({
                query: testQuery,
                total: results.length,
                analysis: {
                    valid_count: analysis.valid.length,
                    junk_count: analysis.junk.length,
                    sold_count: analysis.sold.length,
                    incomplete_count: analysis.incomplete.length
                },
                junk_examples: analysis.junk,
                results: results
            }, null, 2)
        );

        console.log(`\n💾 Full results saved to: backend/logs/kleinanzeigen-diagnostic.json`);

        console.log(`\n📈 RECOMMENDATIONS:`);
        if (analysis.junk.length > 0 || analysis.sold.length > 0) {
            console.log(`   ⚠️  ADD FILTERING: ${analysis.junk.length + analysis.sold.length} listings should be filtered at parser level`);
        }
        if (analysis.incomplete.length > 0) {
            console.log(`   ⚠️  IMPROVE EXTRACTION: ${analysis.incomplete.length} listings have incomplete data`);
        }
        if (analysis.valid.length < results.length * 0.5) {
            console.log(`   ⚠️  LOW QUALITY RATE: Only ${((analysis.valid.length / results.length) * 100).toFixed(1)}% valid listings`);
        }

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
    }

    // await collector.close(); // Not needed for static class
    process.exit(0);
}

testKleinanzeigenParser();
