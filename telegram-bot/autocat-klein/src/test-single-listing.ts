import { pipeline } from './lib/pipeline';
import { storage } from './lib/storage';

async function runTargetedTest() {
    await storage.init();

    // Mondraker Summum URL from user request
    const testUrl = "https://www.kleinanzeigen.de/s-anzeige/mondraker-summum-enduro/3260575824-217-8980";
    
    console.log(`🧪 Testing Single Listing Pipeline: ${testUrl}`);
    console.log("   Goal: Verify parsing, scoring, and DB insertion.");

    const result = await pipeline.processListing(testUrl);

    console.log("\n=== RESULT ===");
    console.log(`Success: ${result.success}`);
    console.log(`Status: ${result.status}`);
    console.log(`Score: ${result.score}`);
    
    if (result.data) {
        console.log("\n=== EXTRACTED DATA ===");
        console.log(`Brand: ${result.data.brand}`);
        console.log(`Model: ${result.data.model}`);
        console.log(`Price: ${result.data.price}`);
        console.log(`Images: ${result.data.images?.length}`);
    }

    await storage.close();
}

runTargetedTest().catch(console.error);
