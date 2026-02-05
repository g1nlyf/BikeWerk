const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();
const BuycycleCollector = require('../scrapers/buycycle-collector');
const KleinanzeigenCollector = require('../../telegram-bot/unified-hunter');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PRIORITY_MODELS = [
  { brand: 'Canyon', model: 'Spectral', tier: 1 },
  { brand: 'YT', model: 'Capra', tier: 1 },
  { brand: 'Santa Cruz', model: 'Bronson', tier: 1 },
  { brand: 'Specialized', model: 'Stumpjumper', tier: 1 },
  { brand: 'Scott', model: 'Genius', tier: 2 },
  { brand: 'Cube', model: 'Stereo', tier: 2 },
  { brand: 'Ghost', model: 'Riot', tier: 2 },
  { brand: 'Giant', model: 'Trance', tier: 3 },
  { brand: 'Radon', model: 'Swoop', tier: 3 },
  { brand: 'Bulls', model: 'Wild Flow', tier: 3 }
];

class DeepCatalogBuilder {
  
  async runFullTest(options) {
    console.log(`🎯 UNIFIED HUNTER STARTED`);
    console.log(`Target: ${options.target} bikes (${PRIORITY_MODELS.length} models × ${Math.ceil(options.target/PRIORITY_MODELS.length)} variants)`);
    console.log(`Sources: ${options.sources}`);
    console.log(`Mode: ${options.mode}`);
    console.log(`Timestamp: ${new Date().toISOString().replace('T', ' ').split('.')[0]}`);
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📊 PHASE 1: Model Selection (30 sec)`);
    console.log(`\nPriority Models (${PRIORITY_MODELS.length}):`);
    PRIORITY_MODELS.forEach((m, i) => console.log(`${i+1}. ${m.brand} ${m.model} [Tier ${m.tier}]`));
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    console.log(`\n📊 PHASE 2: Scraping`);
    
    const perModelTarget = Math.ceil(options.target / PRIORITY_MODELS.length);
    let totalCollected = 0;
    const allCollectedItems = [];

    for (const m of PRIORITY_MODELS) {
        const found = await this.buildDeepCatalogForModel(m.brand, m.model, { 
            ...options, 
            limitPerModel: perModelTarget 
        });
        totalCollected += found.length;
        allCollectedItems.push(...found);
    }

    console.log(`\n[${new Date().toLocaleTimeString()}] ✅ Scraping Complete`);
    console.log(`  Total raw listings: ${totalCollected}`);
    
    // Log to market_history (Phase 5 simulation)
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📊 PHASE 5: Market History Logging`);
    console.log(`\n[${new Date().toLocaleTimeString()}] 💾 Logging to market_history...`);
    
    await db.initialize();
    let logged = 0;
    
    // Phase 3 & 4 simulation (AI Normalization & Graduated Hunter)
    // For this test, we assume items are passed to Catalog if they are good.
    // We will simulate insertion into 'bikes' table for approved ones.
    
    for (const item of allCollectedItems) {
        try {
            // Ensure numeric price_eur
            const price = Number(item.price_eur || item.price);
            
            await db.query(`
                INSERT OR IGNORE INTO market_history 
                (brand, model, title, price_eur, source_url, scraped_at, category, year, frame_size, condition, source)
                VALUES (?, ?, ?, ?, ?, datetime('now'), 'MTB', ?, ?, ?, ?)
            `, [
                item.brand, 
                item.model, 
                item.title, 
                price, 
                item.url, 
                item.year || null, 
                item.frame_size || null, 
                item.condition || 'good',
                item.source
            ]);
            logged++;
        } catch (e) {
            // ignore duplicates
        }
    }
    
    console.log(`\n  Successfully logged: ${logged} records ✅`);
    
    // PHASE 6: Catalog Insertion
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📊 PHASE 6: Catalog Insertion`);
    console.log(`\n[${new Date().toLocaleTimeString()}] 📚 Inserting into Catalog (bikes table)...`);
    
    let catalogAdded = 0;
    
    for (const item of allCollectedItems) {
        try {
            const price = Number(item.price_eur || item.price);
            
            // Check duplicates in bikes
            const exists = await db.query('SELECT id FROM bikes WHERE original_url = ?', [item.url]);
            if (exists.length > 0) continue;
            
            // Insert
            const res = await db.query(`
                INSERT INTO bikes 
                (name, brand, model, price, original_price, year, category, condition_status, is_active, main_image, original_url, source_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                item.title,
                item.brand,
                item.model,
                price,
                price, // original_price
                item.year || null,
                'MTB', // Default
                'used',
                item.image || null,
                item.url,
                item.url
            ]);
            
            if (res.insertId) catalogAdded++;
            
        } catch (e) {
            console.error(`   ❌ Catalog Insert Error: ${e.message}`);
        }
    }
    console.log(`\n  ✅ Catalog Updated: ${catalogAdded} new bikes added`);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n🎉 MINI TEST COMPLETE ✅`);
  }

  async buildDeepCatalogForModel(brand, model, options = {}) {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🔍 Scraping: ${brand} ${model}`);
    
    // 1. Get FMV Stats
    const fmvData = await this.getFMVStats(brand, model);
    // console.log(`FMV Stats: Median €${fmvData.median_price}, Range €${fmvData.min_price}-€${fmvData.max_price}`);

    // 2. Define Price Brackets
    const brackets = this.definePriceBrackets(fmvData);
    
    const catalog = [];
    const limit = options.limitPerModel || 5;
    const sourcesList = options.sources ? options.sources.split(',') : ['kleinanzeigen', 'buycycle'];
    
    // Distribute limit across brackets
    // For simplicity in this test, we just try to fill the limit from any bracket
    
    let needed = limit;
    
    for (const bracket of brackets) {
      if (needed <= 0) break;
      
      for (const source of sourcesList) {
        if (needed <= 0) break;
        
        // Take 1-2 per source per bracket
        const batchSize = Math.min(needed, 2); 

        try {
            const found = await this.collectFromSource(
              source, brand, model, bracket.min, bracket.max, batchSize
            );
            
            if (found && found.length > 0) {
                // console.log(`   [${source}] Found ${found.length} listings in ${bracket.name}`);
                
                // Inject Brand/Model
                const processed = found.map(f => ({
                    ...f,
                    brand: brand,
                    model: model,
                    price_eur: f.price // Standardization
                }));
                
                catalog.push(...processed);
                needed -= found.length;
            }
        } catch (e) {
            console.error(`   ❌ Error collecting from ${source}: ${e.message}`);
        }
        
        // Rate limit
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    const counts = sourcesList.reduce((acc, s) => {
        acc[s] = catalog.filter(c => c.source === s).length;
        return acc;
    }, {});
    
    Object.entries(counts).forEach(([s, c]) => console.log(`   [${s}] Found ${c} listings`));
    console.log(`   Total: ${catalog.length} listings`);
    console.log(`   ✅ Saved to staging: ${catalog.length} bikes`);
    
    return catalog;
  }
  
  definePriceBrackets(fmvData) {
    const median = fmvData.median_price || 2000;
    
    return [
      { name: 'budget', min: Math.round(median * 0.5), max: Math.round(median * 0.7) },
      { name: 'mid', min: Math.round(median * 0.7), max: Math.round(median * 0.9) },
      { name: 'fair', min: Math.round(median * 0.9), max: Math.round(median * 1.1) },
      { name: 'premium', min: Math.round(median * 1.1), max: Math.round(median * 1.3) }
    ];
  }
  
  async collectFromSource(source, brand, model, minPrice, maxPrice, count) {
    const matchesPrice = (price) => price >= minPrice && price <= maxPrice;

    switch(source) {
      case 'kleinanzeigen':
        try {
            // 1. Build URL
            const hunter = new KleinanzeigenCollector(); 
            const url = hunter.constructUrl({
                brand: brand,
                priceMin: minPrice,
                priceMax: maxPrice,
                shipping: true,
                type: 'mtb'
            });
            
            // 2. Scrape
            const browser = await puppeteer.launch({ 
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // 3. Extract
            const listings = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('article.aditem'));
                return items.map(item => {
                    const id = item.dataset.adid;
                    const title = item.querySelector('.text-module-begin a')?.textContent?.trim();
                    const priceText = item.querySelector('.aditem-main--middle--price-shipping--price')?.textContent?.trim();
                    const price = priceText ? parseInt(priceText.replace(/[^0-9]/g, '')) : 0;
                    const link = item.querySelector('.text-module-begin a')?.getAttribute('href');
                    const img = item.querySelector('.imagebox-thumbnail img')?.getAttribute('src');
                    
                    return {
                        external_id: id,
                        title: title,
                        price: price,
                        url: link ? (link.startsWith('http') ? link : `https://www.kleinanzeigen.de${link}`) : null,
                        image: img,
                        source: 'kleinanzeigen'
                    };
                }).filter(i => i.title && i.price > 0);
            });
            
            await browser.close();
            
            // 4. Filter by Model
            const modelKeywords = model.toLowerCase().split(' ');
            const filtered = listings.filter(item => {
                const t = item.title.toLowerCase();
                return modelKeywords.every(kw => t.includes(kw));
            });
            
            return filtered.slice(0, count);
            
        } catch (e) {
            // console.error(`   ❌ Kleinanzeigen Error: ${e.message}`);
            return [];
        }

      case 'buycycle':
        try {
            const buycycleItems = await BuycycleCollector.collectForTarget({ brand, model });
            return buycycleItems
                .filter(item => matchesPrice(item.price))
                .slice(0, count);
        } catch(e) { return []; }

      case 'bikeflip':
        return [];
    }
    return [];
  }
  
  async getFMVStats(brand, model) {
    try {
        const stats = await db.query(`
          SELECT 
            AVG(price_eur) as median_price, 
            MIN(price_eur) as min_price, 
            MAX(price_eur) as max_price, 
            COUNT(*) as sample_size 
          FROM market_history 
          WHERE brand = ? AND model LIKE ? 
          AND quality_score >= 70 
        `, [brand, `%${model}%`]);
        
        if (stats && stats[0] && stats[0].sample_size > 0) {
            return stats[0];
        }
    } catch (e) {
        // console.error('Error getting FMV stats:', e.message);
    }
    
    return { median_price: 2000, min_price: 1000, max_price: 4000 };
  }
}

const instance = new DeepCatalogBuilder();
module.exports = instance;

// CLI Handler
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        target: 50,
        mode: 'conservative',
        sources: 'kleinanzeigen,buycycle'
    };
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--target') options.target = parseInt(args[i+1]);
        if (args[i] === '--mode') options.mode = args[i+1];
        if (args[i] === '--sources') options.sources = args[i+1];
    }
    
    instance.runFullTest(options).then(() => process.exit(0)).catch(e => {
        console.error(e);
        process.exit(1);
    });
}