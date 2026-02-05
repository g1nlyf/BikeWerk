const KleinanzeigenFetcher = require('../utils/kleinanzeigen-fetcher');
const KleinanzeigenParser = require('../parsers/kleinanzeigen-parser');
const fs = require('fs');
const path = require('path');

// Ensure test-results directory exists
const resultsDir = path.join(__dirname, '../test-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function testKleinanzeigenParser() {
  const testUrls = [
    'https://www.kleinanzeigen.de/s-anzeige/canyon-fully-mountainbike-groesse-l/3309275737-217-7196',
    'https://www.kleinanzeigen.de/s-anzeige/specialized-stumpjumper-evo/3312353076-217-8239'
  ];
  
  const results = [];
  
  for (const url of testUrls) {
    console.log(`\n🧪 Testing: ${url}`);
    
    try {
      const html = await KleinanzeigenFetcher.fetch(url);
      
      if (typeof KleinanzeigenParser.parse !== 'function') {
         throw new Error('KleinanzeigenParser.parse is not a function');
      }

      const parsed = KleinanzeigenParser.parse(html, url);
      
      const validation = typeof KleinanzeigenParser.validate === 'function' 
        ? KleinanzeigenParser.validate(parsed)
        : { is_valid: true, errors: [] };
      
      results.push({
        url,
        success: validation.is_valid,
        data: parsed,
        validation
      });
      
      console.log(`   ✅ Success - ${parsed.title}`);
      console.log(`   - Brand: ${parsed.brand}`);
      console.log(`   - Price: ${typeof parsed.price === 'object' ? JSON.stringify(parsed.price) : parsed.price}`);
      console.log(`   - Photos: ${parsed.photos?.length}`);
      
    } catch (error) {
      results.push({ url, success: false, error: error.message });
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  fs.writeFileSync(
    path.join(resultsDir, 'kleinanzeigen-parser-test.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n✅ Test complete!');
  return results;
}

testKleinanzeigenParser().catch(console.error);
