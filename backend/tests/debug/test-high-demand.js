const BuycycleCollector = require('../../scrapers/buycycle-collector');

async function testHighDemand() {
    try {
        console.log('🚀 Testing High Demand Hunt...');
        // Test with "mountainbike" high demand
        const results = await BuycycleCollector.collectHighDemand('mountainbike/high-demand/1', 2);
        
        console.log('\n════════ RESULTS ════════');
        results.forEach((bike, i) => {
            console.log(`\n🚲 Bike #${i + 1}: ${bike.basic_info.brand} ${bike.basic_info.model}`);
            console.log(`   Price: ${bike.pricing.price} EUR`);
            console.log(`   Condition Score: ${bike.condition.score} (${bike.condition.grade})`);
            console.log(`   Ranking Score: ${bike.ranking.ranking_score}`);
            console.log(`   Is High Demand: ${bike.meta.is_high_demand}`);
            console.log(`   URL: ${bike.meta.source_url}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testHighDemand();
