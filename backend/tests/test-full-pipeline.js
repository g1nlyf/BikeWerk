const BuycycleFetcher = require('../utils/buycycle-fetcher');
const BuycycleParser = require('../parsers/buycycle-parser');
const GeminiBikeProcessorV2 = require('../services/gemini-bike-processor-v2');
const DatabaseServiceV2 = require('../services/database-service-v2');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * СПРИНТ 3: ТЕСТ FULL PIPELINE
 * Fetch → Parse → Gemini → Database
 */
async function testFullPipeline() {
  console.log('='.repeat(80));
  console.log('🧪 SPRINT 3: Full Pipeline Test');
  console.log('='.repeat(80));
  console.log('   Fetch → Parse → Gemini → Database → Verify\n');
  
  const testUrl = 'https://buycycle.com/de-de/product/tues-comp-2021-26483';
  
  let bikeId = null;
  let db = null;
  
  try {
    // ============================================
    // STEP 1: FETCH
    // ============================================
    console.log('📥 STEP 1: FETCHING\n');
    
    const fetchStart = Date.now();
    const html = await BuycycleFetcher.fetch(testUrl, { timeout: 90000 });
    const fetchTime = ((Date.now() - fetchStart) / 1000).toFixed(1);
    
    console.log(`   ✅ Fetched ${html.length} chars in ${fetchTime}s\n`);
    
    // ============================================
    // STEP 2: PARSE
    // ============================================
    console.log('🔍 STEP 2: PARSING\n');
    
    const parseStart = Date.now();
    const parsed = BuycycleParser.parse(html, testUrl);
    const parseTime = ((Date.now() - parseStart) / 1000).toFixed(1);
    
    console.log(`   ✅ Parsed: ${parsed.title} (${parseTime}s)\n`);
    
    // ============================================
    // STEP 3: GEMINI
    // ============================================
    console.log('🤖 STEP 3: GEMINI PROCESSING\n');
    
    const processor = new GeminiBikeProcessorV2(process.env.GEMINI_API_KEY);
    const geminiStart = Date.now();
    const unified = await processor.processParsedData(parsed);
    const geminiTime = ((Date.now() - geminiStart) / 1000).toFixed(1);
    
    console.log(`   ✅ AI processed in ${geminiTime}s\n`);
    
    // ============================================
    // STEP 4: DATABASE INSERT
    // ============================================
    console.log('💾 STEP 4: DATABASE INSERT\n');
    
    db = new DatabaseServiceV2();
    
    // CLEANUP: Delete if exists to ensure clean test
    try {
      db.db.prepare('DELETE FROM bikes WHERE source_ad_id = ? AND source_platform = ?')
           .run(unified.meta.source_ad_id, unified.meta.source_platform);
      console.log(`   🧹 Cleaned up existing entry for ad_id: ${unified.meta.source_ad_id}`);
    } catch (e) {
      console.log(`   ⚠️ Cleanup failed (non-fatal): ${e.message}`);
    }

    const insertStart = Date.now();
    bikeId = db.insertBike(unified);
    const insertTime = ((Date.now() - insertStart) / 1000).toFixed(1);
    
    console.log(`   ✅ Inserted in ${insertTime}s\n`);
    
    // ============================================
    // STEP 5: VERIFICATION
    // ============================================
    console.log('✔️  STEP 5: VERIFICATION\n');
    
    if (bikeId) {
      const savedBike = db.getBikeById(bikeId);
      
      const verifications = {
        'Basic Fields': {
          'id exists': !!savedBike.id,
          'brand matches': savedBike.brand === unified.basic_info.brand,
          'model matches': savedBike.model === unified.basic_info.model,
          'price matches': savedBike.price === unified.pricing.price,
          'category matches': savedBike.category === unified.basic_info.category,
          'sub_category matches': savedBike.sub_category === unified.basic_info.sub_category
        },
        'New Fields (Sprint 2)': {
          'breadcrumb saved': !!savedBike.breadcrumb,
          'buyer_protection_price saved': !!savedBike.buyer_protection_price,
          'seller_rating_visual saved': !!savedBike.seller_rating_visual,
          'seller_last_active saved': !!savedBike.seller_last_active,
          'shifting_type saved': !!savedBike.shifting_type,
          'receipt_available saved': typeof savedBike.receipt_available === 'number',
          'platform_reviews_count saved': !!savedBike.platform_reviews_count,
          'platform_reviews_source saved': !!savedBike.platform_reviews_source,
          'component_upgrades_json saved': !!savedBike.component_upgrades_json
        },
        'JSON Fields': {
          'unified_data is valid JSON': isValidJSON(savedBike.unified_data),
          'specs_json is valid JSON': isValidJSON(savedBike.specs_json),
          'ai_analysis_json is valid JSON': isValidJSON(savedBike.ai_analysis_json)
        },
        'Quality Metrics': {
          'quality_score saved': savedBike.quality_score > 0,
          'completeness saved': savedBike.completeness > 0,
          'condition_score saved': savedBike.condition_score > 0,
          'condition_grade saved': !!savedBike.condition_grade,
          'fmv saved': savedBike.fmv > 0
        }
      };
      
      let totalChecks = 0;
      let passedChecks = 0;
      
      for (const [category, tests] of Object.entries(verifications)) {
        console.log(`   ${category}:`);
        for (const [test, result] of Object.entries(tests)) {
          totalChecks++;
          if (result) passedChecks++;
          console.log(`      ${result ? '✅' : '❌'} ${test}`);
        }
        console.log('');
      }
      
      const passRate = (passedChecks / totalChecks * 100).toFixed(1);
      
      // ============================================
      // STEP 6: SAVE REPORT
      // ============================================
      console.log('📄 STEP 6: SAVING REPORT\n');
      
      const outputDir = path.join(__dirname, '../../test-results/sprint-3-full-pipeline');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      
      const report = {
        test_date: new Date().toISOString(),
        test_url: testUrl,
        performance: {
          fetch_time: parseFloat(fetchTime),
          parse_time: parseFloat(parseTime),
          gemini_time: parseFloat(geminiTime),
          insert_time: bikeId ? parseFloat(insertTime) : 0,
          total_time: parseFloat(fetchTime) + parseFloat(parseTime) + parseFloat(geminiTime) + (bikeId ? parseFloat(insertTime) : 0)
        },
        result: {
          bike_id: bikeId,
          brand: savedBike.brand,
          model: savedBike.model,
          category: savedBike.category,
          sub_category: savedBike.sub_category,
          price: savedBike.price,
          fmv: savedBike.fmv,
          quality_score: savedBike.quality_score,
          completeness: savedBike.completeness,
          condition_grade: savedBike.condition_grade
        },
        verification: {
          pass_rate: passRate,
          passed: passedChecks,
          total: totalChecks
        },
        verifications
      };
      
      const reportPath = path.join(outputDir, `pipeline-test-${timestamp}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      console.log(`   ✅ Report saved: ${reportPath}\n`);
      
      // ============================================
      // FINAL SUMMARY
      // ============================================
      console.log('='.repeat(80));
      console.log(`📊 SPRINT 3 TEST ${passRate >= 90 ? '✅ PASSED' : '❌ FAILED'}`);
      console.log('='.repeat(80));
      console.log(`\n   Database ID: ${bikeId}`);
      console.log(`   Brand: ${savedBike.brand}`);
      console.log(`   Model: ${savedBike.model}`);
      console.log(`   Category: ${savedBike.category}/${savedBike.sub_category}`);
      console.log(`   Price: €${savedBike.price}`);
      console.log(`   FMV: €${savedBike.fmv}`);
      console.log(`   Quality Score: ${savedBike.quality_score}`);
      console.log(`   Completeness: ${savedBike.completeness.toFixed(1)}%`);
      console.log(`   Grade: ${savedBike.condition_grade}`);
      console.log(`\n   Pass Rate: ${passRate}%`);
      console.log(`   Total Time: ${report.performance.total_time.toFixed(1)}s`);
      
      if (passRate >= 90) {
        console.log('\n   🎉 EXCELLENT! Ready for Sprint 4 (Orchestrator Integration)');
      } else {
        console.log('\n   ❌ NEEDS WORK. Check failed verifications.');
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('\n');
      
      return { bikeId, savedBike, passRate };
      
    } else {
      console.log('   ⚠️  Bike already existed, verification skipped\n');
      return { bikeId: null, savedBike: null, passRate: null };
    }
    
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ SPRINT 3 TEST FAILED');
    console.error('='.repeat(80));
    console.error(`\nError: ${error.message}`);
    console.error(error.stack);
    throw error;
    
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Helper
function isValidJSON(str) {
  if (!str) return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Run test
if (require.main === module) {
  testFullPipeline()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = testFullPipeline;
