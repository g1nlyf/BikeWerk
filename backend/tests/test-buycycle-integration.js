const BuycycleFetcher = require('../utils/buycycle-fetcher');
const BuycycleParser = require('../parsers/buycycle-parser');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * INTEGRATION TEST: Использует реальные URL из Buycycle
 */

class IntegrationTester {
  
  /**
   * Собираем ссылки на товары из категории
   */
  static async collectListingUrls(categoryUrl, maxListings = 10) {
    console.log(`\n🔍 Collecting listing URLs from category page...`);
    console.log(`   URL: ${categoryUrl}`);
    
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('   ⏳ Loading page...');
    await page.goto(categoryUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log('   ⏳ Waiting for content...');
    await this.sleep(3000);
    
    // Скроллим вниз для lazy loading
    console.log('   📜 Scrolling page...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await this.sleep(1000);
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.sleep(1000);
    
    // Пробуем разные селекторы
    console.log('   🔎 Searching for listing links...');
    
    const listingUrls = await page.evaluate(() => {
      const links = [];
      
      // Стратегия 1: Ищем ссылки с /product/
      const productLinks = document.querySelectorAll('a[href*="/product/"]');
      console.log(`Found ${productLinks.length} links with /product/`);
      
      productLinks.forEach(a => {
        const href = a.getAttribute('href');
        if (href && href.includes('/product/')) {
          const fullUrl = href.startsWith('http') 
            ? href 
            : `https://buycycle.com${href}`;
          links.push(fullUrl);
        }
      });
      
      // Стратегия 2: Ищем карточки товаров
      const cards = document.querySelectorAll('[data-test*="product"], [class*="product-card"], [class*="bike-card"]');
      console.log(`Found ${cards.length} product cards`);
      
      cards.forEach(card => {
        const link = card.querySelector('a');
        if (link) {
          const href = link.getAttribute('href');
          if (href && href.includes('/product/')) {
            const fullUrl = href.startsWith('http') 
              ? href 
              : `https://buycycle.com${href}`;
            links.push(fullUrl);
          }
        }
      });
      
      // Стратегия 3: Все ссылки на странице
      const allLinks = document.querySelectorAll('a');
      console.log(`Total links on page: ${allLinks.length}`);
      
      allLinks.forEach(a => {
        const href = a.getAttribute('href');
        if (href && href.includes('/product/') && !href.includes('search')) {
          const fullUrl = href.startsWith('http') 
            ? href 
            : `https://buycycle.com${href}`;
          links.push(fullUrl);
        }
      });
      
      return [...new Set(links)]; // Убираем дубликаты
    });
    
    await browser.close();
    
    console.log(`   ✅ Found ${listingUrls.length} unique listings`);
    
    if (listingUrls.length > 0) {
      console.log('\n   📋 Sample URLs:');
      listingUrls.slice(0, 3).forEach(url => {
        console.log(`      - ${url}`);
      });
    }
    
    return listingUrls.slice(0, maxListings);
  }
  
  /**
   * Основной тест
   */
  static async runIntegrationTest() {
    console.log('\n' + '='.repeat(80));
    console.log('BUYCYCLE INTEGRATION TEST - Real Listings');
    console.log('='.repeat(80));
    
    try {
      // 1. Собираем URL из MTB категории
      const categoryUrl = 'https://buycycle.com/de-de/shop/main-types/bikes/bike-types/mountainbike';
      let urls = await this.collectListingUrls(categoryUrl, 10);
      
      // Fallback: если не нашли, пробуем другую категорию
      if (urls.length === 0) {
        console.log('\n⚠️  No listings in MTB category, trying general bikes...');
        const fallbackUrl = 'https://buycycle.com/de-de/shop/main-types/bikes';
        urls = await this.collectListingUrls(fallbackUrl, 10);
      }
      
      // Последний fallback: хардкодим одну рабочую ссылку
      if (urls.length === 0) {
        console.log('\n⚠️  Using fallback test URL...');
        urls = ['https://buycycle.com/de-de/product/tues-comp-2021-26483'];
      }
      
      if (urls.length === 0) {
        throw new Error('Could not collect any listing URLs');
      }
      
      console.log(`\n📋 Testing ${urls.length} listings:\n`);
      urls.forEach((url, i) => {
        const parts = url.split('/');
        console.log(`   ${i+1}. ${parts[parts.length-1]}`);
      });
      
      // 2. Тестируем каждый URL
      const results = [];
      const stats = {
        total: urls.length,
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
      
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const testNum = i + 1;
        
        const parts = url.split('/');
        console.log(`\n[${testNum}/${urls.length}] Testing: ${parts[parts.length-1]}`);
        
        try {
          // Fetch HTML
          const html = await BuycycleFetcher.fetch(url, {
            timeout: 30000,
            saveToFile: null
          });
          
          // Parse
          const data = BuycycleParser.parse(html, url);
          
          // Validate
          const validation = BuycycleParser.validate(data);
          
          if (validation.is_valid) {
            stats.successful++;
            console.log(`   ✅ Valid - ${data.title}`);
          } else {
            stats.failed++;
            console.log(`   ⚠️  Partial - ${validation.errors.length} errors`);
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
        
        // Пауза между запросами
        if (i < urls.length - 1) {
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
      
      // Save results
      const outputDir = path.join(__dirname, '../../test-results');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, 'buycycle_integration_results.json');
      fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        category: categoryUrl,
        stats,
        results
      }, null, 2));
      
      console.log(`\n💾 Detailed results saved to:\n   ${outputPath}\n`);
      console.log('='.repeat(80) + '\n');
      
    } catch (error) {
      console.error('\n❌ Integration test failed:', error);
      throw error;
    }
  }
  
  static updateFieldStats(fields, data) {
    data.title ? fields.title.success++ : fields.title.fail++;
    data.brand ? fields.brand.success++ : fields.brand.fail++;
    data.price ? fields.price.success++ : fields.price.fail++;
    
    if (data.photos && data.photos.length > 0) {
      fields.photos.success++;
      fields.photos.total_photos += data.photos.length;
    } else {
      fields.photos.fail++;
    }
    
    data.seller_name ? fields.seller_name.success++ : fields.seller_name.fail++;
    data.seller_location ? fields.seller_location.success++ : fields.seller_location.fail++;
    data.seller_last_active ? fields.seller_last_active.success++ : fields.seller_last_active.fail++;
    data.description ? fields.description.success++ : fields.description.fail++;
    
    if (data.attributes && Object.keys(data.attributes).length > 0) {
      fields.attributes.success++;
      fields.attributes.avg_count += Object.keys(data.attributes).length;
    } else {
      fields.attributes.fail++;
    }
    
    if (data.components && Object.keys(data.components).length > 0) {
      fields.components.success++;
      fields.components.avg_count += Object.keys(data.components).length;
    } else {
      fields.components.fail++;
    }
    
    data.platform_reviews_count ? fields.platform_trust.success++ : fields.platform_trust.fail++;
    data.likes ? fields.likes.success++ : fields.likes.fail++;
  }
  
  static printSummary(stats) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 INTEGRATION TEST SUMMARY');
    console.log('='.repeat(80));
    
    const successRate = Math.round(stats.successful / stats.total * 100);
    console.log(`\n🎯 Overall Success Rate: ${stats.successful}/${stats.total} (${successRate}%)`);
    
    if (stats.failed > 0) {
      console.log(`⚠️  Partial/Failed: ${stats.failed}`);
    }
    
    console.log('\n📋 Field Extraction Rates:\n');
    
    const fields = stats.fields;
    const total = stats.total;
    
    console.log('   Critical Fields:');
    console.log(`   ✓ Title:            ${fields.title.success}/${total} (${Math.round(fields.title.success/total*100)}%)`);
    console.log(`   ✓ Brand:            ${fields.brand.success}/${total} (${Math.round(fields.brand.success/total*100)}%)`);
    console.log(`   ✓ Price:            ${fields.price.success}/${total} (${Math.round(fields.price.success/total*100)}%)`);
    console.log(`   ✓ Photos:           ${fields.photos.success}/${total} (${Math.round(fields.photos.success/total*100)}%) - avg ${fields.photos.avg_count || 0} per listing`);
    
    console.log('\n   Seller Information:');
    console.log(`   ✓ Name:             ${fields.seller_name.success}/${total} (${Math.round(fields.seller_name.success/total*100)}%)`);
    console.log(`   ✓ Location:         ${fields.seller_location.success}/${total} (${Math.round(fields.seller_location.success/total*100)}%)`);
    console.log(`   ✓ Last Active:      ${fields.seller_last_active.success}/${total} (${Math.round(fields.seller_last_active.success/total*100)}%)`);
    
    console.log('\n   Product Details:');
    console.log(`   ✓ Description:      ${fields.description.success}/${total} (${Math.round(fields.description.success/total*100)}%)`);
    console.log(`   ✓ Attributes:       ${fields.attributes.success}/${total} (${Math.round(fields.attributes.success/total*100)}%) - avg ${fields.attributes.avg_count || 0} per listing`);
    console.log(`   ✓ Components:       ${fields.components.success}/${total} (${Math.round(fields.components.success/total*100)}%) - avg ${fields.components.avg_count || 0} per listing`);
    
    console.log('\n   Additional:');
    console.log(`   ✓ Platform Trust:   ${fields.platform_trust.success}/${total} (${Math.round(fields.platform_trust.success/total*100)}%)`);
    console.log(`   ✓ Likes:            ${fields.likes.success}/${total} (${Math.round(fields.likes.success/total*100)}%)`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Critical Errors:');
      stats.errors.forEach((err, i) => {
        console.log(`   ${i+1}. ${err.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run test
IntegrationTester.runIntegrationTest()
  .then(() => {
    console.log('✅ Integration test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  });
