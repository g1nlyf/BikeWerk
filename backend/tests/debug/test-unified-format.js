const BuycycleCollector = require('../../scrapers/buycycle-collector.js');
const KleinanzeigenCollector = require('../../src/scrapers/kleinanzeigen-collector.js');
const UnifiedBikeMapper = require('../../src/mappers/unified-bike-mapper.js');
const { db } = require('../../src/js/mysql-config.js');

async function testUnifiedFormat() {
  console.log('🧪 TESTING UNIFIED BIKE FORMAT\n');
  console.log('═'.repeat(60) + '\n');
  
  // TEST 1: Buycycle
  console.log('TEST 1: Buycycle Scraper\n');
  
  // We use searchBikes if available, or collectForTarget
  // BuycycleCollector exports an INSTANCE (new BuycycleCollector()), so we call methods on it directly.
  // Check if searchBikes exists, otherwise use collectForTarget mock or similar.
  // Actually BuycycleCollector.js has collectForTarget. It does NOT have searchBikes.
  // But the user code provided: await BuycycleCollector.searchBikes('Canyon Sender');
  // I should check if I need to implement searchBikes or if I should adjust the test.
  // Looking at the file I just read: it has collectForTarget(target) and extractListingsFromPage(page).
  // It does NOT have searchBikes(term).
  // I will add a wrapper or use collectForTarget.
  
  // Let's assume for the test we want to simulate what the user asked.
  // But since I can't easily change the class to static without breaking other things, 
  // I'll modify the test to use the existing method or mock it if needed.
  // Actually, I should probably UPDATE BuycycleCollector to have searchBikes as per user implication 
  // or just adapt the test to use what exists.
  // The user said: "Надо переобуть buycycle ... хантеров".
  // So I will likely be modifying BuycycleCollector anyway.
  
  // For now, I'll try to use collectForTarget with a dummy target.
  const target = { brand: 'Canyon', model: 'Sender', limit: 1 };
  
  // Note: collectForTarget is async.
  // But wait, collectForTarget performs deep analysis using TechDecoder.
  // I need to ensure that returns the Unified Format.
  
  try {
      const buycycleBikes = await BuycycleCollector.collectForTarget(target);
      
      if (buycycleBikes && buycycleBikes.length > 0) {
        const bike1 = buycycleBikes[0];
        console.log('✅ Found bike from Buycycle');
        // Check if it matches Unified Format (has basic_info, etc.)
        if (bike1.basic_info) {
            console.log(`   Title: ${bike1.basic_info.name || bike1.basic_info.title}`);
            console.log(`   Price: €${bike1.pricing.price}`);
            console.log(`\n📄 Unified JSON:`);
            console.log(JSON.stringify(bike1, null, 2));
            
            // Save to DB
            const dbRow = UnifiedBikeMapper.toDatabase(bike1);
            console.log(`\n💾 DB Row (sample fields):`);
            console.log(`   brand: ${dbRow.brand}`);
            console.log(`   model: ${dbRow.model}`);
            console.log(`   price: ${dbRow.price}`);
            console.log(`   frame_material: ${dbRow.frame_material}`);
        } else {
             console.log('⚠️ Bike found but NOT in Unified Format:', JSON.stringify(bike1, null, 2));
        }
      } else {
        console.log('❌ No bikes found on Buycycle');
      }
  } catch (e) {
      console.error('Buycycle Test Error:', e);
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
  
  // TEST 2: Kleinanzeigen
  console.log('TEST 2: Kleinanzeigen Scraper\n');
  
  try {
      // KleinanzeigenCollector is a class with static searchBikes
      const kleinBikes = await KleinanzeigenCollector.searchBikes('YT Capra', { limit: 1 });
      
      if (kleinBikes.length > 0) {
        // NOTE: searchBikes currently returns a simple list.
        // We need to fetch details to get the Unified Format.
        // I will need to update KleinanzeigenCollector to do deep fetching or do it here.
        // The user instruction implies the hunter should output the format.
        // I will assume I'll update searchBikes or add a deep fetch step.
        
        // For this test, let's assume I'll add a method `getUnifiedDetails` or similar, 
        // OR searchBikes will return unified objects.
        // Given current implementation, searchBikes returns simple objects.
        // I will simulate the deep fetch here using GeminiProcessor (which I will update).
        
        const GeminiProcessor = require('../../src/services/geminiProcessor.js');
        // I need to implement analyzeBikeToUnifiedFormat first!
        // So this test might fail if run before I implement that.
        
        const bike2 = kleinBikes[0];
        console.log('✅ Found bike from Kleinanzeigen (Basic)');
        
        // Mocking the deep dive if method exists
        if (GeminiProcessor.analyzeBikeToUnifiedFormat) {
            console.log('   🔄 Performing Deep Analysis (Unified)...');
            // We need a snapshot. KleinanzeigenCollector returns { title, price, url, description... }
            const snapshot = {
                title: bike2.title,
                price: bike2.price,
                description: bike2.description,
                url: bike2.url,
                images: [bike2.image]
            };
            const unifiedBike = await GeminiProcessor.analyzeBikeToUnifiedFormat(snapshot);
            
            console.log(`   Title: ${unifiedBike.basic_info.name}`);
            console.log(`   Price: €${unifiedBike.pricing.price}`);
            console.log(`\n📄 Unified JSON:`);
            console.log(JSON.stringify(unifiedBike, null, 2));
            
            const dbRow2 = UnifiedBikeMapper.toDatabase(unifiedBike);
            console.log(`\n💾 DB Row (sample fields):`);
            console.log(`   brand: ${dbRow2.brand}`);
            console.log(`   model: ${dbRow2.model}`);
            console.log(`   price: ${dbRow2.price}`);
            console.log(`   location: ${dbRow2.location}`);
        } else {
             console.log('⚠️ analyzeBikeToUnifiedFormat not implemented yet.');
        }

      } else {
        console.log('❌ No bikes found on Kleinanzeigen');
      }
  } catch (e) {
      console.error('Kleinanzeigen Test Error:', e);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ Unified Format Test Complete\n');
  
  // Close DB connection
  // db.close(); // DatabaseManager doesn't expose close directly in the instance sometimes, check impl
}

testUnifiedFormat().catch(console.error);
