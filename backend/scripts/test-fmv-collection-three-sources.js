/**
 * Test FMV Collection from Three Sources
 * 
 * Tests collection from buycycle, bikeflip, and kleinanzeigen
 * for a few models/years to verify everything works correctly.
 * 
 * Usage: node backend/scripts/test-fmv-collection-three-sources.js
 */

const path = require('path');
const FMVUrlBuilder = require('../src/services/FMVUrlBuilder');
const BikeflipUrlBuilder = require('../src/services/BikeflipUrlBuilder');
const KleinanzeigenFMVUrlBuilder = require('../src/services/KleinanzeigenFMVUrlBuilder');
const FMVCollector = require('../src/services/FMVCollector');
const { DatabaseManager } = require('../src/js/mysql-config');

// Test configuration
const TEST_MODELS = [
    { brand: 'YT', model: 'Tues' },
    { brand: 'YT', model: 'Capra' },
    { brand: 'Specialized', model: 'Status' }
];

const TEST_YEARS = [2015, 2016, 2017];
const RECORDS_PER_SOURCE = 20;

async function runTest() {
    console.log('🧪 TEST FMV COLLECTION - THREE SOURCES');
    console.log('=' .repeat(60));
    console.log(`📋 Models: ${TEST_MODELS.map(m => `${m.brand} ${m.model}`).join(', ')}`);
    console.log(`📅 Years: ${TEST_YEARS.join(', ')}`);
    console.log(`📊 Records per source: ${RECORDS_PER_SOURCE}`);
    console.log('=' .repeat(60));
    console.log('');

    // Initialize database
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    console.log('✅ Database initialized\n');

    // Generate collection plan for all three sources
    const plan = [];

    for (const model of TEST_MODELS) {
        for (const year of TEST_YEARS) {
            // Buycycle
            const buycyclePlan = FMVUrlBuilder.generateCollectionPlan(
                [{ brand: model.brand, model: model.model }],
                { start: year, end: year }
            );
            buycyclePlan.forEach(p => {
                p.source = 'buycycle';
                plan.push(p);
            });

            // Bikeflip
            const bikeflipPlan = BikeflipUrlBuilder.generateCollectionPlan(
                [{ brand: model.brand, model: model.model }],
                { start: year, end: year }
            );
            plan.push(...bikeflipPlan);

            // Kleinanzeigen
            const kleinanzeigenPlan = KleinanzeigenFMVUrlBuilder.generateCollectionPlan(
                [{ brand: model.brand, model: model.model }],
                { start: year, end: year }
            );
            plan.push(...kleinanzeigenPlan);
        }
    }

    console.log(`📋 Generated ${plan.length} collection tasks\n`);

    // Statistics
    const stats = {
        total: plan.length,
        processed: 0,
        collected: 0,
        duplicates: 0,
        errors: 0,
        bySource: {
            buycycle: { collected: 0, duplicates: 0, errors: 0 },
            bikeflip: { collected: 0, duplicates: 0, errors: 0 },
            kleinanzeigen: { collected: 0, duplicates: 0, errors: 0 }
        }
    };

    // Process each task
    for (const task of plan) {
        const taskNum = stats.processed + 1;
        console.log(`\n[${taskNum}/${stats.total}] Processing: ${task.brand} ${task.model} ${task.year} (${task.source})`);
        console.log(`   URL: ${task.url}`);

        try {
            // Ensure DB is initialized before collection
            if (!FMVCollector.db || !FMVCollector.db.db) {
                await FMVCollector.db.initialize();
            }

            const result = await FMVCollector.collect(task, RECORDS_PER_SOURCE);
            
            stats.collected += result.collected;
            stats.duplicates += result.duplicates;
            if (result.errors > 0) {
                stats.errors += result.errors;
            }

            stats.bySource[task.source].collected += result.collected;
            stats.bySource[task.source].duplicates += result.duplicates;
            if (result.errors > 0) {
                stats.bySource[task.source].errors += result.errors;
            }

            console.log(`   ✅ Collected: ${result.collected}, Duplicates: ${result.duplicates}, Errors: ${result.errors}`);

        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            stats.errors++;
            stats.bySource[task.source].errors++;
        }

        stats.processed++;

        // Rate limiting between tasks
        if (stats.processed < stats.total) {
            console.log('   💤 Cooling down (2s)...');
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 COLLECTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tasks: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`\n📈 Records collected: ${stats.collected}`);
    console.log(`🔄 Duplicates skipped: ${stats.duplicates}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log('\n📊 By Source:');
    console.log(`  Buycycle:      ${stats.bySource.buycycle.collected} collected, ${stats.bySource.buycycle.duplicates} duplicates, ${stats.bySource.buycycle.errors} errors`);
    console.log(`  Bikeflip:      ${stats.bySource.bikeflip.collected} collected, ${stats.bySource.bikeflip.duplicates} duplicates, ${stats.bySource.bikeflip.errors} errors`);
    console.log(`  Kleinanzeigen: ${stats.bySource.kleinanzeigen.collected} collected, ${stats.bySource.kleinanzeigen.duplicates} duplicates, ${stats.bySource.kleinanzeigen.errors} errors`);

    // Verify database
    console.log('\n🔍 Verifying database...');
    try {
        const db = dbManager.db;
        const totalRecords = await db.get('SELECT COUNT(*) as count FROM market_history');
        const bySource = await db.all(`
            SELECT source_platform, COUNT(*) as count 
            FROM market_history 
            WHERE brand IN (?, ?, ?) AND model IN (?, ?, ?)
            GROUP BY source_platform
        `, ['YT', 'Specialized', 'YT', 'Tues', 'Capra', 'Status']);

        console.log(`\n✅ Total records in market_history: ${totalRecords.count}`);
        console.log('📊 Records by source:');
        bySource.forEach(row => {
            console.log(`   ${row.source_platform}: ${row.count}`);
        });

        // Check for test models
        const testRecords = await db.all(`
            SELECT brand, model, year, source_platform, COUNT(*) as count
            FROM market_history
            WHERE (brand = 'YT' AND model IN ('Tues', 'Capra')) 
               OR (brand = 'Specialized' AND model = 'Status')
            GROUP BY brand, model, year, source_platform
            ORDER BY brand, model, year, source_platform
        `);

        console.log('\n📋 Test records breakdown:');
        testRecords.forEach(row => {
            console.log(`   ${row.brand} ${row.model} ${row.year} (${row.source_platform}): ${row.count} records`);
        });

    } catch (error) {
        console.error(`❌ Database verification error: ${error.message}`);
    }

    console.log('\n✅ Test complete!');
    await dbManager.close();
}

// Run
if (require.main === module) {
    runTest().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runTest };
