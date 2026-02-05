const BuycycleFetcher = require('../utils/buycycle-fetcher');
const BuycycleParser = require('../parsers/buycycle-parser');
const GeminiBikeProcessorV2 = require('../services/gemini-bike-processor-v2');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * СПРИНТ 2: ТЕСТ Parser → Gemini → Unified JSON
 */
async function testParserToGemini() {
  console.log('='.repeat(80));
  console.log('🧪 SPRINT 2: Parser → Gemini → Unified JSON v2.2.0');
  console.log('='.repeat(80));
  console.log('\n');
  
  const testUrl = 'https://buycycle.com/de-de/product/tues-comp-2021-26483';
  
  try {
    // Проверяем API ключ
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not found! Set it in .env file');
    }
    
    console.log(`🔑 API Key: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`);
    console.log('');
    
    // ============================================
    // STEP 1: FETCH
    // ============================================
    console.log('📥 STEP 1: FETCHING\n');
    console.log(`   URL: ${testUrl}`);
    
    const fetchStart = Date.now();
    const html = await BuycycleFetcher.fetch(testUrl, { timeout: 45000 });
    const fetchTime = ((Date.now() - fetchStart) / 1000).toFixed(1);
    
    console.log(`   ✅ Fetched ${html.length} chars in ${fetchTime}s\n`);
    
    // ============================================
    // STEP 2: PARSE
    // ============================================
    console.log('🔍 STEP 2: PARSING\n');
    
    const parseStart = Date.now();
    const parsed = BuycycleParser.parse(html, testUrl);
    const parseTime = ((Date.now() - parseStart) / 1000).toFixed(1);
    
    const validation = BuycycleParser.validate(parsed);
    
    console.log(`   Title: ${parsed.title}`);
    console.log(`   Brand: ${parsed.brand || '⚠️  null (will be inferred by Gemini)'}`);
    console.log(`   Price: €${parsed.price?.value}`);
    console.log(`   Old Price: €${parsed.old_price?.value || 'N/A'}`);
    console.log(`   Buyer Protection: €${parsed.buyer_protection_price?.value || 'N/A'}`);
    console.log(`   Photos: ${parsed.photos?.length}`);
    console.log(`   Components: ${Object.keys(parsed.components || {}).length}`);
    console.log(`   Attributes: ${Object.keys(parsed.attributes || {}).length}`);
    console.log(`   Validation: ${validation.is_valid ? '✅ Valid' : '⚠️  Has warnings'}`);
    console.log(`   Parse time: ${parseTime}s`);
    
    if (!validation.is_valid) {
      console.log(`   ⚠️  Warnings: ${validation.warnings.join(', ')}`);
    }
    console.log('');
    
    // ============================================
    // STEP 3: GEMINI PROCESSING
    // ============================================
    console.log('🤖 STEP 3: GEMINI AI PROCESSING\n');
    
    const processor = new GeminiBikeProcessorV2(process.env.GEMINI_API_KEY);
    const geminiStart = Date.now();
    const unified = await processor.processParsedData(parsed);
    const geminiTime = ((Date.now() - geminiStart) / 1000).toFixed(1);
    
    console.log(`   ⏱️  Gemini processing time: ${geminiTime}s\n`);
    
    // ============================================
    // STEP 4: VALIDATION
    // ============================================
    console.log('📊 STEP 4: UNIFIED FORMAT VALIDATION\n');
    
    const checks = {
      'Meta': {
        'source_platform = "buycycle"': unified.meta.source_platform === 'buycycle',
        'source_ad_id exists': !!unified.meta.source_ad_id,
        'platform_trust.reviews_count': !!unified.meta.platform_trust.reviews_count,
        'timestamps valid': !!unified.meta.created_at
      },
      'Basic Info': {
        'brand (restored by AI)': !!unified.basic_info.brand,
        'model extracted': !!unified.basic_info.model,
        'year present': !!unified.basic_info.year,
        'category classified': !!unified.basic_info.category,
        'sub_category classified': !!unified.basic_info.sub_category,
        'breadcrumb preserved': !!unified.basic_info.breadcrumb,
        'description in Russian': unified.basic_info.language === 'ru' && unified.basic_info.description.length > 20,
        'name = brand + model': unified.basic_info.name.includes(unified.basic_info.brand)
      },
      'Pricing': {
        'price matches parser': unified.pricing.price === parsed.price?.value,
        'buyer_protection preserved': !!unified.pricing.buyer_protection.price,
        'FMV calculated': !!unified.pricing.fmv && unified.pricing.fmv > 0,
        'FMV confidence > 0': unified.pricing.fmv_confidence > 0,
        'market_comparison determined': !!unified.pricing.market_comparison,
        'optimal_price calculated': !!unified.pricing.optimal_price
      },
      'Specs': {
        'frame_size preserved': !!unified.specs.frame_size,
        'wheel_size preserved': !!unified.specs.wheel_size,
        'frame_material preserved': !!unified.specs.frame_material,
        'shifting_type preserved': !!unified.specs.shifting_type,
        'component_upgrades array': Array.isArray(unified.specs.component_upgrades),
        'upgraded components detected': unified.specs.component_upgrades.some(c => c.replaced)
      },
      'Condition': {
        'score in range 0-100': unified.condition.score >= 0 && unified.condition.score <= 100,
        'grade is A/B/C': ['A', 'B', 'C'].includes(unified.condition.grade),
        'visual_rating 1-5': unified.condition.visual_rating >= 1 && unified.condition.visual_rating <= 5,
        'receipt_available boolean': typeof unified.condition.receipt_available === 'boolean',
        'issues in Russian': unified.condition.issues.length === 0 || typeof unified.condition.issues[0] === 'string'
      },
      'Seller': {
        'name preserved': !!unified.seller.name,
        'rating_visual (stars)': !!unified.seller.rating_visual,
        'last_active preserved': !!unified.seller.last_active,
        'type classified': ['private', 'dealer', 'professional'].includes(unified.seller.type),
        'trust_score calculated': unified.seller.trust_score >= 0
      },
      'Media': {
        'main_image = first photo': unified.media.main_image === parsed.photos[0],
        'gallery = all photos': unified.media.gallery.length === parsed.photos.length,
        'photo_quality > 0': unified.media.photo_quality > 0,
        'photo_coverage analyzed': typeof unified.media.photo_coverage === 'object'
      },
      'Ranking': {
        'likes preserved': unified.ranking.likes === parsed.likes,
        'value_score calculated': unified.ranking.value_score > 0,
        'tier assigned (1-4)': unified.ranking.tier >= 1 && unified.ranking.tier <= 4,
        'badges array': Array.isArray(unified.ranking.badges),
        'is_hot_offer determined': typeof unified.ranking.is_hot_offer === 'boolean'
      },
      'AI Analysis': {
        'model name': unified.ai_analysis.model === 'gemini-1.5-flash',
        'confidence > 0': unified.ai_analysis.confidence > 0,
        'processing_time recorded': unified.ai_analysis.processing_time > 0,
        'inferred_fields listed': Array.isArray(unified.ai_analysis.inferred_fields),
        'corrections listed': Array.isArray(unified.ai_analysis.corrections)
      },
      'Quality Metrics': {
        'quality_score > 0': unified.quality_score > 0,
        'completeness > 50%': unified.completeness > 50,
        'ai_confidence > 0.5': unified.ai_analysis.confidence > 0.5
      },
      'Features (Russian)': {
        'upgrades in Russian': unified.features.upgrades.length === 0 || /[а-яА-Я]/.test(unified.features.upgrades[0]),
        'highlights in Russian': unified.features.highlights.length === 0 || /[а-яА-Я]/.test(unified.features.highlights[0]),
        'special_notes exists': unified.features.special_notes !== undefined
      }
    };
    
    let totalChecks = 0;
    let passedChecks = 0;
    
    for (const [category, tests] of Object.entries(checks)) {
      console.log(`   ${category}:`);
      for (const [test, result] of Object.entries(tests)) {
        totalChecks++;
        if (result) passedChecks++;
        const icon = result ? '✅' : '❌';
        console.log(`      ${icon} ${test}`);
      }
      console.log('');
    }
    
    const passRate = (passedChecks / totalChecks * 100).toFixed(1);
    
    // ============================================
    // STEP 5: SAVE RESULTS
    // ============================================
    console.log('💾 STEP 5: SAVING RESULTS\n');
    
    const outputDir = path.join(__dirname, '../../test-results/sprint-2-parser-to-gemini');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    
    const parsedPath = path.join(outputDir, `1-parsed-${timestamp}.json`);
    const unifiedPath = path.join(outputDir, `2-unified-${timestamp}.json`);
    const reportPath = path.join(outputDir, `3-report-${timestamp}.txt`);
    
    fs.writeFileSync(parsedPath, JSON.stringify(parsed, null, 2));
    fs.writeFileSync(unifiedPath, JSON.stringify(unified, null, 2));
    
    const report = `
SPRINT 2 TEST REPORT
${'='.repeat(80)}

Test URL: ${testUrl}
Test Date: ${new Date().toISOString()}

PERFORMANCE:
  - Fetch time: ${fetchTime}s
  - Parse time: ${parseTime}s
  - Gemini time: ${geminiTime}s
  - Total time: ${(parseFloat(fetchTime) + parseFloat(parseTime) + parseFloat(geminiTime)).toFixed(1)}s

VALIDATION:
  - Pass rate: ${passRate}%
  - Passed: ${passedChecks}/${totalChecks}
  - Failed: ${totalChecks - passedChecks}

KEY RESULTS:
  - Brand: ${unified.basic_info.brand || 'NULL (AI failed to infer)'}
  - Model: ${unified.basic_info.model}
  - Category: ${unified.basic_info.category}
  - Sub-category: ${unified.basic_info.sub_category}
  - Condition Score: ${unified.condition.score}
  - Grade: ${unified.condition.grade}
  - FMV: €${unified.pricing.fmv}
  - Quality Score: ${unified.quality_score}
  - Completeness: ${unified.completeness.toFixed(1)}%
  - AI Confidence: ${unified.ai_analysis.confidence.toFixed(2)}

FAILED CHECKS:
${Object.entries(checks).map(([cat, tests]) => {
  const failed = Object.entries(tests).filter(([_, result]) => !result);
  return failed.length > 0 ? `  ${cat}:\n${failed.map(([test]) => `    - ${test}`).join('\n')}` : '';
}).filter(s => s).join('\n')}

FILES SAVED:
  - ${parsedPath}
  - ${unifiedPath}
  - ${reportPath}
`;
    
    fs.writeFileSync(reportPath, report);
    
    console.log(`   ✅ Parsed data: ${parsedPath}`);
    console.log(`   ✅ Unified data: ${unifiedPath}`);
    console.log(`   ✅ Report: ${reportPath}`);
    console.log('');
    
    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log('='.repeat(80));
    console.log(`📊 SPRINT 2 TEST ${passRate >= 90 ? '✅ PASSED' : passRate >= 75 ? '⚠️  PASSED WITH WARNINGS' : '❌ FAILED'}`);
    console.log('='.repeat(80));
    console.log(`\n   Pass Rate: ${passRate}%`);
    console.log(`   Total Time: ${(parseFloat(fetchTime) + parseFloat(parseTime) + parseFloat(geminiTime)).toFixed(1)}s`);
    console.log(`   Quality Score: ${unified.quality_score}`);
    console.log(`   Completeness: ${unified.completeness.toFixed(1)}%`);
    console.log(`   AI Confidence: ${unified.ai_analysis.confidence.toFixed(2)}`);
    
    if (passRate >= 90) {
      console.log('\n   🎉 EXCELLENT! Ready for Sprint 3 (Database Integration)');
    } else if (passRate >= 75) {
      console.log('\n   ⚠️  GOOD, but review failed checks above');
    } else {
      console.log('\n   ❌ NEEDS WORK. Check failed validations.');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n');
    
    return { parsed, unified, passRate };
    
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ SPRINT 2 TEST FAILED');
    console.error('='.repeat(80));
    console.error(`\nError: ${error.message}`);
    console.error(`\nStack trace:`);
    console.error(error.stack);
    throw error;
  }
}

// Run test
if (require.main === module) {
  testParserToGemini()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = testParserToGemini;
