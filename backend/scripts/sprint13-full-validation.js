
const { smartHunt } = require('./unified-hunter');
const Database = require('better-sqlite3');
const path = require('path');
const { execSync } = require('child_process');

const DB_PATH = path.join(__dirname, '../database/eubike.db');

// Targets for rapid catalog population (High Value Brands)
const TARGETS = [
    { brand: 'Canyon', model: 'Spectral' }
];

async function runValidation() {
    console.log('🧪 SPRINT 13: FULL SYSTEM VALIDATION START');
    
    // 1. Reset Catalog
    console.log('\n🗑️  Step 1: Resetting Catalog...');
    try {
        execSync('node backend/scripts/nuclear-reset-catalog.js', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Reset failed. Stopping.');
        process.exit(1);
    }

    const db = new Database(DB_PATH);

    // 2. Run Smart Hunt Loop
    console.log('\n🏹 Step 2: Running Smart Hunter Loop...');
    let totalCollected = 0;

    for (const target of TARGETS) {
        try {
            console.log(`\n   🎯 Hunting ${target.brand} ${target.model}...`);
            // Run smartHunt (now handles saving internally)
            const bikes = await smartHunt(target.brand, target.model);
            
            if (bikes && bikes.length > 0) {
                console.log(`      ✅ Added ${bikes.length} bikes.`);
                totalCollected += bikes.length;
            } else {
                console.log('      ⚠️ No bikes found for this target.');
            }
        } catch (e) {
            console.error(`      ❌ Error hunting ${target.brand}: ${e.message}`);
        }
    }

    // 3. Validation
    console.log('\n📊 Step 3: Validation & Metrics');
    try {
        const finalCount = db.prepare('SELECT count(*) as c FROM bikes').get().c;
        const errorCount = db.prepare('SELECT count(*) as c FROM bikes WHERE price IS NULL OR brand IS NULL').get().c;
        const sourceStats = db.prepare("SELECT source_url, count(*) as c FROM bikes GROUP BY CASE WHEN source_url LIKE '%buycycle%' THEN 'Buycycle' WHEN source_url LIKE '%kleinanzeigen%' THEN 'Kleinanzeigen' ELSE 'Other' END").all();
        
        console.log(`   Final Catalog Size: ${finalCount} (Target: 1+)`);
        console.log(`   Error Rate: ${errorCount}/${finalCount} (${finalCount > 0 ? ((errorCount/finalCount)*100).toFixed(1) : 0}%)`);
        console.log(`   Source Breakdown: ${JSON.stringify(sourceStats)}`);

        // Detailed Check
        const sample = db.prepare('SELECT id, name, quality_score, is_active FROM bikes LIMIT 1').get();
        if (sample) {
            console.log(`   Sample Bike: ${sample.name} | Quality: ${sample.quality_score} | Active: ${sample.is_active}`);
            if (sample.quality_score === 100) console.warn('   ⚠️ WARNING: Sample Quality Score is 100!');
        }

        if (finalCount >= 1 && errorCount === 0) {
            console.log('\n✅ TEST PASSED (System is operational)');
        } else {
            console.log('\n⚠️ TEST COMPLETED (Check metrics)');
        }
    } catch (e) {
        console.error('Validation Check Failed:', e);
    } finally {
        db.close();
    }
}

runValidation();
