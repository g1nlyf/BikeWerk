/**
 * TEST SCRIPT: Kleinanzeigen Parser Test
 * 
 * Tests the kleinanzeigen-parser.js with a real URL from user's request:
 * https://www.kleinanzeigen.de/s-anzeige/specialized-demo-8-carbon-s-works-xl/3316346458-217-4662
 * 
 * Expected data from screenshot:
 * - Brand: Specialized
 * - Model: Demo 8 Carbon S Works
 * - Frame Size: XL
 * - Price: €3,000 VB
 * - Condition: Gut
 * - Location: 35625 Hessen - Hüttenberg
 * - Type: Mountainbikes
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const KleinanzeigenParser = require('../parsers/kleinanzeigen-parser');

puppeteer.use(StealthPlugin());

const TEST_URL = 'https://www.kleinanzeigen.de/s-anzeige/specialized-demo-8-carbon-s-works-xl/3316346458-217-4662';

const EXPECTED = {
    brand: 'Specialized',
    title_contains: 'Demo',
    frame_size: 'XL',
    price: 3000,
    condition: 'Gut',
    bike_category: 'Mountainbikes',
    location_contains: 'Hessen'
};

async function runTest() {
    console.log('='.repeat(60));
    console.log('🧪 KLEINANZEIGEN PARSER TEST');
    console.log('='.repeat(60));
    console.log(`📌 URL: ${TEST_URL}\n`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('🌐 Navigating to page...');
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Check for bot detection
        const title = await page.title();
        if (title.includes('Robot') || title.includes('Captcha')) {
            throw new Error('Blocked by Anti-Bot (Captcha/Robot check)');
        }

        console.log('📥 Getting HTML content...');
        const html = await page.content();

        console.log(`📄 HTML size: ${(html.length / 1024).toFixed(1)} KB\n`);

        console.log('🔍 Parsing with KleinanzeigenParser...\n');
        const result = KleinanzeigenParser.parse(html, TEST_URL);

        // Check if rejected
        if (result._rejected) {
            console.log('❌ REJECTED BY MOPED FILTER');
            console.log(`   Reason: ${result._rejectReason}`);
            console.log(`   Category Found: ${result._categoryFound}`);
            console.log(`   Title: ${result.title}`);
            return { rejected: true, result };
        }

        // Validation
        const validation = KleinanzeigenParser.validate(result);

        console.log('='.repeat(60));
        console.log('📊 PARSED RESULTS');
        console.log('='.repeat(60));

        console.log('\n📝 BASIC INFO:');
        console.log(`   Title: ${result.title}`);
        console.log(`   Brand (derived): ${result.brand}`);
        console.log(`   Frame Size (derived): ${result.frame_size}`);
        console.log(`   Ad ID: ${result.ad_id}`);
        console.log(`   Location: ${result.location}`);
        console.log(`   Publish Date: ${result.publish_date}`);
        console.log(`   Views: ${result.views_count}`);

        console.log('\n🗂️ CATEGORY INFO:');
        console.log(`   Breadcrumb: ${result.category_breadcrumb?.join(' > ') || 'N/A'}`);

        console.log('\n💰 PRICE INFO:');
        console.log(`   Price: €${result.price?.value} (${result.price?.is_negotiable ? 'VB' : 'Fest'})`);
        console.log(`   Old Price: €${result.old_price || 'N/A'}`);

        console.log('\n📋 ATTRIBUTES:');
        if (result.attributes && Object.keys(result.attributes).length > 0) {
            for (const [key, val] of Object.entries(result.attributes)) {
                console.log(`   ${key}: ${val}`);
            }
        } else {
            console.log('   ⚠️ No attributes found');
        }

        console.log('\n🖼️ PHOTOS:');
        console.log(`   Count: ${result.photos?.length || 0}`);
        if (result.photos?.length > 0) {
            console.log(`   First: ${result.photos[0].substring(0, 80)}...`);
        }

        console.log('\n👤 SELLER INFO:');
        console.log(`   Name: ${result.seller_name}`);
        console.log(`   Type: ${result.seller_type}`);
        console.log(`   Badges: ${result.seller_badges?.join(', ') || 'N/A'}`);
        console.log(`   Active Since: ${result.active_since}`);

        console.log('\n📝 DESCRIPTION:');
        if (result.description) {
            console.log(`   ${result.description.substring(0, 200)}${result.description.length > 200 ? '...' : ''}`);
        } else {
            console.log('   N/A');
        }

        // Validation Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ VALIDATION');
        console.log('='.repeat(60));
        console.log(`   Is Valid: ${validation.is_valid ? '✅ YES' : '❌ NO'}`);
        if (validation.errors.length > 0) {
            console.log(`   Errors: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
            console.log(`   Warnings: ${validation.warnings.join(', ')}`);
        }

        // Comparison with expected
        console.log('\n' + '='.repeat(60));
        console.log('🎯 COMPARISON WITH EXPECTED');
        console.log('='.repeat(60));

        const checks = [
            { name: 'Brand', got: result.brand, expected: EXPECTED.brand, match: result.brand === EXPECTED.brand },
            { name: 'Title Contains', got: result.title, expected: EXPECTED.title_contains, match: result.title?.includes(EXPECTED.title_contains) },
            { name: 'Frame Size', got: result.frame_size, expected: EXPECTED.frame_size, match: result.frame_size === EXPECTED.frame_size },
            { name: 'Price', got: result.price?.value, expected: EXPECTED.price, match: result.price?.value === EXPECTED.price },
            { name: 'Condition', got: result.condition, expected: EXPECTED.condition, match: result.condition === EXPECTED.condition },
            { name: 'Category', got: result.bike_category, expected: EXPECTED.bike_category, match: result.bike_category?.includes(EXPECTED.bike_category) },
            { name: 'Location', got: result.location, expected: EXPECTED.location_contains, match: result.location?.includes(EXPECTED.location_contains) }
        ];

        let passed = 0;
        for (const check of checks) {
            const status = check.match ? '✅' : '❌';
            console.log(`   ${status} ${check.name}: ${check.got} (expected: ${check.expected})`);
            if (check.match) passed++;
        }

        console.log(`\n📈 Score: ${passed}/${checks.length} checks passed`);

        return { result, validation, passed, total: checks.length };

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
        return { error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

runTest()
    .then(result => {
        console.log('\n' + '='.repeat(60));
        console.log('🏁 TEST COMPLETE');
        console.log('='.repeat(60));
        process.exit(result.error ? 1 : 0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
