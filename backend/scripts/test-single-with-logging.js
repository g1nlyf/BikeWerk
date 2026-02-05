/**
 * test-single-with-logging.js
 * Тест обработки ОДНОГО байка с детальными логами
 */

const UnifiedHunter = require('./unified-hunter');

async function testSingle() {
    console.log('🧪 TEST: ONE BIKE WITH FULL LOGGING\n');

    // Запускаем Hunter с limit=1
    const hunter = new UnifiedHunter({
        mode: 'quick',
        limit: 1,
        sources: ['buycycle']
    });

    try {
        await hunter.run();

        console.log('\n✅ TEST COMPLETED');
        console.log('📂 Check logs in: backend/logs/pipeline/');
        console.log('\nФайлы для анализа:');
        console.log('   - *_01_raw_input.json');
        console.log('   - *_02_prompt.txt');
        console.log('   - *_03_ai_response_raw.txt');
        console.log('   - *_04_extracted_json.txt');
        console.log('   - *_05_BROKEN_json.json (если была ошибка)');
        console.log('   - *_summary.json');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
    }

    process.exit(0);
}

testSingle();
