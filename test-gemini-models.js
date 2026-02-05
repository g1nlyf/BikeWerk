const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, 'telegram-bot/.env') });

const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS || process.env.GEMINI_API_KEY || '';
const API_KEYS = keysRaw.split(/[,;|\s]+/).filter(Boolean);

// Unique keys
const uniqueKeys = [...new Set(API_KEYS)];

console.log(`Loaded ${uniqueKeys.length} keys.`);

if (uniqueKeys.length === 0) {
    console.error('No GEMINI_API_KEYS configured (set GEMINI_API_KEYS or GEMINI_API_KEY).');
    process.exit(1);
}

const MODELS_TO_TEST = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite-preview-02-05',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.0-pro'
];

async function testModel(model, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "Hello, just say OK." }] }]
        }, { timeout: 5000 });
        
        if (response.status === 200) {
            return { success: true, status: 200 };
        }
        return { success: false, status: response.status };
    } catch (e) {
        if (e.response) {
            return { success: false, status: e.response.status, error: e.response.data?.error?.message };
        }
        return { success: false, status: 'NET_ERR', error: e.message };
    }
}

async function runTests() {
    console.log('Starting model tests...');
    
    // We will test each model with a few keys (to avoid hitting limit on one key if it's dead)
    // Actually, let's just pick one working key. We need to find ONE working key first.
    
    let workingKey = null;
    
    // Try to find a working key with a safe model (1.5 flash)
    console.log('Searching for a working key using gemini-1.5-flash...');
    for (const key of uniqueKeys) {
        const res = await testModel('gemini-1.5-flash', key);
        if (res.success) {
            workingKey = key;
            console.log(`✅ Found working key: ...${key.slice(-4)}`);
            break;
        } else {
            process.stdout.write(`❌ Key ...${key.slice(-4)} failed (${res.status})\r`);
        }
    }
    console.log(''); // newline

    if (!workingKey) {
        console.error('❌ Could not find ANY working key with gemini-1.5-flash. Trying 2.0-flash...');
        // Try 2.0 flash just in case
        for (const key of uniqueKeys) {
            const res = await testModel('gemini-2.0-flash', key);
            if (res.success) {
                workingKey = key;
                console.log(`✅ Found working key: ...${key.slice(-4)}`);
                break;
            }
        }
    }

    if (!workingKey) {
        console.error('❌ ALL KEYS FAILED. Cannot test models.');
        return;
    }

    console.log(`\nTesting models with key ...${workingKey.slice(-4)}:`);
    const results = [];
    for (const model of MODELS_TO_TEST) {
        process.stdout.write(`Testing ${model}... `);
        const res = await testModel(model, workingKey);
        if (res.success) {
            console.log('✅ OK');
            results.push({ model, status: 'OK' });
        } else {
            console.log(`❌ FAILED (${res.status}): ${res.error ? res.error.substring(0, 100) : ''}`);
            results.push({ model, status: 'FAILED', error: res.error });
        }
    }

    console.log('\nSummary:');
    console.table(results);
}

runTests();
