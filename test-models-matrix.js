const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, 'telegram-bot/.env') });

const keysRaw = '';
const singleKey = 'AIzaSyBwFKlgRwTPpx8Ufss9_aOYm9zikt9SGj0';
const API_KEYS = [singleKey];

// Unique keys
const uniqueKeys = [...new Set(API_KEYS)];

if (uniqueKeys.length === 0) {
    console.error('No keys found!');
    process.exit(1);
}

// Select 10 random keys
const randomKeys = uniqueKeys.sort(() => 0.5 - Math.random()).slice(0, 10);
console.log(`Selected ${randomKeys.length} random keys for testing from pool of ${uniqueKeys.length}.`);

const MODELS_TO_TEST = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite-preview-02-05',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.0-pro',
    'gemini-pro' // legacy
];

async function testModel(model, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "Hi" }] }]
        }, { timeout: 8000 });
        
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
    console.log('Starting comprehensive model matrix test...');
    
    const modelStats = {};
    MODELS_TO_TEST.forEach(m => modelStats[m] = { success: 0, fail: 0, errors: {} });

    for (const model of MODELS_TO_TEST) {
        console.log(`\n--- Testing Model: ${model} ---`);
        for (const key of randomKeys) {
            const keyMasked = `...${key.slice(-4)}`;
            process.stdout.write(`Key ${keyMasked}: `);
            const res = await testModel(model, key);
            
            if (res.success) {
                console.log('✅ OK');
                modelStats[model].success++;
            } else {
                console.log(`❌ ${res.status} ${res.error ? '(' + res.error.substring(0, 30) + '...)' : ''}`);
                modelStats[model].fail++;
                const errKey = `${res.status}`;
                modelStats[model].errors[errKey] = (modelStats[model].errors[errKey] || 0) + 1;
            }
            // Small delay to avoid burst limits
            await new Promise(r => setTimeout(r, 200));
        }
    }

    console.log('\n\n=== TEST RESULTS ===');
    const table = [];
    for (const model of MODELS_TO_TEST) {
        const s = modelStats[model];
        const total = s.success + s.fail;
        const rate = total > 0 ? Math.round((s.success / total) * 100) : 0;
        table.push({
            Model: model,
            SuccessRate: `${rate}% (${s.success}/${total})`,
            Errors: JSON.stringify(s.errors)
        });
    }
    console.table(table);
    
    // Recommend best models
    const workingModels = table.filter(r => r.SuccessRate !== '0% (0/10)').map(r => r.Model);
    console.log('\nRecommended Models:', workingModels.length > 0 ? workingModels : 'NONE');
}

runTests();
