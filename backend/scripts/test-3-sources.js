
const FMVCollector = require('../src/services/FMVCollector');
const FMVUrlBuilder = require('../src/services/FMVUrlBuilder');
const BikeflipUrlBuilder = require('../src/services/BikeflipUrlBuilder');
const KleinanzeigenFMVUrlBuilder = require('../src/services/KleinanzeigenFMVUrlBuilder');
const { DatabaseManager } = require('../src/js/mysql-config');

async function test3Sources() {
    console.log('🧪 TESTING 3 SOURCES (Buycycle, BikeFlip, Kleinanzeigen)');
    
    // Use Specialized Stumpjumper 2022 as target
    const target = { brand: 'Specialized', model: 'Stumpjumper' };
    const year = 2022;
    const limit = 5;

    // 1. Buycycle
    console.log('\n--- 1. Testing Buycycle ---');
    const buyUrl = FMVUrlBuilder.generateCollectionPlan([target], { start: year, end: year })[0].url;
    try {
        await FMVCollector.collect({
            source: 'buycycle',
            brand: target.brand,
            model: target.model,
            year: year,
            url: buyUrl
        }, limit);
    } catch (e) {
        console.error('❌ Buycycle Failed:', e.message);
    }

    // 2. BikeFlip
    console.log('\n--- 2. Testing BikeFlip ---');
    const flipUrl = BikeflipUrlBuilder.generateCollectionPlan([target], { start: year, end: year })[0].url;
    try {
        await FMVCollector.collect({
            source: 'bikeflip',
            brand: target.brand,
            model: target.model,
            year: year,
            url: flipUrl
        }, limit);
    } catch (e) {
        console.error('❌ BikeFlip Failed:', e.message);
    }

    // 3. Kleinanzeigen
    console.log('\n--- 3. Testing Kleinanzeigen ---');
    const kleinUrl = KleinanzeigenFMVUrlBuilder.generateCollectionPlan([target], { start: year, end: year })[0].url;
    try {
        await FMVCollector.collect({
            source: 'kleinanzeigen',
            brand: target.brand,
            model: target.model,
            year: year,
            url: kleinUrl
        }, limit);
    } catch (e) {
        console.error('❌ Kleinanzeigen Failed:', e.message);
    }

    // Verify DB
    const db = new DatabaseManager();
    const stats = await db.query(`
        SELECT source_platform, count(*) as count, avg(price_eur) as avg_price 
        FROM market_history 
        WHERE brand = ? AND model = ? AND year = ?
        GROUP BY source_platform
    `, [target.brand, target.model, year]);
    
    console.log('\n📊 Final Verification Stats:');
    console.table(stats);
}

test3Sources().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
