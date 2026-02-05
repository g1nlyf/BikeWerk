/**
 * test-mass-with-logging.js
 * Массовый тест обработки байков с детальными логами для отлова ошибок JSON
 */

const UnifiedHunter = require('./unified-hunter');

async function testMass() {
    console.log('🧪 TEST: MASS BIKES WITH FULL LOGGING\n');

    // Запускаем Hunter с limit=5
    // Используем 'quick' режим, чтобы не тратить слишком много времени
    // Но достаточно, чтобы собрать несколько байков
    const hunter = new UnifiedHunter({
        mode: 'quick',
        limit: 5,
        sources: ['buycycle']
    });

    try {
        const result = await hunter.run();

        console.log('\n✅ TEST COMPLETED');
        console.log('📂 Check logs in: backend/logs/pipeline/');
        
        if (result && result.summary) {
            console.log(`� Summary: Processed ${result.summary.normalized} bikes`);
            console.log(`❌ Failed: ${result.summary.failedNormalization}`);
        }

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
    }

    process.exit(0);
}

testMass();
