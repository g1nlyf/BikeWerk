/**
 * TEST SCRIPT: Buycycle Parser Test
 * 
 * Tests the buycycle-parser.js with a real URL from user's request:
 * https://buycycle.com/de-de/product/tues-core-2-27-2022-52112
 * 
 * Expected data from screenshot:
 * - Brand: YT Industries
 * - Model: Tues CORE 2 27
 * - Year: 2022
 * - Price: €1,900
 * - Old Price: €3,499
 * - Frame Size: S
 * - Suspension: Vollfederung
 * - Wheel Size: 27.5
 * - Groupset: SRAM GX
 * - Fork: RockShox Boxxer Select
 * - Brakes: SRAM Code R
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const BuycycleParser = require('../parsers/buycycle-parser');

puppeteer.use(StealthPlugin());

const TEST_URL = 'https://buycycle.com/de-de/product/tues-core-2-27-2022-52112';

const EXPECTED = {
    brand: 'YT Industries',
    title_contains: 'Tues CORE 2 27',
    year: 2022,
    price: 1900,
    old_price: 3499,
    frame_size: 'S',
    wheel_size: '27.5',
    drivetrain: 'SRAM GX',
    condition: 'Sehr gut'
};

async function runTest() {
    console.log('='.repeat(60));
    console.log('🧪 BUYCYCLE PARSER TEST');
    console.log('='.repeat(60));
    console.log(`📌 URL: ${TEST_URL}\n`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        console.log('🌐 Navigating to page...');
        await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('📥 Getting HTML content...');
        const html = await page.content();

        console.log(`📄 HTML size: ${(html.length / 1024).toFixed(1)} KB\n`);

        console.log('🔍 Parsing with BuycycleParser...\n');
        const result = BuycycleParser.parse(html, TEST_URL);

        // Validation
        const validation = BuycycleParser.validate(result);

        console.log('='.repeat(60));
        console.log('📊 PARSED RESULTS');
        console.log('='.repeat(60));

        console.log('\n📝 BASIC INFO:');
        console.log(`   Title: ${result.title}`);
        console.log(`   Brand: ${result.brand}`);
        console.log(`   Year: ${result.year}`);
        console.log(`   Frame Size: ${result.frame_size}`);
        console.log(`   Wheel Size: ${result.wheel_size}`);
        console.log(`   Condition: ${result.condition}`);

        console.log('\n💰 PRICE INFO:');
        console.log(`   Price: €${result.price?.value}`);
        console.log(`   Old Price: €${result.old_price?.value}`);
        console.log(`   Buyer Protection: €${result.buyer_protection_price?.value}`);

        console.log('\n🔧 COMPONENTS:');
        if (result.components && Object.keys(result.components).length > 0) {
            for (const [key, val] of Object.entries(result.components)) {
                const value = typeof val === 'object' ? val.value : val;
                const replaced = typeof val === 'object' && val.replaced ? ' [REPLACED]' : '';
                console.log(`   ${key}: ${value}${replaced}`);
            }
        } else {
            console.log('   ⚠️ No components found');
        }

        console.log('\n🖼️ PHOTOS:');
        console.log(`   Count: ${result.photos?.length || 0}`);
        if (result.photos?.length > 0) {
            console.log(`   First: ${result.photos[0].substring(0, 80)}...`);
        }

        console.log('\n👤 SELLER INFO:');
        console.log(`   Name: ${result.seller_name}`);
        console.log(`   Location: ${result.seller_location}`);
        console.log(`   Last Active: ${result.seller_last_active}`);

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
            { name: 'Year', got: result.year, expected: EXPECTED.year, match: result.year == EXPECTED.year },
            { name: 'Price', got: result.price?.value, expected: EXPECTED.price, match: result.price?.value === EXPECTED.price },
            { name: 'Frame Size', got: result.frame_size, expected: EXPECTED.frame_size, match: result.frame_size === EXPECTED.frame_size },
            { name: 'Wheel Size', got: result.wheel_size, expected: EXPECTED.wheel_size, match: result.wheel_size === EXPECTED.wheel_size },
            { name: 'Drivetrain', got: result.drivetrain, expected: EXPECTED.drivetrain, match: result.drivetrain?.includes(EXPECTED.drivetrain) }
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
