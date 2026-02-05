
const GeminiProcessor = require('../telegram-bot/gemini-processor');

console.log('🛡️ Verifying "Guardian of Trust" (Confidence Score)...');

const processor = new GeminiProcessor('test_key');
const prompt = processor.createLeanPrompt({ title: 'Test Bike' });

console.log('--- Prompt Preview ---');
console.log(prompt.slice(0, 500) + '...');
console.log('----------------------');

if (prompt.includes('confidence_score')) {
    console.log('✅ Prompt requests "confidence_score".');
} else {
    console.error('❌ Prompt MISSING "confidence_score".');
    process.exit(1);
}

if (prompt.includes('0-100')) {
    console.log('✅ Prompt defines scale (0-100).');
} else {
    console.error('❌ Prompt scale undefined.');
}
