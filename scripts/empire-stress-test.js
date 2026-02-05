
const ScoringService = require('../telegram-bot/ScoringService');
const UserBehaviorTracker = require('../telegram-bot/UserBehaviorTracker');
const SupplyGapAnalyzer = require('../telegram-bot/SupplyGapAnalyzer');
const ValuationService = require('../backend/src/services/ValuationService');

// Mock Database for ValuationService
class MockDB {
    async query(sql) {
        // Return dummy market data for IQR test
        // Generate 100 prices: 80 normal (1000-2000), 10 cheap outliers (100), 10 expensive outliers (10000)
        const prices = [];
        for(let i=0; i<80; i++) prices.push({ price_eur: 1000 + Math.random() * 1000 });
        for(let i=0; i<10; i++) prices.push({ price_eur: 100 });
        for(let i=0; i<10; i++) prices.push({ price_eur: 10000 });
        return prices;
    }
}

async function runEmpireStressTest() {
    console.log('🏛️ STARTING EMPIRE STRESS TEST (Mobile-First & Behavioral) 🏛️');
    console.log('===========================================================');

    // 1. Test Valuation IQR
    console.log('\n📉 [1] Testing Valuation IQR Filter...');
    const valService = new ValuationService(new MockDB());
    const fmvData = await valService.calculateFMV({ brand: 'Test', model: 'Test', year: 2020, material: 'Carbon' });
    
    if (fmvData) {
        console.log(`   ✅ FMV Calculated: ${fmvData.fmv}€ (Sample Size: ${fmvData.sampleSize})`);
        console.log(`   📊 Range: ${fmvData.min}€ - ${fmvData.max}€`);
        if (fmvData.min > 200 && fmvData.max < 9000) {
            console.log('   ✅ Outliers successfully removed (IQR works)');
        } else {
            console.log('   ⚠️ Outliers might still be present');
        }
    } else {
        console.log('   ❌ Valuation failed');
    }

    // 2. Test User Behavior Tracker
    console.log('\n📱 [2] Testing User Behavior Tracker (High Load)...');
    const tracker = new UserBehaviorTracker();
    const eventsCount = 500;
    const start = Date.now();
    
    for (let i = 0; i < eventsCount; i++) {
        tracker.track({
            type: i % 10 === 0 ? 'SEARCH_GAP' : 'TAP_ENGAGEMENT',
            targetId: `bike_${i % 50}`,
            value: 1,
            userId: `user_${i % 100}`
        });
    }
    
    await tracker.flush();
    const duration = Date.now() - start;
    console.log(`   ✅ Processed ${eventsCount} events in ${duration}ms`);

    // 3. Test Supply Gap Analysis
    console.log('\n🔍 [3] Testing Supply Gap Analyzer...');
    const gapAnalyzer = new SupplyGapAnalyzer();
    
    // Simulate failed searches
    for (let i = 0; i < 10; i++) {
        gapAnalyzer.recordSearch({ query: 'Gravel M', resultsCount: 0 });
    }
    for (let i = 0; i < 3; i++) {
        gapAnalyzer.recordSearch({ query: 'Enduro L', resultsCount: 0 });
    }

    const gaps = gapAnalyzer.analyzeGaps();
    console.log('   📉 Detected Gaps:', JSON.stringify(gaps));
    
    if (gaps.length > 0 && gaps[0].category === 'Gravel' && gaps[0].count >= 5) {
        console.log('   ✅ Correctly identified "Gravel M" as critical gap');
    } else {
        console.log('   ❌ Failed to identify gap');
    }

    // 4. Test Hybrid Scoring 3.0
    console.log('\n🧠 [4] Testing Hybrid Scoring 3.0...');
    const scoring = new ScoringService();
    
    const listing = {
        brand: 'Specialized',
        price_eur: 1500, // Sweet Spot!
        scraped_at: new Date().toISOString() // Fresh
    };
    const fmv = 2000; // Good profit
    const condition = 8;
    const userInterest = 9; // Hot item
    
    const scoreResult = scoring.calculateDesirability(listing, fmv, condition, userInterest);
    console.log('   🏆 Final Score:', scoreResult.totalScore);
    console.log('   🧩 Components:', JSON.stringify(scoreResult.components));
    
    if (scoreResult.totalScore > 8) {
        console.log('   ✅ High score for Sweet Spot + High Interest item');
    } else {
        console.log('   ⚠️ Score seems low for a perfect item');
    }

    console.log('\n===========================================================');
    console.log('✅ EMPIRE STRESS TEST COMPLETE');
}

runEmpireStressTest().catch(console.error);
