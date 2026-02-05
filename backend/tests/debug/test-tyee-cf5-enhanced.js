
const BuycycleDetailScraper = require('../../scrapers/buycycle-detail-scraper');

async function debugTyeeCF5() {
  const url = 'https://buycycle.com/de-de/product/tyee-cf-56859bff87ed34-78175';
  console.log(`🔍 Testing Enhanced Scraper on: ${url}`);
  
  try {
    const details = await BuycycleDetailScraper.scrapeProductPage(url);
    console.log('✅ Result:', JSON.stringify(details, null, 2));
    
    if (!details) {
      console.error('❌ Scraper returned null');
    } else if (!details.description && !details.components) {
      console.warn('⚠️ Warning: Description/Components missing');
    } else {
        console.log('🎉 Success! Data extracted.');
    }
  } catch (error) {
    console.error('❌ Fatal Error:', error);
  }
}

debugTyeeCF5();
