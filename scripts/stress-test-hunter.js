const UnifiedHunter = require('../telegram-bot/unified-hunter');
const BikesDatabaseNode = require('../telegram-bot/bikes-database-node');

async function stressTest() {
    console.log('🚧 STARTING STRESS TEST (Iron Curtain Mode) 🚧');
    
    // 1. Mock dependencies
    // We want to test RateLimiter and Arbiter mainly.
    // We can instantiate UnifiedHunter and override its parser and rateLimiter behavior slightly if needed,
    // or just run it against a loop of "fake" urls that trigger the logic.
    
    const hunter = new UnifiedHunter({ logger: console.log });
    await hunter.ensureInitialized();

    // Mock fetchHtml to simulate:
    // - Success
    // - 403 Errors (to trigger Backoff)
    // - Data discrepancies (to trigger Arbiter)
    
    let callCount = 0;
    
    hunter.fetchHtml = async (url) => {
        return await hunter.rateLimiter.execute(async () => {
            callCount++;
            console.log(`[Network] GET ${url} (Call #${callCount})`);
            
            // Simulate 403 every 5th call to test Backoff
            if (callCount % 5 === 0) {
                console.log(`[Network] ⚠️ SIMULATED 403 Forbidden`);
                const err = new Error('Request failed with status code 403');
                err.response = { status: 403 };
                throw err;
            }

            // Return dummy HTML
            return `
                <html>
                    <body>
                        <div class="aditem">
                             <div class="text-module-begin">
                                <a href="/s-anzeige/fake-bike-${callCount}/123">Canyon Spectral 2020 Carbon</a>
                             </div>
                             <div class="aditem-main--middle--price-shipping--price">
                                2.500 €
                             </div>
                        </div>
                    </body>
                </html>
            `;
        });
    };

    // Mock Parser to return data that might conflict with Gemini
    hunter.parser.parseKleinanzeigenLink = async (url) => {
        return {
            title: 'Canyon Spectral 2020 Carbon',
            description: 'Verkaufe mein Canyon Spectral aus 2020. Carbon Rahmen. Größe L.',
            price: 2500,
            location: 'Berlin',
            year: 2020, // Parser says 2020
            frame_material: 'Carbon',
            frameSize: 'L'
        };
    };

    // Mock Gemini to return conflicting data occasionally
    hunter.geminiProcessor.processBikeDataFromImages = async () => ({});
    hunter.geminiProcessor.processBikeDataFromTwoShots = async () => ({});
    let conflictCounter = 0;
    hunter.geminiProcessor.finalizeUnifiedData = async (raw, img) => {
        // Simulate Conflict every 2nd bike
        conflictCounter++;
        const isConflict = conflictCounter % 2 === 0;
        return {
            ...raw,
            year: isConflict ? 2018 : 2020, // AI thinks it's 2018 -> Conflict!
            material: 'Carbon',
            frameSize: 'L',
            processedByGemini: true
        };
    };
    
    // Mock Valuation
    hunter.valuationService.calculateFMV = async () => ({
        fmv: 3000,
        finalPrice: 3000,
        confidence: 'high'
    });
    hunter.valuationService.evaluateSniperRule = async () => ({ isHit: true, reason: 'Test Hit', priority: 'high' });

    // Mock Condition Analyzer
    hunter.conditionAnalyzer.analyzeBikeCondition = async () => ({
        score: 8,
        grade: 'B',
        penalty: 0,
        needs_review: false,
        consistency_flags: []
    });

    // Mock DB addBike to avoid cluttering real DB
    hunter.bikesDB.addBike = async (data) => {
        console.log(`[DB] Mock Save: ${data.brand} ${data.model}. Active=${data.is_active}, Audit=${data.needs_audit}`);
        return { lastID: 123, ...data };
    };
    hunter.imageHandler.downloadAndProcessImages = async () => [];

    // Run the hunt loop manually or via hunt()
    // We'll simulate processing a list of items directly to control flow
    
    console.log('--- Phase 1: Rate Limiter & Backoff Test ---');
    // We will trigger 10 fetches. Some will fail.
    // UnifiedHunter.hunt calls fetchHtml for search pages.
    
    // Let's just call fetchHtml in a loop to see RateLimiter in action
    try {
        for (let i = 0; i < 10; i++) {
            try {
                await hunter.fetchHtml(`http://test.com/${i}`);
            } catch (e) {
                console.log(`[Test] Caught expected error: ${e.message}`);
            }
        }
    } catch (e) {
        console.log(`[Test] Fatal error: ${e.message}`);
    }

    console.log('\n--- Phase 2: Arbiter Logic Test ---');
    // Process a few listings
    for (let i = 0; i < 5; i++) {
        console.log(`\n🚲 Processing Bike #${i+1}...`);
        await hunter.processListing(`https://www.kleinanzeigen.de/s-anzeige/fake-bike-${i}/123`);
    }

    console.log('\n✅ STRESS TEST COMPLETE');
}

stressTest().catch(console.error);
