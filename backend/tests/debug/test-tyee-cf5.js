const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const TechDecoder = require('../../src/services/TechDecoder.js');
const BuycycleCollector = require('../../scrapers/buycycle-collector.js');

puppeteer.use(StealthPlugin());

async function debugTyeeCF5() {
  console.log('🔍 DEBUG: Propain Tyee CF 5\n');
  
  const url = 'https://buycycle.com/de-de/product/tyee-cf-56859bff87ed34-78175';
  
  let browser;
  try {
      browser = await puppeteer.launch({ 
          headless: "new",
          args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      // STEP 1: Raw scraping
      console.log('STEP 1: Raw HTML Scraping...');
      console.log(`   Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Use the logic from BuycycleCollector
      const rawData = await BuycycleCollector.scrapeListingDetails(page);
      // Enrich with URL and price if not in details
      rawData.url = url;
      rawData.price = rawData.price || 800; // From previous knowledge if missing
      
      console.log('\n📦 Raw Data:');
      console.log(JSON.stringify(rawData, null, 2));
      
      if (!rawData || !rawData.title) {
        console.log('\n❌ PROBLEM: Scraper returned empty data!');
        console.log('   Possible causes:');
        console.log('   1. Timeout (page took too long to load)');
        console.log('   2. Captcha/Anti-bot detected');
        console.log('   3. Selectors are wrong');
        return;
      }
      
      // STEP 2: Gemini normalization
      console.log('\n\nSTEP 2: Gemini Normalization...');
      const normalized = await TechDecoder.normalize(rawData);
      
      console.log('\n📊 Normalized Data:');
      console.log(JSON.stringify(normalized, null, 2));
      
      // STEP 3: Validation
      console.log('\n\n✅ VALIDATION:');
      console.log(`   Brand: ${normalized.basic_info.brand || '❌ MISSING'}`);
      console.log(`   Model: ${normalized.basic_info.model || '❌ MISSING'}`);
      console.log(`   Year: ${normalized.basic_info.year || '❌ MISSING'}`);
      console.log(`   Frame Size: ${normalized.specs.frame_size || '❌ MISSING'}`);
      console.log(`   Quality Score: ${normalized.quality_score}`);
      
      if (normalized.quality_score < 40) {
        console.log('\n⚠️ LOW QUALITY SCORE - Would be rejected by filter!');
      }

  } catch (e) {
      console.error('❌ Error:', e);
  } finally {
      if (browser) await browser.close();
  }
}

debugTyeeCF5().catch(console.error);
