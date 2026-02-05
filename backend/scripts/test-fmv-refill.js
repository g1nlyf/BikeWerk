const cheerio = require('cheerio');
const https = require('https');
const DatabaseManager = require('../database/db-manager');
const path = require('path');

// Re-using the same brands and tiers, but we will break early
const BRANDS = [
  { name: 'Santa Cruz', target: 500, priority: 1 },
  { name: 'Specialized', target: 800, priority: 2 },
  { name: 'Canyon', target: 800, priority: 2 },
  { name: 'Trek', target: 600, priority: 2 },
  { name: 'YT', target: 400, priority: 1 },
];

const PRICE_TIERS = [
  { min: 800, max: 1500 },
  { min: 1500, max: 3000 },
  { min: 3000, max: 6000 }
];

const TARGET_COUNT = 10;

if (require.main === module) {
  (async () => {
    console.log('🧪 TEST FMV REFILL (Target: 10 items) - START\n');
    
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    
    let totalCollected = 0;
    
    // Create market_history table if not exists (just in case)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS market_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT,
        model TEXT,
        model_name TEXT,
        price REAL,
        price_eur REAL,
        title TEXT,
        source_url TEXT UNIQUE,
        year INTEGER,
        frame_size TEXT,
        category TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scraped_at DATETIME
      )
    `).run();

    outerLoop:
    for (const brand of BRANDS) {
      console.log(`\n📦 Searching for: ${brand.name}`);
      
      for (const tier of PRICE_TIERS) {
        if (totalCollected >= TARGET_COUNT) break outerLoop;
        
        // Try page 1 only for test speed
        const page = 1;
        const url = buildURL(brand.name, tier.min, tier.max, page);
        console.log(`   🔎 Fetching Tier €${tier.min}-${tier.max}: ${url}`);
        
        const items = await fetchAndParse(url);
        
        if (items.length === 0) {
            console.log('   ⚠️ No items found on page');
            continue;
        }
        
        console.log(`   Found ${items.length} items raw. Processing...`);

        for (const item of items) {
          if (totalCollected >= TARGET_COUNT) break outerLoop;

          // Save item
          if (await saveItem(db, item)) {
            totalCollected++;
            console.log(`\n✅ [${totalCollected}/${TARGET_COUNT}] SAVED RECORD:`);
            console.log(`   - Title:      ${item.title}`);
            console.log(`   - Brand:      ${item.brand}`);
            console.log(`   - Model:      ${item.model}`);
            console.log(`   - Year:       ${item.year || 'N/A'}`);
            console.log(`   - Frame Size: ${item.frame_size || 'N/A'}`);
            console.log(`   - Price:      €${item.price}`);
          } else {
             // console.log(`   Skipped (Duplicate or Error): ${item.title.substring(0, 30)}...`);
          }
        }
        
        await sleep(1000); // polite delay
      }
    }
    
    console.log(`\n🎉 TEST FINISHED. Total new items: ${totalCollected}`);
  })();
}

// --- Helper Functions (Copied from fill-data-lake.js) ---

function buildURL(brand, min, max, page) {
    const slug = brand.toLowerCase().replace(/\s+/g, '-');
    return `https://www.kleinanzeigen.de/s-fahrraeder/preis:${min}:${max}/${slug}/k0c217+fahrraeder.type_s:mountainbike?seite=${page}`;
}

async function fetchAndParse(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const $ = cheerio.load(data);
          const items = [];
          
          $('.aditem, .ad-listitem, article.aditem').each((i, el) => {
            const $el = $(el);
            const titleEl = $el.find('.text-module-begin > a');
            const title = titleEl.text().trim() || $el.find('h2').text().trim();
            
            const priceText = $el.find('.aditem-main--middle--price-shipping--price').text().trim() || $el.find('.aditem-main--middle--price').text().trim();
            const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
            
            let href = titleEl.attr('href') || $el.data('href') || $el.find('a[href*="/s-anzeige/"]').attr('href');
            
            if (title && price > 0 && href) {
              const fullUrl = href.startsWith('http') ? href : `https://www.kleinanzeigen.de${href}`;
              
              const brand = extractBrand(title);
              const model = brand ? extractModel(title, brand) : null;
              
              const year = extractYear(title);
              const frameSize = extractFrameSize(title);
              
              if (brand && model) {
                items.push({
                  brand,
                  model,
                  title,
                  price,
                  year,
                  frame_size: frameSize,
                  url: fullUrl
                });
              }
            }
          });
          
          resolve(items);
        } catch (e) {
          console.error(`   ❌ Parse error: ${e.message}`);
          resolve([]);
        }
      });
    }).on('error', (e) => {
        console.error(`   ❌ Request error: ${e.message}`);
        resolve([]);
    });
  });
}

function extractYear(title) {
  const yearMatch = title.match(/\b(20[1-2][0-9])\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2010 && year <= 2026) {
      return year;
    }
  }
  return null;
}

function extractFrameSize(title) {
  const titleUpper = title.toUpperCase();
  const sizePatterns = [
    { regex: /\b(XS)\b/, size: 'XS' },
    { regex: /(?:^|\s)(S)(?:$|\s)/, size: 'S' },      
    { regex: /\b(M)\b(?!\w)/, size: 'M' },
    { regex: /\b(L)\b(?!\w)/, size: 'L' },
    { regex: /\b(XL)\b/, size: 'XL' },
    { regex: /\b(XXL)\b/, size: 'XXL' },
    { regex: /RAHMEN\s*(XS|S|M|L|XL|XXL)/i, size: null }, 
    { regex: /GR[ÖO]ẞE\s*(XS|S|M|L|XL|XXL)/i, size: null },
    { regex: /SIZE\s*(XS|S|M|L|XL|XXL)/i, size: null }
  ];
  
  for (const pattern of sizePatterns) {
    const match = titleUpper.match(pattern.regex);
    if (match) {
      return pattern.size || match[1];
    }
  }
  
  const numericMatch = title.match(/\b(1[5-9]|2[0-3])\s*(zoll|"|'')/i);
  if (numericMatch) {
    const inches = parseInt(numericMatch[1]);
    if (inches <= 16) return 'S';
    if (inches <= 18) return 'M';
    if (inches <= 20) return 'L';
    return 'XL';
  }
  return null;
}

function extractBrand(title) {
  const brands = {
    'Santa Cruz': ['santa cruz', 'santa-cruz', 'santacruz', 'sc bikes'],
    'YT': ['yt industries', 'yt-industries', 'yt ', ' yt', 'yt,'],
    'Specialized': ['specialized', 's-works', 'sworks'],
    'Canyon': ['canyon'],
    'Pivot': ['pivot'],
    'Trek': ['trek'],
    'Giant': ['giant'],
    'Scott': ['scott'],
    'Cube': ['cube'],
    'Propain': ['propain'],
    'Rose': ['rose', 'rosebikes'],
    'Commencal': ['commencal'],
    'Transition': ['transition'],
    'Evil': ['evil bikes', 'evil'],
    'Intense': ['intense'],
    'Yeti': ['yeti cycles', 'yeti']
  };
  
  const lower = title.toLowerCase();
  for (const [brand, patterns] of Object.entries(brands)) {
    const sortedPatterns = patterns.sort((a, b) => b.length - a.length);
    if (sortedPatterns.some(p => lower.includes(p.toLowerCase()))) return brand;
  }
  return null;
}

function extractModel(title, brand) {
  let clean = title.replace(new RegExp(brand, 'gi'), '');
  clean = clean.replace(/\b(mtb|fully|hardtail|mountainbike|fahrrad|bike|xl|l|m|s|xs|rahmen|frame|\d{2,4}€?|29|27\.5|26|zoll)\b/gi, '');
  clean = clean.replace(/[^\w\s-]/g, ''); 
  const words = clean.trim().split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 3).join(' ') || 'Unknown';
}

async function saveItem(db, item) {
  try {
    const exists = db.prepare('SELECT id FROM market_history WHERE source_url = ?').get(item.url);
    if (exists) return false;
    
    db.prepare(`
      INSERT INTO market_history (
        brand, model, model_name, price_eur, title, 
        source_url, year, frame_size, category, source, created_at, scraped_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MTB', 'kleinanzeigen', datetime('now'), datetime('now'))
    `).run(
      item.brand, 
      item.model, 
      item.model, 
      item.price, 
      item.title, 
      item.url,
      item.year,
      item.frame_size
    );
    
    return true;
  } catch (e) {
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}