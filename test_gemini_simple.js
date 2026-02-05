
const { GeminiClient } = require('./telegram-bot/autocat-klein/src/lib/geminiClient.ts');

async function test() {
    console.log('Testing Gemini Client...');
    const client = new GeminiClient();
    try {
        const res = await client.generateContent('Hello, are you working?');
        console.log('Success:', res);
    } catch (e) {
        console.error('Failed:', e.message);
    }
}

test();
