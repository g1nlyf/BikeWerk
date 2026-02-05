const AutonomousOrchestrator = require('./AutonomousOrchestrator');
const BikesDatabase = require('./bikes-database-node');
const KleinanzeigenParser = require('./kleinanzeigen-parser');

async function verifyHunter() {
    console.log('🚀 Starting Sprint 1: "Battle Baptism" (Verify Hunter)...');
    
    const db = new BikesDatabase();
    await db.ensureInitialized();
    const parser = new KleinanzeigenParser();
    
    // Mock bot for logging
    const mockBot = {
        sendMessage: (chatId, text) => console.log(`[BOT Mock] To ${chatId}: ${text}`)
    };
    
    const orchestrator = new AutonomousOrchestrator(mockBot);

    // 1. Test Case: Multimodal Accuracy & Semantic Extraction
    console.log('\n🧪 Test Case 1: Real Listing Analysis (Multimodal + Semantic)');
    // Real listing example (replace with live URL if 404, using a likely active one or similar structure)
    // Using a search URL to find fresh candidates instead of hardcoding potentially dead links
    const searchUrl = 'https://www.kleinanzeigen.de/s-fahrraeder/mtb/k0c217+fahrraeder.art_s:mountainbike';
    
    try {
        console.log('   Finding a fresh candidate for analysis...');
        // We'll use the parser to get a listing from search results to ensure it's live
        // Since parseListing isn't exposed directly on parser in the same way, we'll use orchestrator's flow or just fetch one
        // Let's rely on orchestrator to process a specific URL if we had one, but better to simulate a small hunt
        
        // Actually, let's try to parse a specific URL known to be good or search for one
        // For the purpose of this script, let's use the Orchestrator's internal methods to process a candidate
        
        // Let's define 3 test URLs (Mixed categories)
        // Note: These might expire. If they fail, the test should handle it gracefully or find new ones.
        // I will use a search function to get *fresh* links to test.
        
        // Simulating the "Search" part to get links
        // KleinanzeigenParser doesn't have search, usually handled by other components or just hardcoded for specific tests.
        // Let's use the orchestrator to fetch candidates for a strategy
        
        const strategy = {
            category: 'MTB',
            brand: 'Santa Cruz', // Test Case 3: Brand Filter
            priceRange: { min: 2000, max: 8000 }
        };
        
        console.log(`   Executing Strategy: ${strategy.brand} ${strategy.category}...`);
        
        // We need to access _fetchFreshCandidates which is private-ish.
        // Let's use the public replenishCatalog but limit it to 1 item to see logs
        // But to be precise for the test report, let's instantiate the parser and fetch a search page manually
        
        // We'll use a direct search URL for Santa Cruz to test Brand Filter + Analysis
        const searchLink = 'https://www.kleinanzeigen.de/s-fahrraeder/santa-cruz/k0c217';
        
        // We need a method to parse search results. KleinanzeigenParser usually parses single listings.
        // AutonomousOrchestrator has _fetchFreshCandidates which constructs search URLs.
        // Let's use _fetchFreshCandidates directly if possible (it's internal).
        
        const candidates = await orchestrator._fetchFreshCandidates(5, {
            brand: 'Santa Cruz',
            category: 'MTB',
            minPrice: 2000,
            maxPrice: 8000
        });
        
        console.log(`   Found ${candidates.length} candidates.`);
        
        if (candidates.length > 0) {
            const candidate = candidates[0];
            const candidateUrl = candidate.source_url || candidate.url;
            console.log(`   analyzing candidate: ${candidate.title} (${candidateUrl})`);
            
            // Process full details
            const log = (msg) => console.log(`   [Orchestrator] ${msg}`);
            await orchestrator._processCandidate(candidate, log, 'MTB');
            
            // Check DB for results
            const savedBike = await db.getQuery('SELECT * FROM bikes WHERE original_url = ?', [candidateUrl]);
            
            if (savedBike) {
                console.log('\n✅ Verification Results:');
                console.log(`   - ID: ${savedBike.id}`);
                console.log(`   - Title: ${savedBike.name}`);
                console.log(`   - Year (Extracted): ${savedBike.year || 'N/A'}`);
                console.log(`   - Condition Score: ${savedBike.condition_score}`);
                console.log(`   - AI Processed: ${savedBike.features ? 'Yes' : 'No'}`);
                
                if (savedBike.year) {
                     console.log('   ✅ Semantic Year Extraction: PASSED');
                } else {
                     console.log('   ⚠️ Semantic Year Extraction: No year found (might not be in text)');
                }
                
                if (savedBike.condition_score) {
                    console.log('   ✅ Multimodal Analysis: PASSED (Score generated)');
                }
                
                // Brand Filter Check
                if (savedBike.brand.toLowerCase().includes('santa cruz')) {
                    console.log('   ✅ Brand Filter: PASSED (Correct brand)');
                } else {
                    console.error(`   ❌ Brand Filter: FAILED (Expected Santa Cruz, got ${savedBike.brand})`);
                }
            } else {
                console.error('   ❌ Failed to save bike to DB.');
            }
        } else {
            console.warn('   ⚠️ No candidates found. Check proxy/network.');
        }

    } catch (e) {
        console.error('❌ Test Failed:', e);
    }
    
    console.log('\n🏁 Sprint 1 Verification Complete.');
}

verifyHunter();
