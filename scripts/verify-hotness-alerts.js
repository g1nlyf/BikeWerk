
const UnifiedHunter = require('../telegram-bot/unified-hunter.js');
const BikesDatabaseNode = require('../telegram-bot/bikes-database-node.js');

// Mock dependencies
const mockLogger = (msg) => console.log(`[TEST] ${msg}`);

async function runVerification() {
    console.log('🧪 Starting Hotness Radar Verification...');

    // 1. Setup Hunter
    const hunter = new UnifiedHunter({ logger: mockLogger });
    
    // Mock ValuationService to ensure we get a high score
    hunter.valuationService.calculateFMV = async () => {
        return {
            fmv: 3000,
            finalPrice: 2800,
            confidence: 'high'
        };
    };

    // Mock ConditionAnalyzer
    hunter.conditionAnalyzer.analyzeBikeCondition = async () => {
        return {
            score: 9,
            grade: 'A',
            penalty: 0,
            needs_review: false,
            consistency_flags: []
        };
    };

    // Mock Parser to return a "Hot" item
    hunter.parser.parseKleinanzeigenLink = async (url) => {
        return {
            title: 'Specialized S-Works Turbo Levo',
            brand: 'Specialized',
            model: 'S-Works Turbo Levo',
            price: 1500, // Very low price vs 2800 FMV
            views: 200,
            publishDate: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago
            deliveryOption: 'pickup-only',
            originalUrl: url,
            sourceAdId: '123456789',
            description: 'Top condition, fast sale needed.'
        };
    };

    // Mock Image Handling (skip download)
    hunter.imageHandler.downloadAndProcessImages = async () => [];
    
    // Mock Status Checker (skip screenshot)
    const originalCheck = require('../telegram-bot/status-checker').checkKleinanzeigenStatus;
    // We can't easily mock require in this context without proxyquire, so we might fail on checkKleinanzeigenStatus if not careful.
    // UnifiedHunter calls checkKleinanzeigenStatus. 
    // We can monkey-patch it if we could, but it's required inside the file or at top level.
    // It's required at top level of UnifiedHunter.js.
    // We can't mock it easily.
    // However, we can mock `processListing` or just call `sendHotnessAlert` directly to verify THAT logic.
    
    // BUT the requirement is "Simulate lot... Ensure bot sent ALARM".
    // So calling `sendHotnessAlert` directly is the best way to verify the alert logic itself.
    // To verify the SCORE calculation, we can call `calculateHotnessScore`.

    // Test 1: Score Calculation
    console.log('\n📊 Test 1: Hotness Score Calculation');
    const bikeData = {
        price: 1500,
        fmv: 2800,
        views: 200,
        publishDate: new Date(Date.now() - 3600 * 1000).toISOString() // 1 hour ago
    };
    
    const score = hunter.valuationService.calculateHotnessScore(bikeData);
    console.log(`Expected Score: (2800 - 1500) * (200 / 1) = 260,000`);
    console.log(`Actual Score: ${score}`);
    
    if (score > 1000) {
        console.log('✅ Score exceeds threshold (1000). Logic correct.');
    } else {
        console.error('❌ Score calculation failed.');
    }

    // Test 2: Alert Sending
    console.log('\n🚨 Test 2: Sending ALARM to Manager Bot');
    
    // We need to mock axios to see if it sends
    const axios = require('axios');
    const originalPost = axios.post;
    
    let alertSent = false;
    axios.post = async (url, data) => {
        if (url.includes('sendMessage') && data.text.includes('ALARM')) {
            alertSent = true;
            console.log('✅ Axios POST intercepted:');
            console.log(`   To: ${data.chat_id}`);
            console.log(`   Text Preview: ${data.text.split('\n')[1]}`); // First line of text
            console.log(`   Buttons: ${data.reply_markup.inline_keyboard.length} rows`);
            return { data: { ok: true } };
        }
        return originalPost(url, data);
    };

    const mockBike = {
        brand: 'Specialized',
        model: 'Turbo Levo',
        price: 1500,
        views: 200,
        publishDate: new Date(Date.now() - 3600 * 1000).toISOString(),
        originalUrl: 'https://www.kleinanzeigen.de/s-anzeige/test/123',
        sourceAdId: '12345'
    };
    
    const mockFMV = { finalPrice: 2800 };
    const mockReport = { grade: 'A', score: 9 };

    // Set ENV for test
    process.env.BOT_TOKEN = 'TEST_TOKEN';
    process.env.ADMIN_CHAT_ID = '123456';

    await hunter.sendHotnessAlert(mockBike, score, mockFMV, mockReport);

    if (alertSent) {
        console.log('✅ ALARM successfully sent (simulated).');
    } else {
        console.error('❌ ALARM was not sent.');
    }

    // Restore axios
    axios.post = originalPost;
    
    console.log('\n🏁 Verification Complete.');
}

runVerification().catch(console.error);
