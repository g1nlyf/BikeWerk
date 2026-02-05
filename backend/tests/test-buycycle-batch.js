const BuycycleFetcher = require('../utils/buycycle-fetcher');
const BuycycleParser = require('../parsers/buycycle-parser');
const fs = require('fs');
const path = require('path');

/**
 * BATCH TEST: Тест на 10 объявлениях Buycycle
 */

// 10 ссылок на MTB с Buycycle
const TEST_URLS = [
  'https://buycycle.com/de-de/product/tues-comp-2021-26483',
  'https://buycycle.com/de-de/product/stumpjumper-alloy-2022-26615',
  'https://buycycle.com/de-de/product/enduro-expert-carbon-29-2020-26584',
  'https://buycycle.com/de-de/product/neuron-cf-9-2022-26518',
  'https://buycycle.com/de-de/product/torque-cf-8-2021-26476',
  'https://buycycle.com/de-de/product/spectral-cf-8-2023-26629',
  'https://buycycle.com/de-de/product/jeffsy-cf-pro-race-2022-26544',
  'https://buycycle.com/de-de/product/capra-29-comp-2021-26502',
  'https://buycycle.com/de-de/product/genius-900-tuned-2023-26571',
  'https://buycycle.com/de-de/product/sb150-t2-2022-26493'
];

class BatchTester {
  
  static async runBatchTest() {
    console.log('\n' + '='.repeat(80));
    console.log('BUYCYCLE BATCH TEST - 10 LISTINGS');
    console.log('='.repeat(80));
    console.log(`\nTesting ${TEST_URLS.length} URLs...\n`);
    
    const results = [];
    const stats = {
      total: TEST_URLS.length,
      successful: 0,
      failed: 0,
      fields: {
        title: { success: 0, fail: 0 },
        brand: { success: 0, fail: 0 },
        price: { success: 0, fail: 0 },
        photos: { success: 0, fail: 0, total_photos: 0 },
        seller_name: { success: 0, fail: 0 },
        seller_location: { success: 0, fail: 0 },
        seller_last_active: { success: 0, fail: 0 },
        description: { success: 0, fail: 0 },
        attributes: { success: 0, fail: 0, avg_count: 0 },
        components: { success: 0, fail: 0, avg_count: 0 },
        platform_trust: { success: 0, fail: 0 },
        likes: { success: 0, fail: 0 }
      },
      errors: []
    };
    
    for (let i = 0; i < TEST_URLS.length; i++) {
      const url = TEST_URLS[i];
      const testNum = i + 1;
      
      console.log(`\n[${ testNum}/10] Testing: ${url.split('/').pop()}`);
      
      try {
        // Fetch HTML
        const html = await BuycycleFetcher.fetch(url, {
          timeout: 30000,
          saveToFile: null // Не сохраняем для экономии места
        });
        
        // Parse
        const data = BuycycleParser.parse(html, url);
        
        // Validate
        const validation = BuycycleParser.validate(data);
        
        if (validation.is_valid) {
          stats.successful++;
          console.log(`   ✅ Valid`);
        } else {
          stats.failed++;
          console.log(`   ⚠️  Validation issues: ${validation.errors.length} errors`);
        }
        
        // Collect field stats
        this.updateFieldStats(stats.fields, data);
        
        results.push({
          url,
          success: validation.is_valid,
          data: data,
          validation: validation
        });
        
      } catch (error) {
        stats.failed++;
        stats.errors.push({ url, error: error.message });
        console.log(`   ❌ Error: ${error.message}`);
        
        results.push({
          url,
          success: false,
          error: error.message
        });
      }
      
      // Небольшая пауза между запросами
      if (i < TEST_URLS.length - 1) {
        await this.sleep(2000);
      }
    }
    
    // Calculate averages
    if (stats.successful > 0) {
      stats.fields.attributes.avg_count = Math.round(
        stats.fields.attributes.avg_count / stats.successful
      );
      stats.fields.components.avg_count = Math.round(
        stats.fields.components.avg_count / stats.successful
      );
      stats.fields.photos.avg_count = Math.round(
        stats.fields.photos.total_photos / stats.successful
      );
    }
    
    // Print summary
    this.printSummary(stats);
    
    // Save detailed results
    const outputDir = path.join(__dirname, '../../test-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, 'buycycle_batch_results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      stats,
      results
    }, null, 2));
    
    console.log(`\n💾 Detailed results saved to:\n   ${outputPath}\n`);
    console.log('='.repeat(80) + '\n');
  }
  
  static updateFieldStats(fields, data) {
    // Title
    data.title ? fields.title.success++ : fields.title.fail++;
    
    // Brand
    data.brand ? fields.brand.success++ : fields.brand.fail++;
    
    // Price
    data.price ? fields.price.success++ : fields.price.fail++;
    
    // Photos
    if (data.photos && data.photos.length > 0) {
      fields.photos.success++;
      fields.photos.total_photos += data.photos.length;
    } else {
      fields.photos.fail++;
    }
    
    // Seller info
    data.seller_name ? fields.seller_name.success++ : fields.seller_name.fail++;
    data.seller_location ? fields.seller_location.success++ : fields.seller_location.fail++;
    data.seller_last_active ? fields.seller_last_active.success++ : fields.seller_last_active.fail++;
    
    // Description
    data.description ? fields.description.success++ : fields.description.fail++;
    
    // Attributes
    if (data.attributes && Object.keys(data.attributes).length > 0) {
      fields.attributes.success++;
      fields.attributes.avg_count += Object.keys(data.attributes).length;
    } else {
      fields.attributes.fail++;
    }
    
    // Components
    if (data.components && Object.keys(data.components).length > 0) {
      fields.components.success++;
      fields.components.avg_count += Object.keys(data.components).length;
    } else {
      fields.components.fail++;
    }
    
    // Platform trust
    data.platform_reviews_count ? fields.platform_trust.success++ : fields.platform_trust.fail++;
    
    // Likes
    data.likes ? fields.likes.success++ : fields.likes.fail++;
  }
  
  static printSummary(stats) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 BATCH TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n🎯 Overall Success Rate: ${stats.successful}/${stats.total} (${Math.round(stats.successful / stats.total * 100)}%)`);
    
    if (stats.failed > 0) {
      console.log(`❌ Failed: ${stats.failed}`);
    }
    
    console.log('\n📋 Field Extraction Rates:\n');
    
    const fields = stats.fields;
    const total = stats.total;
    
    console.log('   Critical Fields:');
    console.log(`   ✓ Title:            ${fields.title.success}/${total} (${Math.round(fields.title.success/total*100)}%)`);
    console.log(`   ✓ Brand:            ${fields.brand.success}/${total} (${Math.round(fields.brand.success/total*100)}%)`);
    console.log(`   ✓ Price:            ${fields.price.success}/${total} (${Math.round(fields.price.success/total*100)}%)`);
    console.log(`   ✓ Photos:           ${fields.photos.success}/${total} (${Math.round(fields.photos.success/total*100)}%) - avg ${fields.photos.avg_count} per listing`);
    
    console.log('\n   Seller Information:');
    console.log(`   ✓ Name:             ${fields.seller_name.success}/${total} (${Math.round(fields.seller_name.success/total*100)}%)`);
    console.log(`   ✓ Location:         ${fields.seller_location.success}/${total} (${Math.round(fields.seller_location.success/total*100)}%)`);
    console.log(`   ✓ Last Active:      ${fields.seller_last_active.success}/${total} (${Math.round(fields.seller_last_active.success/total*100)}%)`);
    
    console.log('\n   Product Details:');
    console.log(`   ✓ Description:      ${fields.description.success}/${total} (${Math.round(fields.description.success/total*100)}%)`);
    console.log(`   ✓ Attributes:       ${fields.attributes.success}/${total} (${Math.round(fields.attributes.success/total*100)}%) - avg ${fields.attributes.avg_count} per listing`);
    console.log(`   ✓ Components:       ${fields.components.success}/${total} (${Math.round(fields.components.success/total*100)}%) - avg ${fields.components.avg_count} per listing`);
    
    console.log('\n   Additional:');
    console.log(`   ✓ Platform Trust:   ${fields.platform_trust.success}/${total} (${Math.round(fields.platform_trust.success/total*100)}%)`);
    console.log(`   ✓ Likes:            ${fields.likes.success}/${total} (${Math.round(fields.likes.success/total*100)}%)`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach((err, i) => {
        console.log(`   ${i+1}. ${err.url.split('/').pop()}: ${err.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run test
BatchTester.runBatchTest()
  .then(() => {
    console.log('✅ Batch test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Batch test failed:', error);
    process.exit(1);
  });
