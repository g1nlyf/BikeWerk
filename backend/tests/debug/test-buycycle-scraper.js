const BuycycleCollector = require('../../scrapers/buycycle-collector.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function testBuycycle() {
  console.log('🧪 Testing Buycycle Scraper\n');
  
  // Test 1: Popular model (should have results)
  const target1 = { brand: 'Canyon', model: 'Spectral' };
  console.log('Test 1: Canyon Spectral');
  try {
      const results1 = await BuycycleCollector.collectForTarget(target1);
      console.log(`  Found: ${results1.length} bikes`);
      if (results1.length > 0) {
        console.log('  Sample:', results1[0]);
      }
  } catch (e) {
      console.error('Test 1 failed:', e);
  }
  
  // Test 2: Rare model (might have 0 results)
  const target2 = { brand: 'YT', model: 'Izzo' };
  console.log('\nTest 2: YT Izzo');
  try {
      const results2 = await BuycycleCollector.collectForTarget(target2);
      console.log(`  Found: ${results2.length} bikes`);
  } catch (e) {
      console.error('Test 2 failed:', e);
  }
  
  // Test 3: Check if Buycycle changed HTML structure
  console.log('\n🔍 Checking Buycycle page structure...');
  const browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  }); 
  const page = await browser.newPage();
  
  // Use a generic search URL or the specific one
  const url = 'https://buycycle.com/de-de/shop/main-types/bikes/bike-types/mountainbike/brands/canyon/models/spectral';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Try different selectors
  const selectors = [
    '[data-testid="bike-card"]',
    '.bike-card',
    '[class*="BikeCard"]',
    'article',
    '[href*="/bike/"]',
    'a[href*="/bike/"]' // Specific anchor tag
  ];
  
  for (const selector of selectors) {
    try {
        const count = await page.$$eval(selector, els => els.length);
        console.log(`  ${selector}: ${count} elements`);
    } catch (e) {
        console.log(`  ${selector}: Error evaluating`);
    }
  }
  
  // Check for __NEXT_DATA__
  const hasNextData = await page.evaluate(() => !!document.getElementById('__NEXT_DATA__'));
  console.log(`  Has __NEXT_DATA__: ${hasNextData}`);

  await browser.close();
}

testBuycycle().catch(console.error);
