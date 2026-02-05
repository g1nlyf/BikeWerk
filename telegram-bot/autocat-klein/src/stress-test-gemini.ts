import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.0-flash'; // Focusing on the main working fallback

if (!API_KEY) {
    console.error("❌ No API Key found! Check .env file.");
    process.exit(1);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function sendRequest(label: string, text: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    const start = Date.now();
    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text }] }]
        }, { validateStatus: () => true });
        
        const duration = Date.now() - start;
        return { label, status: response.status, duration, headers: response.headers };
    } catch (e: any) {
        return { label, status: 0, duration: Date.now() - start, error: e.message };
    }
}

async function runTests() {
    console.log(`\n=============================================`);
    console.log(`🚀 STARTING PRECISE LIMIT TESTS FOR: ${MODEL_NAME}`);
    console.log(`   Limits: 15 RPM | 1M TPM | 200 RPD`);
    console.log(`=============================================\n`);

    // --- TEST 1: RPM (Speed) ---
    console.log(`[TEST 1] RPM / Speed Test`);
    console.log(`   👉 Goal: Send requests at 1 req/sec (60 RPM pace) until 429.`);
    console.log(`   👉 Expectation: Should survive ~15 requests.`);
    
    let successCount = 0;
    let hitLimit = false;
    
    // We'll try up to 20 requests
    for (let i = 1; i <= 20; i++) {
        const res = await sendRequest(`Req ${i}`, "Hi");
        
        if (res.status === 200) {
            successCount++;
            process.stdout.write(`✅ ${i} `);
        } else if (res.status === 429) {
            console.log(`\n\n   ⚠️ HIT RATE LIMIT (429) at request #${i}`);
            console.log(`      Retry-After: ${res.headers?.['retry-after'] || 'N/A'}`);
            hitLimit = true;
            break;
        } else {
            console.log(`\n   ❌ Error: ${res.status}`);
        }
        
        // Wait 1s between requests to simulate a steady stream, but faster than the 15 RPM limit (1 req/4s)
        await sleep(1000);
    }

    if (!hitLimit) {
        console.log(`\n   ✅ Reached 20 requests without 429 (Unusual if limit is 15 RPM).`);
    } else {
        console.log(`   📊 Result: Managed ${successCount} requests in rapid succession.`);
    }

    // --- COOLDOWN ---
    console.log(`\n---------------------------------------------`);
    console.log(`⏳ Waiting 70 seconds to reset minute quota...`);
    console.log(`---------------------------------------------`);
    await sleep(70000); // 70s to be safe

    // --- TEST 2: TPM (Volume) ---
    console.log(`\n[TEST 2] TPM / Volume Test`);
    console.log(`   👉 Goal: Send heavy payload (high tokens) but SLOWLY (low RPM).`);
    console.log(`   👉 Payload: ~50,000 chars (~12.5k tokens). Limit is 1M.`);
    
    const heavyText = "word ".repeat(10000); // ~50k chars
    
    console.log(`   👉 Sending Request 1 (Huge Payload)...`);
    const volRes1 = await sendRequest("BigReq 1", heavyText);
    
    if (volRes1.status === 200) {
        console.log(`      ✅ Success! (${volRes1.duration}ms)`);
    } else {
        console.log(`      ❌ Failed with ${volRes1.status}`);
        if (volRes1.status === 429) console.log(`         (Rate Limited on Volume)`);
    }

    // Wait 10s to be extremely safe on RPM
    console.log(`   ... Waiting 10s ...`);
    await sleep(10000);

    console.log(`   👉 Sending Request 2 (Huge Payload)...`);
    const volRes2 = await sendRequest("BigReq 2", heavyText);
    
    if (volRes2.status === 200) {
        console.log(`      ✅ Success! (${volRes2.duration}ms)`);
    } else {
        console.log(`      ❌ Failed with ${volRes2.status}`);
    }
    
    console.log(`\n=============================================`);
    console.log(`🏁 TESTS COMPLETED`);
    console.log(`=============================================`);
}

runTests().catch(console.error);
