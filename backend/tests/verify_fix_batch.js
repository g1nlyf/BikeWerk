const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const collector = require('../scrapers/buycycle-collector');
const UnifiedNormalizer = require('../src/services/UnifiedNormalizer');

puppeteer.use(StealthPlugin());

const TEST_URLS = [
    'https://buycycle.com/de-de/product/reign-1-2019-58146', // Target Issue
    'https://buycycle.com/de-de/product/tues-comp-2021-26483',
    'https://buycycle.com/de-de/product/stumpjumper-alloy-2022-26615',
    'https://buycycle.com/de-de/product/enduro-expert-carbon-29-2020-26584',
    'https://buycycle.com/de-de/product/torque-cf-8-2021-26476'
];

async function runBatchTest() {
    console.log('🚀 Starting Batch Verification for Parsing Fix...');
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = [];

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        for (const url of TEST_URLS) {
            console.log(`\n--------------------------------------------------`);
            console.log(`🔍 Processing: ${url.split('/').pop()}`);
            
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                // 1. Scrape
                const details = await collector.scrapeListingDetails(page);
                
                // 2. Normalize
                const rawBike = {
                    url: url,
                    ...details,
                    brand: details.brand || 'Unknown',
                    model: details.title || 'Unknown',
                    price: details.price || 0,
                    year: details.year || 2020
                };

                console.log('   🤖 Normalizing via Gemini...');
                const normalized = await UnifiedNormalizer.normalize(rawBike, 'buycycle');
                
                // Parse seller_json if it's a string (it should be)
                let sellerJson = {};
                try {
                    sellerJson = typeof normalized.seller_json === 'string' 
                        ? JSON.parse(normalized.seller_json) 
                        : normalized.seller_json;
                } catch (e) {
                    sellerJson = { error: 'Invalid JSON' };
                }

                // Check Data Quality
                const hasDescription = normalized.description && normalized.description.length > 10 && !normalized.description.includes('Generic');
                const hasSellerName = normalized.seller_name && normalized.seller_name !== 'N/A' && normalized.seller_name !== 'Unknown';
                const hasLocation = sellerJson && sellerJson.location && sellerJson.location.length > 2;
                const hasActive = sellerJson && sellerJson.last_active && sellerJson.last_active.length > 2;

                const status = (hasDescription && hasSellerName && hasLocation && hasActive) ? '✅ PASS' : '❌ FAIL';

                const result = {
                    id: url.split('-').pop(),
                    status,
                    desc_start: normalized.description ? normalized.description.substring(0, 30) + '...' : 'NULL',
                    seller_name: normalized.seller_name,
                    location: sellerJson.location || 'MISSING',
                    active: sellerJson.last_active || 'MISSING'
                };
                
                results.push(result);
                console.log(`   ${status} | Seller: ${result.seller_name} | Loc: ${result.location}`);

            } catch (err) {
                console.error(`   ❌ Error processing ${url}:`, err.message);
                results.push({
                    id: url.split('-').pop(),
                    status: '❌ ERROR',
                    error: err.message
                });
            }
        }

        console.log('\n==================================================');
        console.log('📊 BATCH VERIFICATION RESULTS');
        console.log('==================================================');
        console.table(results);

    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

runBatchTest();
