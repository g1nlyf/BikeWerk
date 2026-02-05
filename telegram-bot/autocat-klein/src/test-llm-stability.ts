import { geminiClient } from './lib/geminiClient';

async function runStabilityTest() {
    console.log("🧪 Starting LLM Stability Test with Multi-Key Rotation");
    console.log("   Goal: Send 25 requests (approx 5 keys * 5 reqs) and ensure 0 errors.");

    const prompts = Array.from({ length: 25 }, (_, i) => `Request ${i + 1}: Extract bike data: Brand=Specialized, Model=Stumpjumper, Price=2000${i}`);
    
    const results = {
        success: 0,
        failed: 0,
        retried: 0 // Hard to track internal retries without event emitter, but we'll see console logs
    };

    const start = Date.now();

    // Send in batches of 5 to simulate concurrency
    for (let i = 0; i < prompts.length; i += 5) {
        const batch = prompts.slice(i, i + 5);
        console.log(`\n📦 Batch ${i/5 + 1}: Sending ${batch.length} requests...`);
        
        const promises = batch.map(async (p, idx) => {
            const id = i + idx + 1;
            try {
                const t0 = Date.now();
                const res = await geminiClient.generateContent(p);
                const t1 = Date.now();
                console.log(`   ✅ Req ${id} Done in ${t1 - t0}ms`);
                results.success++;
                return true;
            } catch (e: any) {
                console.error(`   ❌ Req ${id} Failed: ${e.message}`);
                results.failed++;
                return false;
            }
        });

        await Promise.all(promises);
        
        // Small delay between batches to not overwhelm console, 
        // but the client should handle rate limiting automatically.
        await new Promise(r => setTimeout(r, 1000));
    }

    const totalTime = (Date.now() - start) / 1000;
    console.log(`\n🏁 Test Completed in ${totalTime.toFixed(1)}s`);
    console.log(`   Success: ${results.success}`);
    console.log(`   Failed:  ${results.failed}`);
    
    if (results.failed === 0) {
        console.log("✅ LLM Client is STABLE.");
    } else {
        console.log("❌ LLM Client needs fixing.");
    }
}

runStabilityTest().catch(console.error);
