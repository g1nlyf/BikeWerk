/**
 * Test Buycycle scraping with Constructor.io data attributes
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testBuycycleScrape() {
    console.log('═'.repeat(60));
    console.log('🧪 BUYCYCLE SCRAPE TEST (Constructor.io Data)');
    console.log('═'.repeat(60) + '\n');
    
    const url = 'https://buycycle.com/de-de/shop/main-types/bikes/bike-types/mountainbike/min-price/500/sort-by/new/high-demand/1';
    
    let browser = null;
    try {
        console.log('🌐 Launching browser...');
        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        console.log(`\n📍 Navigating to: ${url}`);
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log('✅ Navigation successful\n');
        
        // Accept cookies
        console.log('🍪 Looking for cookie consent...');
        try {
            await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', { timeout: 5000 });
            await page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
            console.log('   ✅ Accepted cookies');
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.log('   ⚠️ No cookie banner found or already accepted');
        }
        
        // Wait for content to load
        console.log('\n⏳ Waiting for content...');
        await new Promise(r => setTimeout(r, 2000));
        
        // Extract using Constructor.io data attributes
        console.log('🔍 Extracting product data from data-cnstrc-* attributes...\n');
        
        const listings = await page.evaluate(() => {
            const results = [];
            
            // Find all product cards with Constructor.io data attributes
            const productCards = document.querySelectorAll('[data-cnstrc-item-id]');
            
            for (const card of productCards) {
                try {
                    const itemId = card.getAttribute('data-cnstrc-item-id');
                    const itemName = card.getAttribute('data-cnstrc-item-name');
                    const itemPrice = card.getAttribute('data-cnstrc-item-price');
                    
                    const price = parseInt(itemPrice) || 0;
                    const title = itemName || '';
                    
                    // Get URL
                    const link = card.querySelector('a[href*="/product/"]');
                    const href = link?.getAttribute('href') || '';
                    const url = href.startsWith('http') ? href : `https://buycycle.com${href}`;
                    
                    if (!title || results.some(r => r.url === url)) continue;
                    
                    // Extract brand and year
                    const cleanTitle = title.replace(/Stark gefragt\d*/gi, '').replace(/sehr gefragt/gi, '').trim();
                    const brand = cleanTitle.split(/[\s-]/)[0] || 'Unknown';
                    const yearMatch = cleanTitle.match(/\b(20\d{2})\b/);
                    const year = yearMatch ? parseInt(yearMatch[1]) : null;
                    
                    // Get image
                    const imgEl = card.querySelector('img');
                    const image = imgEl?.src || imgEl?.getAttribute('data-src');
                    
                    results.push({
                        id: itemId,
                        title: cleanTitle,
                        brand,
                        price,
                        year,
                        url,
                        image
                    });
                } catch (e) {}
            }
            
            return results;
        });
        
        console.log(`📊 Found ${listings.length} products with data attributes\n`);
        
        // Filter valid prices
        const validListings = listings.filter(l => l.price >= 500);
        console.log(`📊 ${validListings.length} listings with valid prices (≥€500)\n`);
        
        // Show results
        console.log('📋 Top 10 Listings:');
        validListings.slice(0, 10).forEach((item, i) => {
            console.log(`   ${i+1}. [${item.id}] ${item.brand} ${item.title.substring(0, 35)}${item.title.length > 35 ? '...' : ''}`);
            console.log(`      💰 €${item.price} | Year: ${item.year || 'N/A'}`);
            console.log(`      🔗 ${item.url.substring(0, 65)}...`);
        });
        
        // Save screenshot
        const screenshotDir = path.join(__dirname, '../test-results');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        await page.screenshot({ path: path.join(screenshotDir, 'buycycle-test.png'), fullPage: false });
        console.log('\n📸 Screenshot saved to test-results/buycycle-test.png');
        
        console.log('\n✅ Scrape test complete!\n');
        return validListings.length > 0;
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    } finally {
        if (browser) await browser.close();
    }
}

testBuycycleScrape()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
