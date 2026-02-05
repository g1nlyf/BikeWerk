/**
 * Full FMV Collection Script (2015-2025)
 * 
 * Collects FMV data from buycycle, bikeflip, and kleinanzeigen
 * for all models in whitelist and all years 2015-2025.
 * 
 * Each model+year combination gets data from all three sources.
 * 
 * Usage: node backend/scripts/full-fmv-collection-2015-2025.js [--dry-run] [--limit=20]
 */

const path = require('path');
const fs = require('fs');
const FMVUrlBuilder = require('../src/services/FMVUrlBuilder');
const BikeflipUrlBuilder = require('../src/services/BikeflipUrlBuilder');
const KleinanzeigenFMVUrlBuilder = require('../src/services/KleinanzeigenFMVUrlBuilder');
const FMVCollector = require('../src/services/FMVCollector');
const { DatabaseManager } = require('../src/js/mysql-config');

// Configuration
const WHITELIST_PATH = path.resolve(__dirname, '../config/fmv-whitelist.json');
const YEAR_START = 2015;
const YEAR_END = 2025;
const DEFAULT_RECORDS_PER_SOURCE = 20;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const recordsPerSource = limitArg ? parseInt(limitArg.split('=')[1]) : DEFAULT_RECORDS_PER_SOURCE;

// Load whitelist
function loadWhitelist() {
    try {
        const content = fs.readFileSync(WHITELIST_PATH, 'utf8');
        const config = JSON.parse(content);
        
        // Flatten to array of { brand, model, category }
        const whitelist = [];
        for (const brandConfig of config.brands) {
            for (const modelConfig of brandConfig.models) {
                whitelist.push({
                    brand: brandConfig.brand,
                    model: modelConfig.model,
                    category: modelConfig.category
                });
            }
        }
        
        return whitelist;
    } catch (error) {
        console.error(`❌ Error loading whitelist: ${error.message}`);
        process.exit(1);
    }
}

// Generate collection plan
function generateCollectionPlan(whitelist, yearStart, yearEnd) {
    const plan = [];

    for (const item of whitelist) {
        for (let year = yearStart; year <= yearEnd; year++) {
            // Buycycle
            const buycyclePlan = FMVUrlBuilder.generateCollectionPlan(
                [{ brand: item.brand, model: item.model }],
                { start: year, end: year }
            );
            buycyclePlan.forEach(p => {
                p.source = 'buycycle';
                plan.push(p);
            });

            // Bikeflip
            const bikeflipPlan = BikeflipUrlBuilder.generateCollectionPlan(
                [{ brand: item.brand, model: item.model }],
                { start: year, end: year }
            );
            plan.push(...bikeflipPlan);

            // Kleinanzeigen
            const kleinanzeigenPlan = KleinanzeigenFMVUrlBuilder.generateCollectionPlan(
                [{ brand: item.brand, model: item.model }],
                { start: year, end: year }
            );
            plan.push(...kleinanzeigenPlan);
        }
    }

    return plan;
}

// Process tasks with progress tracking
async function processTasks(plan, recordsPerSource, isDryRun) {
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
        },
        byModel: {}
    };

    // Initialize database
    const dbManager = new DatabaseManager();
    if (!isDryRun) {
        await dbManager.initialize();
        console.log('✅ Database initialized\n');
    }

    // Initialize FMVCollector DB if needed
    if (!FMVCollector.db || !FMVCollector.db.db) {
        await FMVCollector.db.initialize();
    }

    const startTime = Date.now();

    for (const task of plan) {
        const taskNum = stats.processed + 1;
        const progress = ((taskNum / stats.total) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const estimated = stats.processed > 0 
            ? ((Date.now() - startTime) / stats.processed * (stats.total - stats.processed) / 1000).toFixed(0)
            : '?';

        console.log(`\n[${taskNum}/${stats.total}] (${progress}%) ${task.brand} ${task.model} ${task.year} (${task.source})`);
        console.log(`   ⏱️  Elapsed: ${elapsed}s, ETA: ${estimated}s`);
        console.log(`   🌐 URL: ${task.url}`);

        if (isDryRun) {
            console.log(`   🔍 [DRY RUN] Would collect up to ${recordsPerSource} records`);
            stats.processed++;
            continue;
        }

        try {
            const result = await FMVCollector.collect(task, recordsPerSource);
            
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

            // Track by model
            const modelKey = `${task.brand} ${task.model}`;
            if (!stats.byModel[modelKey]) {
                stats.byModel[modelKey] = { collected: 0, duplicates: 0, errors: 0 };
            }
            stats.byModel[modelKey].collected += result.collected;
            stats.byModel[modelKey].duplicates += result.duplicates;
            if (result.errors > 0) {
                stats.byModel[modelKey].errors += result.errors;
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
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    return { stats, dbManager };
}

// Print summary
function printSummary(stats, dbManager, isDryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COLLECTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total tasks: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    
    if (!isDryRun) {
        console.log(`\n📈 Records collected: ${stats.collected}`);
        console.log(`🔄 Duplicates skipped: ${stats.duplicates}`);
        console.log(`❌ Errors: ${stats.errors}`);
        
        console.log('\n📊 By Source:');
        console.log(`  Buycycle:      ${stats.bySource.buycycle.collected} collected, ${stats.bySource.buycycle.duplicates} duplicates, ${stats.bySource.buycycle.errors} errors`);
        console.log(`  Bikeflip:      ${stats.bySource.bikeflip.collected} collected, ${stats.bySource.bikeflip.duplicates} duplicates, ${stats.bySource.bikeflip.errors} errors`);
        console.log(`  Kleinanzeigen: ${stats.bySource.kleinanzeigen.collected} collected, ${stats.bySource.kleinanzeigen.duplicates} duplicates, ${stats.bySource.kleinanzeigen.errors} errors`);
        
        console.log('\n📋 Top Models by Collection:');
        const sortedModels = Object.entries(stats.byModel)
            .sort((a, b) => b[1].collected - a[1].collected)
            .slice(0, 10);
        sortedModels.forEach(([model, data]) => {
            console.log(`   ${model}: ${data.collected} collected, ${data.duplicates} duplicates`);
        });
    } else {
        console.log('\n🔍 [DRY RUN] No data was collected');
    }
}

// Verify database
async function verifyDatabase(dbManager) {
    console.log('\n🔍 Verifying database...');
    try {
        const db = dbManager.db;
        
        const totalRecords = await db.get('SELECT COUNT(*) as count FROM market_history');
        console.log(`\n✅ Total records in market_history: ${totalRecords.count}`);
        
        const bySource = await db.all(`
            SELECT source_platform, COUNT(*) as count 
            FROM market_history 
            GROUP BY source_platform
            ORDER BY count DESC
        `);
        console.log('\n📊 Records by source:');
        bySource.forEach(row => {
            console.log(`   ${row.source_platform}: ${row.count}`);
        });

        const byYear = await db.all(`
            SELECT year, COUNT(*) as count
            FROM market_history
            WHERE year BETWEEN ? AND ?
            GROUP BY year
            ORDER BY year
        `, [YEAR_START, YEAR_END]);
        console.log('\n📅 Records by year:');
        byYear.forEach(row => {
            console.log(`   ${row.year}: ${row.count} records`);
        });

        const byModelYear = await db.all(`
            SELECT brand, model, year, COUNT(*) as count
            FROM market_history
            WHERE year BETWEEN ? AND ?
            GROUP BY brand, model, year
            ORDER BY brand, model, year
            LIMIT 20
        `, [YEAR_START, YEAR_END]);
        console.log('\n📋 Sample records by model+year (first 20):');
        byModelYear.forEach(row => {
            console.log(`   ${row.brand} ${row.model} ${row.year}: ${row.count} records`);
        });

    } catch (error) {
        console.error(`❌ Database verification error: ${error.message}`);
    }
}

// Main function
async function run() {
    console.log('🚀 FULL FMV COLLECTION (2015-2025)');
    console.log('='.repeat(80));
    
    if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No data will be collected');
    }
    
    console.log(`📅 Years: ${YEAR_START}-${YEAR_END}`);
    console.log(`📊 Records per source: ${recordsPerSource}`);
    console.log('='.repeat(80));
    console.log('');

    // Load whitelist
    console.log('📋 Loading whitelist...');
    const whitelist = loadWhitelist();
    console.log(`✅ Loaded ${whitelist.length} models from ${whitelist.reduce((acc, item) => {
        if (!acc[item.brand]) acc[item.brand] = 0;
        acc[item.brand]++;
        return acc;
    }, {})} brands`);

    // Generate plan
    console.log('\n📋 Generating collection plan...');
    const plan = generateCollectionPlan(whitelist, YEAR_START, YEAR_END);
    console.log(`✅ Generated ${plan.length} collection tasks`);
    console.log(`   (${whitelist.length} models × ${YEAR_END - YEAR_START + 1} years × 3 sources)`);

    // Process tasks
    const { stats, dbManager } = await processTasks(plan, recordsPerSource, isDryRun);

    // Print summary
    printSummary(stats, dbManager, isDryRun);

    // Verify database
    if (!isDryRun) {
        await verifyDatabase(dbManager);
    }

    console.log('\n✅ Collection complete!');
    if (!isDryRun) {
        await dbManager.close();
    }
}

// Run
if (require.main === module) {
    run().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { run, loadWhitelist, generateCollectionPlan };
