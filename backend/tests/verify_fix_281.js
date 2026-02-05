const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const collector = require('../scrapers/buycycle-collector');
const UnifiedNormalizer = require('../src/services/UnifiedNormalizer');

puppeteer.use(StealthPlugin());

const TEST_URLS = [
    'https://buycycle.com/de-de/product/reign-1-2019-58146', // Target Issue
    'https://buycycle.com/de-de/product/tues-comp-2021-26483' // Additional Test
];

async function runTest() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        for (const url of TEST_URLS) {
            console.log(`\nTesting URL: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            const details = await collector.scrapeListingDetails(page);
            
            console.log('--- SCRAPER RAW RESULT ---');
            console.log('Description:', details.description ? details.description.substring(0, 100) + '...' : 'NULL');
            console.log('Seller Name:', details.seller?.name);
            console.log('Seller Location:', details.seller?.location);
            console.log('Seller Active:', details.seller?.last_active);
            
            // Normalize
            const rawBike = {
                url: url,
                ...details,
                brand: details.brand || 'Unknown',
                model: details.title || 'Unknown',
                price: details.price || 0,
                year: details.year || 2020
            };

            console.log('--- NORMALIZATION ... ---');
            // Mock Gemini for speed/cost if possible, but UnifiedNormalizer uses it. 
            // We'll let it run real normalization to ensure Gemini doesn't break it.
            const normalized = await UnifiedNormalizer.normalize(rawBike, 'buycycle');
            
            console.log('--- FINAL DB PAYLOAD ---');
            console.log('DB Description:', normalized.description);
            console.log('DB Seller Name:', normalized.seller_name);
            console.log('DB Seller JSON:', JSON.stringify(normalized.seller_json, null, 2));
            console.log('----------------');

            // Validation
            if (url.includes('reign-1')) {
                const descOk = normalized.description && normalized.description.includes('Reign 1.5'); // Gemini might translate/shorten
                const nameOk = normalized.seller_name === 'Sven E.';
                const locOk = normalized.seller_json?.location && normalized.seller_json.location.includes('Beringstedt');
                
                if (descOk && nameOk && locOk) {
                    console.log('✅ ALL CHECKS PASSED for Reign 1');
                } else {
                    console.log('❌ CHECKS FAILED for Reign 1');
                    if (!descOk) console.log('   - Description failed');
                    if (!nameOk) console.log('   - Seller Name failed');
                    if (!locOk) console.log('   - Location failed');
                }
            }
        }

    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        await browser.close();
        process.exit(0); // Force exit to close DB connections
    }
}

runTest();
