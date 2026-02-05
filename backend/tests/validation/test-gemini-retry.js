if (!process.env.GEMINI_API_KEY_1) process.env.GEMINI_API_KEY_1 = 'test-key-1';
if (!process.env.GEMINI_API_KEY_2) process.env.GEMINI_API_KEY_2 = 'test-key-2';

const GeminiProcessor = require('../../src/services/geminiProcessor');
const DatabaseManager = require('../../database/db-manager');

const url = 'https://example.com/test-gemini-503';
const rawData = {
  title: 'Test Bike 503',
  description: 'Simulated Gemini 503 for retry test',
  price: 1200,
  url,
  source_platform: 'buycycle'
};

const run = async () => {
  const processor = GeminiProcessor;
  const delaysByAttempt = {};
  const rotationsByAttempt = {};
  let attemptCounter = 0;

  processor.callGeminiAPI = async () => {
    attemptCounter += 1;
    throw new Error('503 Service Unavailable');
  };

  processor.delay = async (ms) => {
    delaysByAttempt[attemptCounter] = ms;
  };

  const originalRotate = processor.rotateAPIKey.bind(processor);
  processor.rotateAPIKey = () => {
    const before = processor.currentKeyIndex;
    originalRotate();
    const after = processor.currentKeyIndex;
    rotationsByAttempt[attemptCounter] = { before: before + 1, after: after + 1 };
  };

  const logBuffer = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => logBuffer.push(args.join(' '));
  console.error = (...args) => logBuffer.push(args.join(' '));

  let fallback = null;
  try {
    fallback = await processor.analyzeBikeToUnifiedFormat(rawData, 3, 'buycycle');
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  console.log('🧪 GEMINI RETRY LOGIC TEST');
  console.log('');
  console.log('Simulating 503 Service Unavailable...');
  console.log('');

  for (let i = 1; i <= attemptCounter; i += 1) {
    console.log(`Attempt ${i}/3:`);
    console.log('   ❌ 503 Service Unavailable');
    if (rotationsByAttempt[i]) {
      console.log(`   🔄 Rotating API key (${rotationsByAttempt[i].before} → ${rotationsByAttempt[i].after})`);
    }
    if (delaysByAttempt[i]) {
      console.log(`   ⏳ Waiting ${delaysByAttempt[i] / 1000}s before retry...`);
    }
    console.log('');
  }

  console.log('All retries exhausted. Returning fallback.');
  console.log('');
  console.log('Fallback response:');
  const hasStructure = !!(fallback?.meta && fallback?.basic_info && fallback?.pricing);
  console.log(`   ✅ Valid Unified Format structure: ${hasStructure ? 'YES' : 'NO'}`);
  console.log(`   ⚠️  quality_score = ${fallback?.quality_score}`);
  console.log(`   ⚠️  needs_audit = ${fallback?.audit?.needs_audit}`);
  console.log(`   ✅ processing_error logged: ${fallback?.meta?.processing_error ? 'YES' : 'NO'}`);
  console.log('');

  console.log('Checking failed_bikes table...');
  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();
  let failedEntry = null;
  try {
    failedEntry = db.prepare('SELECT url, error_message, attempts, status FROM failed_bikes WHERE url = ? ORDER BY id DESC LIMIT 1').get(url);
  } catch (e) {
    console.log(`   ❌ failed_bikes check error: ${e.message}`);
  } finally {
    dbManager.close();
  }

  if (failedEntry) {
    console.log('   ✅ Entry logged:');
    console.log(`      - url: ${failedEntry.url}`);
    console.log(`      - error: "${failedEntry.error_message}"`);
    console.log(`      - attempts: ${failedEntry.attempts}`);
    console.log(`      - status: '${failedEntry.status}'`);
  } else {
    console.log('   ❌ Entry not found');
  }

  const backoffExpected = [5000, 10000, 20000];
  const backoffMatch = backoffExpected.every((ms, index) => delaysByAttempt[index + 1] === ms);
  const retryPass = attemptCounter === 3;
  const failedLogged = !!failedEntry;
  const qualityPass = fallback?.quality_score === 0;
  const auditPass = fallback?.audit?.needs_audit === true;

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✅ GEMINI RETRY TEST: ${retryPass && backoffMatch && failedLogged && qualityPass && auditPass ? 'PASSED' : 'FAILED'}`);
  console.log('═══════════════════════════════════════');

  if (!retryPass || !backoffMatch || !failedLogged || !qualityPass || !auditPass) {
    process.exit(1);
  }
};

run().catch((e) => {
  console.log(`❌ Ошибка: ${e.message}`);
  process.exit(1);
});
