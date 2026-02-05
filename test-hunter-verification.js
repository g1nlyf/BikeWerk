const UnifiedHunter = require('./backend/scripts/unified-hunter.js');
const DatabaseServiceV2 = require('./backend/services/database-service-v2.js');

async function testHunter() {
    console.log('🧪 Starting Hunter Test...');

    try {
        // Run in test mode with limit 1
        console.log('🏃 Running hunt (source=buycycle, mode=test)...');
        const result = await UnifiedHunter.run({
            mode: 'test',
            sources: ['buycycle'],
            limit: 1,
            returnBikes: true
        });

        console.log('\n✅ Hunt completed.');
        console.log('📊 Summary:', JSON.stringify(result.summary, null, 2));

        if (result.bikes.length > 0) {
            const bike = result.bikes[0];
            console.log(`\n🚲 Verifying bike: ${bike.basic_info.name}`);

            const db = new DatabaseServiceV2();
            const exists = db.bikeExists(bike.meta.source_ad_id, bike.meta.source_platform);
            console.log(`🗄️ ID in DB: ${bike.meta.source_ad_id} -> Exists? ${exists}`);

            if (exists) {
                console.log('🎉 SUCCESS: Bike was found in the database!');

                // Cleanup test bike
                console.log('🧹 Cleaning up test data...');
                db.deleteTestBike(bike.meta.source_ad_id, bike.meta.source_platform);
                console.log('✨ Cleanup done.');
            } else {
                console.error('⛔ FAILURE: Bike NOT found in DB after save.');
                process.exit(1);
            }
        } else {
            console.warn('⚠️ No bikes returned to verify.');
        }

    } catch (err) {
        console.error('💥 Test Failed:', err);
        process.exit(1);
    }
}

testHunter();
