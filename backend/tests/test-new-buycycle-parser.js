const BuycycleFetcher = require('../utils/buycycle-fetcher');
const BuycycleParser = require('../parsers/buycycle-parser');
const fs = require('fs');
const path = require('path');

// Ensure test-results directory exists
const resultsDir = path.join(__dirname, '../test-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function testBuycycleParser() {
  const testUrls = [
    'https://buycycle.com/de-de/product/tues-comp-2021-26483',
    'https://buycycle.com/de-de/product/spectral-al-70-2016695e5a638dad0-48281',
    'https://buycycle.com/de-de/product/force-10-200868e2c3586f69a-74989'
  ];
  
  const results = [];
  
  for (const url of testUrls) {
    console.log(`\n🧪 Testing: ${url}`);
    
    try {
      const html = await BuycycleFetcher.fetch(url);
      
      // Check if Parser has parse method, if not, inspect it
      if (typeof BuycycleParser.parse !== 'function') {
         console.error('❌ BuycycleParser.parse is not a function');
         console.log('BuycycleParser exports:', BuycycleParser);
         throw new Error('BuycycleParser structure invalid');
      }

      const parsed = BuycycleParser.parse(html, url);
      
      // Add validation helper if not exists in Parser class
      const validation = typeof BuycycleParser.validate === 'function' 
        ? BuycycleParser.validate(parsed) 
        : { is_valid: true, errors: [] }; // Mock validation if missing
      
      results.push({
        url,
        success: validation.is_valid,
        data: parsed,
        validation
      });
      
      console.log(`   ✅ Success - ${parsed.title}`);
      console.log(`   - Brand: ${parsed.brand}`);
      console.log(`   - Price: ${parsed.price?.value || parsed.price} ${parsed.currency || 'EUR'}`);
      console.log(`   - Photos: ${parsed.photos?.length}`);
      console.log(`   - Components: ${Object.keys(parsed.components || {}).length}`);
      console.log(`   - Attributes: ${JSON.stringify(parsed.attributes)}`);
      console.log(`   - Breadcrumb: ${JSON.stringify(parsed.breadcrumb)}`);
      
    } catch (error) {
      results.push({ url, success: false, error: error.message });
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  // Сохраняем результаты
  fs.writeFileSync(
    path.join(resultsDir, 'buycycle-parser-test.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n✅ Test complete!');
  return results;
}

testBuycycleParser().catch(console.error);
