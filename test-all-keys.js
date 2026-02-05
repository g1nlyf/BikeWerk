const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, 'telegram-bot/.env') });

const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS || process.env.GEMINI_API_KEY || '';
const API_KEYS = keysRaw.split(/[,;|\s]+/).filter(Boolean);

// Unique keys
const uniqueKeys = [...new Set(API_KEYS)];

console.log(`Found ${uniqueKeys.length} unique keys in configuration.`);

// Prioritize gemini-2.5-flash as requested, but fall back if it doesn't exist to verify keys are valid at all
const MODELS_TO_TEST = ['gemini-2.5-flash', 'gemini-2.0-flash-lite-preview-02-05', 'gemini-flash-latest', 'gemini-1.5-flash'];

async function testKey(key, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: "Hi" }] }]
    }, { timeout: 8000 });

    if (response.status === 200) {
      return { success: true };
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
  console.log('Starting tests...');
  
  // First, verify which model works with the first key to avoid testing all keys on a broken model name
  let workingModel = null;
  const firstKey = uniqueKeys[0];
  
  if (!firstKey) {
    console.error("No GEMINI_API_KEYS configured (set GEMINI_API_KEYS or GEMINI_API_KEY).");
    return;
  }

  console.log(`\nProbationary test with first key (${firstKey.slice(-4)}) to find working model...`);
  
  for (const model of MODELS_TO_TEST) {
    process.stdout.write(`Testing model ${model}... `);
    const res = await testKey(firstKey, model);
    if (res.success) {
      console.log('✅ Works!');
      workingModel = model;
      break;
    } else {
      console.log(`❌ Failed (${res.status}) ${res.error ? res.error.substring(0, 50) : ''}`);
      if (res.status === 404) {
         console.log(`   (Model ${model} likely does not exist)`);
      }
    }
  }

  if (!workingModel) {
    console.error("\n❌ Could not find any working model with the first key. Please check the keys or network.");
    // We will still try to test all keys with the requested model just in case the first key was bad
    workingModel = 'gemini-2.5-flash'; 
  }

  console.log(`\n=== Testing all ${uniqueKeys.length} keys against model: ${workingModel} ===\n`);

  const results = {
    valid: [],
    invalid: []
  };

  for (let i = 0; i < uniqueKeys.length; i++) {
    const key = uniqueKeys[i];
    const keyMasked = `...${key.slice(-6)}`;
    process.stdout.write(`[${i+1}/${uniqueKeys.length}] Key ${keyMasked}: `);

    const res = await testKey(key, workingModel);

    if (res.success) {
      console.log('✅ OK');
      results.valid.push(key);
    } else {
      console.log(`❌ FAILED (${res.status}) ${res.error ? '- ' + res.error.substring(0, 50) + '...' : ''}`);
      results.invalid.push({ key, error: res.error, status: res.status });
    }

    // Slight delay to avoid local rate limits/congestion
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Model Used: ${workingModel}`);
  console.log(`Total Keys: ${uniqueKeys.length}`);
  console.log(`Valid: ${results.valid.length}`);
  console.log(`Invalid: ${results.invalid.length}`);

  if (results.invalid.length > 0) {
    console.log('\n⚠️  Invalid Keys (Please replace these):');
    results.invalid.forEach(k => console.log(`${k.key} (${k.status})`));
  } else {
    console.log('\n🎉 All keys are valid!');
  }
}

runTests();
