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
const keys = [
    'AIzaSyCS6qbM0otGtFcrLbqi_X44oQUCMkCV8kY', // Backend key
    'AIzaSyBwFKlgRwTPpx8Ufss9_aOYm9zikt9SGj0', // Bot key 1
];

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
