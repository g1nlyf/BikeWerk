const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const TechDecoder = require('../../src/services/TechDecoder');
const BuycycleCollector = require('../../scrapers/buycycle-collector'); // This is an instance

puppeteer.use(StealthPlugin());

async function showUnifiedJson() {
    const url = 'https://buycycle.com/de-de/product/turbo-levo-comp-carbon-2021-42932';
    console.log(`🔍 Fetching: ${url}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // 1. Navigate
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 2. Scrape Details (using the logic from BuycycleCollector)
        // We can't easily call private methods or methods that expect specific context if not exposed.
        // But scrapeListingDetails is an instance method.
        const details = await BuycycleCollector.scrapeListingDetails(page);
        
        if (!details) {
            throw new Error('Failed to scrape details from page');
        }

        console.log('✅ Raw Data Scraped:', details.title);

        // 3. Prepare for TechDecoder
        // BuycycleCollector usually merges this with search result data, but we have enough here.
        const rawBike = {
            ...details,
            url: url,
            source: 'buycycle',
            price: details.price || 0, // Ensure price is there
            external_id: '87161' // Fake ID or extract from URL
        };

        // 4. Normalize (Gemini -> Unified Format)
        console.log('🤖 Sending to AI for Unified Formatting...');
        const unified = await TechDecoder.normalize(rawBike);

        console.log('\n════════════════════ FINAL UNIFIED JSON ════════════════════');
        console.log(JSON.stringify(unified, null, 2));
        console.log('════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

showUnifiedJson();
