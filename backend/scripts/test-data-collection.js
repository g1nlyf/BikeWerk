const cheerio = require('cheerio');
const DatabaseManager = require('../database/db-manager');

class SmartURLBuilder {
  buildSearchURL(config) {
    const {
      brand,
      model = null,
      category,
      minPrice = 500,
      maxPrice = null,
      location = 'global',
      shippingRequired = true,
      page = 1
    } = config;
    
    let url = 'https://www.kleinanzeigen.de/s-fahrraeder/';
    
    // Geography
    if (location === 'marburg') {
      url += 'marburg/';
    }
    
    // Price BEFORE brand/model
    if (minPrice || maxPrice) {
      url += `preis:${minPrice || 500}:${maxPrice || ''}/`;
    }
    
    // Brand + Model
    const searchQuery = model 
      ? `${brand}-${model}`.toLowerCase().replace(/\s+/g, '-')
      : brand.toLowerCase().replace(/\s+/g, '-');
    
    url += `${searchQuery}/`;
    
    // Page
    if (page > 1) {
      url += `seite:${page}/`;
    }
    
    // Category code
    if (location === 'marburg') {
      url += 'k0c217l4825r100';
    } else {
      url += 'k0c217';
    }
    
    // Bike type mapping
    const typeMap = {
      'MTB': 'mountainbike',
      'DH': 'mountainbike',
      'Enduro': 'mountainbike',
      'Trail': 'mountainbike',
      'Road': 'rennrad',
      'Gravel': 'rennrad',
      'eMTB': 'elektrofahrrad'
    };
    
    url += `+fahrraeder.type_s:${typeMap[category] || 'mountainbike'}`;
    
    // Shipping
    if (shippingRequired) {
      url += '+fahrraeder.versand_s:ja';
    }
    
    return url;
  }
}

class DataCollectionTester {
  constructor() {
    this.dbManager = new DatabaseManager();
    this.urlBuilder = new SmartURLBuilder();
  }
  
  /**
   * Тест на 3 байках с детальным логированием
   */
  async runTest() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   🧪 DATA COLLECTION TEST - Detailed Analysis       ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    // Тестовые цели
    const testTargets = [
      {
        brand: 'YT',
        model: 'Capra',
        category: 'Enduro',
        minPrice: 2000,
        maxPrice: 4000
      },
      {
        brand: 'Specialized',
        model: 'Demo',
        category: 'DH',
        minPrice: 2500,
        maxPrice: 6000
      },
      {
        brand: 'Santa Cruz',
        model: 'Bronson',
        category: 'Trail',
        minPrice: 1500,
        maxPrice: 3500
      }
    ];
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const target of testTargets) {
      console.log('\n' + '═'.repeat(60));
      console.log(`🎯 Testing: ${target.brand} ${target.model} (${target.category})`);
      console.log('═'.repeat(60) + '\n');
      
      try {
        // STEP 1: Построить URL
        const url = this.urlBuilder.buildSearchURL(target);
        console.log('STEP 1: URL Construction');
        console.log(`  URL: ${url}\n`);
        
        // STEP 2: Fetch страницы
        console.log('STEP 2: Fetching page...');
        const html = await this.fetchPage(url);
        console.log(`  ✅ Page loaded (${(html.length / 1024).toFixed(1)} KB)\n`);
        
        // STEP 3: Parse listings
        console.log('STEP 3: Parsing listings...');
        const listings = await this.parseListings(html);
        console.log(`  ✅ Found ${listings.length} listings\n`);

        // ✨ NEW: STEP 3.5 - Apply Funnel Filter
        console.log('STEP 3.5: Applying Funnel Filter...');
        const filtered = this.applyFunnelFilter(listings);
        console.log(`  ✅ ${filtered.length} passed filter (${listings.length - filtered.length} blocked)\n`);
        
        if (filtered.length === 0) {
          console.log('  ⚠️  No listings passed filter. Skipping.\n');
          continue;
        }
        
        // STEP 4: Детальный анализ первого лота
        console.log('STEP 4: Detailed Analysis (First Listing):\n');
        
        const firstListing = filtered[0];
        
        console.log('  Raw Data:');
        console.log(`    Title:       "${firstListing.title}"`);
        console.log(`    Price:       ${firstListing.price}`);
        console.log(`    URL:         ${firstListing.url}`);
        console.log(`    Description: ${firstListing.description?.substring(0, 100)}...\n`);
        
        // STEP 5: Извлечение структурированных данных
        console.log('  Extracted Data:');
        
        const extracted = this.extractData(firstListing, target);
        
        console.log(`    Brand:           ${extracted.brand || '❌ MISSING'}`);
        console.log(`    Model:           ${extracted.model || '❌ MISSING'}`);
        console.log(`    Year:            ${extracted.year || '❌ MISSING'}`);
        console.log(`    Frame Size:      ${extracted.frame_size || '❌ MISSING'}`);
        console.log(`    Frame Material:  ${extracted.frame_material || '❌ MISSING'}`);
        console.log(`    Category:        ${extracted.category}`);
        console.log(`    Price:           €${extracted.price}\n`);
        
        // STEP 6: Качество данных
        console.log('  Data Quality Check:');
        
        const quality = this.assessQuality(extracted);
        
        console.log(`    Brand:     ${quality.brand ? '✅' : '❌'}`);
        console.log(`    Model:     ${quality.model ? '✅' : '❌'}`);
        console.log(`    Year:      ${quality.year ? '✅' : '⚠️  Optional'}`);
        console.log(`    Size:      ${quality.frame_size ? '✅' : '⚠️  Optional'}`);
        console.log(`    Price:     ${quality.price ? '✅' : '❌'}`);
        console.log(`    Overall:   ${quality.score}/5\n`);
        
        if (quality.score >= 3) {
          console.log('  ✅ PASS: Data quality acceptable\n');
          totalPassed++;
          
          // STEP 7: Test DB save
          console.log('  STEP 7: Test Save to DB...');
          await this.testSave(extracted);
          console.log('  ✅ Save successful\n');
          
        } else {
          console.log('  ❌ FAIL: Data quality too low\n');
          totalFailed++;
        }
        
      } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}\n`);
        totalFailed++;
      }
    }
    
    // Final report
    console.log('\n' + '═'.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(60) + '\n');
    console.log(`Total targets tested:  ${testTargets.length}`);
    console.log(`Passed:                ${totalPassed} ✅`);
    console.log(`Failed:                ${totalFailed} ❌\n`);
    
    if (totalFailed === 0) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log('✅ System ready for mass collection.\n');
      console.log('Next step:');
      console.log('  node backend/scripts/mass-data-collection.js\n');
    } else {
      console.log('⚠️  Some tests failed. Review extraction logic.\n');
    }
  }
  
  applyFunnelFilter(listings) {
    const filtered = [];
    
    const stopWords = [
      'defekt', 'kaputt', 'broken', 'damaged',
      'rahmen', 'frame only', 'frameset',
      'laufrad', 'laufradsatz', 'wheelset',
      'gabel', 'fork',
      'dämpfer', 'shock',
      'sattel', 'saddle',
      'lenker', 'handlebar',
      'pedale', 'pedals',
      'bremse', 'brake',
      'schaltung', 'derailleur',
      'kette', 'chain',
      'suche', 'tausche' // Also block "search" and "swap" ads
    ];
    
    for (const listing of listings) {
      const titleLower = listing.title.toLowerCase();
      
      // Проверка стоп-слов
      let blocked = false;
      for (const word of stopWords) {
        if (titleLower.includes(word)) {
          blocked = true;
          break;
        }
      }
      
      if (!blocked) {
        filtered.push(listing);
      }
    }
    
    return filtered;
  }

  async fetchPage(url) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.text();
  }
  
  async parseListings(html) {
    const $ = cheerio.load(html);
    const listings = [];
    
    $('.aditem, article[data-adid]').each((i, el) => {
      const $el = $(el);
      
      const title = $el.find('.ellipsis, h2, .text-module_component, [class*="title"]')
        .first()
        .text()
        .trim();
      
      const priceText = $el.find('.aditem-main--middle--price-shipping--price, [class*="price"]')
        .first()
        .text()
        .trim();
      
      const price = this.parsePrice(priceText);
      
      const relativeUrl = $el.find('a').first().attr('href');
      const url = relativeUrl ? `https://www.kleinanzeigen.de${relativeUrl}` : null;
      
      if (title && price && url) {
        listings.push({
          title,
          price,
          url,
          description: $el.find('.aditem-main--middle--description').text().trim()
        });
      }
    });
    
    return listings;
  }
  
  parsePrice(text) {
    if (!text) return null;
    
    // Split by space to handle multiple prices (e.g. "2.700 € 2.800 €")
    // Usually the first one is the current price or the second one is old price?
    // Kleinanzeigen HTML structure might contain both in the same text node if we are not careful.
    // But usually Cheerio .text() concatenates.
    
    // Clean up non-digits except space
    const cleaned = text.replace(/[^\d\s]/g, '').trim();
    
    // Split by whitespace
    const parts = cleaned.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length === 0) return null;
    
    // Take the first number found (usually the main price)
    // Or check logic: sometimes first is old price? 
    // In Kleinanzeigen list view, usually price is standalone. 
    // If multiple numbers, it might be a parsing issue.
    // Let's take the first valid number that looks like a price (>50)
    
    for (const part of parts) {
        const price = parseInt(part);
        if (price > 50 && price < 100000) {
            return price;
        }
    }
    
    return null;
  }
  
  extractData(listing, target) {
    const title = listing.title;
    const description = listing.description || '';
    
    return {
      brand: this.extractBrand(title) || target.brand,
      model: this.extractModel(title, target.brand),
      year: this.extractYear(title, description),
      frame_size: this.extractFrameSize(title, description),
      frame_material: this.extractMaterial(title, description),
      category: target.category,
      price: listing.price,
      source: 'kleinanzeigen',
      source_url: listing.url,
      title: title,
      description: description
    };
  }
  
  extractBrand(title) {
    const brands = [
      'Santa Cruz', 'YT', 'Specialized', 'Canyon', 'Trek',
      'Giant', 'Scott', 'Cube', 'Pivot', 'Transition',
      'Evil', 'Yeti', 'Mondraker', 'Commencal', 'Propain',
      'Rose', 'Norco', 'Kona', 'GT', 'Cannondale'
    ];
    
    // Sort by length (longest first) для точности
    brands.sort((a, b) => b.length - a.length);
    
    const titleLower = title.toLowerCase();
    
    for (const brand of brands) {
      if (titleLower.includes(brand.toLowerCase())) {
        return brand;
      }
    }
    
    return null;
  }
  
  extractModel(title, brand) {
    if (!brand) return null;
    
    // Убрать бренд из заголовка
    const withoutBrand = title.replace(new RegExp(brand, 'gi'), '').trim();
    
    // Взять первые 2-3 слова после бренда
    const words = withoutBrand.split(/\s+/).filter(w => w.length > 2);
    
    return words.slice(0, 2).join(' ') || null;
  }
  
  extractYear(title, description = '') {
    // Попробовать title
    const yearPattern = /\b(20\d{2}|19\d{2})\b/;
    let match = title.match(yearPattern);
    
    if (!match && description) {
      // Попробовать description
      // "Baujahr: 2019" или "Year: 2019"
      const descPatterns = [
        /Baujahr:\s*(\d{4})/i,
        /Jahr:\s*(\d{4})/i,
        /Year:\s*(\d{4})/i,
        /Model:\s*(\d{4})/i,
        /\b(20\d{2})\b/
      ];
      
      for (const pattern of descPatterns) {
        match = description.match(pattern);
        if (match) break;
      }
    }
    
    if (match) {
      const year = parseInt(match[1] || match[0]);
      if (year >= 2010 && year <= 2026) {
        return year;
      }
    }
    
    return null;
  }
  
  extractFrameSize(title, description = '') {
    // Попробовать title
    const sizePatterns = [
      /\b(XXS|XS|S|M|L|XL|XXL)\b/i,
      /Größe\s*:?\s*(XXS|XS|S|M|L|XL|XXL)/i,
      /Rahmengröße\s*:?\s*(XXS|XS|S|M|L|XL|XXL)/i,
      /Rahmen\s*:?\s*(XXS|XS|S|M|L|XL|XXL)/i,
      /Gr\.\s*(XXS|XS|S|M|L|XL|XXL)/i,
      /\b(S[1-6])\b/i, // Specialized S-sizing
      /\b(\d{2})\s*Zoll\b/i
    ];
    
    for (const pattern of sizePatterns) {
      let match = title.match(pattern);
      if (match) {
        return this.normalizeSize(match[1]);
      }
    }
    
    if (description) {
      // Попробовать description
      // "Rahmengröße: L" или "Frame size: L"
      const descPatterns = [
        /Rahmengröße:\s*(XXS|XS|S|M|L|XL|XXL)/i,
        /Rahmen:\s*(XXS|XS|S|M|L|XL|XXL)/i,
        /Frame size:\s*(XXS|XS|S|M|L|XL|XXL)/i,
        /Size:\s*(XXS|XS|S|M|L|XL|XXL)/i,
        /\b(XXS|XS|S|M|L|XL|XXL)\b/i,
        /\b(S[1-6])\b/i // Specialized S-sizing in desc
      ];
      
      for (const pattern of descPatterns) {
        const match = description.match(pattern);
        if (match) {
          return this.normalizeSize(match[1]);
        }
      }
    }
    
    return null;
  }
  
  normalizeSize(rawSize) {
    let size = rawSize.toUpperCase();
    
    // Specialized S-sizing mapping
    const sMapping = {
      'S1': 'XS',
      'S2': 'S',
      'S3': 'M',
      'S4': 'L',
      'S5': 'XL',
      'S6': 'XXL'
    };
    
    if (sMapping[size]) {
      return sMapping[size];
    }
    
    // Convert Zoll to size
    if (!isNaN(size)) {
      const inches = parseInt(size);
      if (inches <= 15) return 'S';
      if (inches <= 17) return 'M';
      if (inches <= 19) return 'L';
      return 'XL';
    }
    
    return size;
  }
  
  extractMaterial(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('carbon') || text.includes('cf')) {
      return 'carbon';
    }
    if (text.includes('alu') || text.includes('aluminum')) {
      return 'aluminum';
    }
    if (text.includes('steel') || text.includes('stahl')) {
      return 'steel';
    }
    if (text.includes('titan')) {
      return 'titanium';
    }
    
    return null;
  }
  
  assessQuality(data) {
    const checks = {
      brand: !!data.brand,
      model: !!data.model && data.model.length > 2,
      year: !!data.year,
      frame_size: !!data.frame_size,
      price: data.price > 100 && data.price < 15000
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    
    return { ...checks, score };
  }
  
  async testSave(data) {
    const db = this.dbManager.getDatabase();
    
    // Test insert (with IGNORE to prevent duplicates)
    db.prepare(`
      INSERT OR IGNORE INTO market_history (
        brand, model, year, frame_size, frame_material,
        category, price_eur, source, source_url, title, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      data.brand,
      data.model,
      data.year,
      data.frame_size,
      data.frame_material,
      data.category,
      data.price,
      data.source,
      data.source_url,
      data.title
    );
  }
}

// Run test
if (require.main === module) {
  const tester = new DataCollectionTester();
  tester.runTest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  DataCollectionTester,
  SmartURLBuilder
};
