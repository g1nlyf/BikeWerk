
const path = require('path');

// Adjust paths to match project structure
// User snippet assumed: require('../../scrapers/kleinanzeigen-collector.js');
// But we are in backend/tests/debug/
// ../../scrapers/ -> backend/src/scrapers/ (assuming backend/src structure)

// We'll try to resolve the modules. If not found, we'll try to find them in likely places.
let KleinanzeigenCollector;
let TechDecoder;
let GraduatedHunter;

try {
    // Try standard path
    KleinanzeigenCollector = require('../../src/scrapers/kleinanzeigen-collector.js');
} catch (e) {
    console.log('⚠️ KleinanzeigenCollector not found at ../../src/scrapers/kleinanzeigen-collector.js');
    try {
        // Try unified hunter as fallback
        KleinanzeigenCollector = require('../../../telegram-bot/unified-hunter.js');
        console.log('⚠️ Using UnifiedHunter as fallback');
    } catch (e2) {
        console.log('❌ Could not load KleinanzeigenCollector or UnifiedHunter');
    }
}

try {
    TechDecoder = require('../../src/services/TechDecoder.js');
} catch (e) {
    try {
        TechDecoder = require('../../src/services/tech-decoder.js');
    } catch (e2) {
        console.log('❌ Could not load TechDecoder');
    }
}

try {
    GraduatedHunter = require('../../src/services/graduated-hunter.js');
} catch (e) {
    console.log('❌ Could not load GraduatedHunter');
}

async function testFullCycle() { 
  console.log('🧪 Testing Kleinanzeigen Full Cycle\n'); 
  
  if (!KleinanzeigenCollector) {
      console.log('❌ ABORTING: Scraper module missing');
      return;
  }

  // STEP 1: Raw scraping 
  console.log('STEP 1: Raw Scraping'); 
  let rawBikes = [];
  try {
      if (KleinanzeigenCollector.searchBikes) {
          rawBikes = await KleinanzeigenCollector.searchBikes('Canyon Spectral'); 
      } else if (typeof KleinanzeigenCollector === 'function') {
          // UnifiedHunter class?
          const hunter = new KleinanzeigenCollector();
          // UnifiedHunter doesn't have searchBikes. It has hunt() or similar.
          // We might need to manually invoke what searchBikes would do:
          // 1. Construct URL
          // 2. Fetch
          // 3. Parse
          console.log('⚠️ UnifiedHunter class detected. Attempting to simulate search...');
          // This requires deep knowledge of UnifiedHunter internals.
          // For now, let's see if we can instantiate and use a method.
          // If not, we fail gracefully.
          if (hunter.parser) {
             // We can try to use the parser if we had a URL
             console.log('   (UnifiedHunter has parser, but no direct search method exposed for this test)');
          }
      }
  } catch (e) {
      console.log(`❌ Error during scraping: ${e.message}`);
  }

  console.log(`  Found: ${rawBikes.length} raw listings`); 
  
  if (rawBikes.length === 0) { 
    console.log('  ❌ PROBLEM: No bikes found (captcha? selector broken?)'); 
    // We continue with mock data if scraping fails to test other parts?
    // User wants to see where it breaks.
    if (!rawBikes.length) return;
  } 
  
  console.log(`  Sample raw bike:`, rawBikes[0]); 
  
  // STEP 2: Gemini normalization 
  console.log('\nSTEP 2: Gemini Normalization'); 
  if (!TechDecoder) {
      console.log('❌ TechDecoder missing');
      return;
  }
  
  console.log('TechDecoder keys:', Object.keys(TechDecoder));
  console.log('TechDecoder prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(TechDecoder)));

  let normalized;
  try {
      normalized = await TechDecoder.normalize(rawBikes[0]); 
      console.log(`  Brand: ${normalized.brand}`); 
      console.log(`  Model: ${normalized.model}`); 
      console.log(`  Year: ${normalized.year}`); 
      console.log(`  Quality Score: ${normalized.quality_score}`); 
      console.log(`  Category: ${normalized.category}`); 
      
      if (!normalized.quality_score || normalized.quality_score < 70) { 
        console.log('  ❌ PROBLEM: Quality scoring broken'); 
      } 
  } catch (e) {
      console.log(`❌ Error during normalization: ${e.message}`);
      return;
  }
  
  // STEP 3: Graduated Hunter 
  console.log('\nSTEP 3: Graduated Hunter Evaluation'); 
  if (!GraduatedHunter) {
      console.log('❌ GraduatedHunter missing');
      return;
  }

  try {
      const evaluation = await GraduatedHunter.evaluateBike(normalized); 
      console.log(`  Approved: ${evaluation.approved}`); 
      console.log(`  Stage: ${evaluation.stage}`); 
      console.log(`  Reason: ${evaluation.reason || 'N/A'}`); 
  } catch (e) {
      console.log(`❌ Error during evaluation: ${e.message}`);
  }
  
  console.log('\n✅ Full cycle test complete'); 
} 

testFullCycle().catch(console.error);
