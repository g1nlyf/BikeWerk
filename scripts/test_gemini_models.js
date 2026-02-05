let axiosLib;
try {
    axiosLib = require('axios');
} catch (e) {
    try {
        axiosLib = require('../telegram-bot/node_modules/axios');
    } catch (e2) {
        console.error('❌ Could not load axios. Please run npm install in telegram-bot directory.');
        process.exit(1);
    }
}

const axios = axiosLib.default || axiosLib;

// Keys to test
const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS || process.env.GEMINI_API_KEY || '';
const keys = keysRaw.split(/[,;|\s]+/).filter(Boolean);
if (keys.length === 0) {
    console.error('No GEMINI_API_KEYS configured (set GEMINI_API_KEYS or GEMINI_API_KEY).');
    process.exit(1);
}

async function testModel(apiKey, modelName, version = 'v1beta') {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: "Hello" }] }]
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            validateStatus: () => true
        });

        if (response.status === 200) {
            console.log(`   ✅ Success with key ${apiKey.substring(0, 5)}... Model: ${modelName}`);
            return true;
        } else {
             if (response.data?.error?.message?.includes('location')) {
                 console.log(`   ❌ Key ${apiKey.substring(0, 5)}... Model: ${modelName} -> Location Restricted`);
             } else {
                 console.log(`   ❌ Key ${apiKey.substring(0, 5)}... Model: ${modelName} -> ${response.status} - ${response.data?.error?.message}`);
             }
             return false;
        }
    } catch (error) {
        console.log(`   ❌ Exception: ${error.message}`);
        return false;
    }
}

async function run() {
    console.log(`Testing ${keys.length} keys.`);

    const modelsToTest = [
        'gemini-2.5-flash'
    ];

    for (const model of modelsToTest) {
        console.log(`\n🤖 Testing Model: ${model}...`);
        for (const key of keys) {
            await testModel(key, model);
        }
    }
}

run();
