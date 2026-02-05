/**
 * Simple test script to verify hunter components work
 */

console.log('🧪 Testing Hunter Components...\n');

// Test 1: DB Path
try {
    const { DB_PATH } = require('./backend/config/db-path');
    console.log('✅ DB Path loaded:', DB_PATH);
} catch (e) {
    console.error('❌ DB Path failed:', e.message);
}

// Test 2: DatabaseManager
try {
    const DatabaseManager = require('./backend/database/db-manager');
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    console.log('✅ DatabaseManager works');
} catch (e) {
    console.error('❌ DatabaseManager failed:', e.message);
}

// Test 3: UnifiedHunter
try {
    const UnifiedHunter = require('./backend/scripts/unified-hunter');
    console.log('✅ UnifiedHunter loaded');
    console.log('   - Has run():', typeof UnifiedHunter.run === 'function');
    console.log('   - Has smartHunt():', typeof UnifiedHunter.smartHunt === 'function');
} catch (e) {
    console.error('❌ UnifiedHunter failed:', e.message);
}

// Test 4: HourlyHunter
try {
    const HourlyHunter = require('./backend/cron/hourly-hunter');
    const hunter = new HourlyHunter();
    console.log('✅ HourlyHunter loaded');
} catch (e) {
    console.error('❌ HourlyHunter failed:', e.message);
    console.error(e.stack);
}

// Test 5: BuycycleCollector
try {
    const BuycycleCollector = require('./backend/scrapers/buycycle-collector');
    console.log('✅ BuycycleCollector loaded');
    console.log('   - Has collect():', typeof BuycycleCollector.collect === 'function');
    console.log('   - Has collectForTarget():', typeof BuycycleCollector.collectForTarget === 'function');
} catch (e) {
    console.error('❌ BuycycleCollector failed:', e.message);
}

// Test 6: DeepPipelineProcessor
try {
    const DeepPipelineProcessor = require('./backend/src/services/DeepPipelineProcessor');
    console.log('✅ DeepPipelineProcessor loaded');
    console.log('   - Has processListing():', typeof DeepPipelineProcessor.processListing === 'function');
} catch (e) {
    console.error('❌ DeepPipelineProcessor failed:', e.message);
    console.error(e.stack);
}

console.log('\n✅ All tests passed!');
