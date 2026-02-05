const cheerio = require('cheerio');
const https = require('https');
const DatabaseManager = require('../database/db-manager');
const path = require('path');

const BRANDS = [
  { name: 'Santa Cruz', target: 500, priority: 1 },
  { name: 'YT', target: 400, priority: 1 },
  { name: 'Pivot', target: 300, priority: 1 },
  { name: 'Specialized', target: 800, priority: 2 },
  { name: 'Canyon', target: 800, priority: 2 },
  { name: 'Trek', target: 600, priority: 2 },
  { name: 'Cube', target: 400, priority: 3 },
  { name: 'Scott', target: 400, priority: 3 }
];

const PRICE_TIERS = [
  { min: 300, max: 800 },
  { min: 800, max: 1500 },
  { min: 1500, max: 3000 },
  { min: 3000, max: 6000 }
];

if (require.main === module) {
  (async () => {
    console.log('🌊 DATA LAKE BUILDER - START\n');
    
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    
    let totalCollected = 0;
    
    for (const brand of BRANDS.sort((a,b) => a.priority - b.priority)) {
      console.log(`\n📦 ${brand.name} (target: ${brand.target})`);
      
      // Using simple count query, assuming db-manager returns better-sqlite3 instance
      const currentCount = db.prepare(`
        SELECT COUNT(*) as count FROM market_history WHERE brand = ?
      `).get(brand.name).count;
      
      if (currentCount >= brand.target) {
        console.log(`   ✅ Already have ${currentCount} - SKIP`);
        continue;
      }
      
      const needed = brand.target - currentCount;
      let collected = 0;
      
      for (const tier of PRICE_TIERS) {
        if (collected >= needed) break;
        
        // Limit pages per tier to avoid excessive deep paging which might be blocked
        const maxPages = 3; 
        
        for (let page = 1; page <= maxPages; page++) {
          if (collected >= needed) break;
          
          const url = buildURL(brand.name, tier.min, tier.max, page);
          // console.log(`   🔎 Fetching: ${url}`);
          const items = await fetchAndParse(url);
          
          if (items.length === 0) {
              // console.log('   ⚠️ No items found on page');
              break;
          }
          
          let saved = 0;
          for (const item of items) {
            if (await saveItem(db, item)) {
              saved++;
              collected++;
              totalCollected++;
            }
          }
          
          console.log(`   €${tier.min}-${tier.max} p${page}: ${saved}/${items.length} saved`);
          await sleep(2000); // rate limit
        }
      }
      
      console.log(`   🏁 Collected for ${brand.name}: ${collected} (Total: ${currentCount + collected})`);
    }
    
    console.log(`\n🌊 DATA LAKE BUILDER - FINISHED. Total new items: ${totalCollected}`);
  })();
}

module.exports = {
  extractBrand,
  extractFrameSize,
  extractYear,
  extractModel,
  buildURL
};

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
              
              // New: Extract year and frame size
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
  // Find 4-digit year between 2010 and 2026
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
  
  // Standard sizes
  const sizePatterns = [
    { regex: /\b(XS)\b/, size: 'XS' },
    // Fix: Ensure S is not part of S-Works or surrounded by hyphens
    { regex: /(?:^|\s)(S)(?:$|\s)/, size: 'S' },      
    { regex: /\b(M)\b(?!\w)/, size: 'M' },
    { regex: /\b(L)\b(?!\w)/, size: 'L' },
    { regex: /\b(XL)\b/, size: 'XL' },
    { regex: /\b(XXL)\b/, size: 'XXL' },
    { regex: /RAHMEN\s*(XS|S|M|L|XL|XXL)/i, size: null }, // capture in group
    { regex: /GR[ÖO]ẞE\s*(XS|S|M|L|XL|XXL)/i, size: null },
    { regex: /SIZE\s*(XS|S|M|L|XL|XXL)/i, size: null }
  ];
  
  for (const pattern of sizePatterns) {
    const match = titleUpper.match(pattern.regex);
    if (match) {
      return pattern.size || match[1];
    }
  }
  
  // Numeric sizes (e.g. "17 Zoll" -> S, "19 Zoll" -> M)
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
  
  // Sort patterns by length (descending) to match longest first
  for (const [brand, patterns] of Object.entries(brands)) {
    const sortedPatterns = patterns.sort((a, b) => b.length - a.length);
    if (sortedPatterns.some(p => lower.includes(p.toLowerCase()))) return brand;
  }
  
  return null;
}

function extractModel(title, brand) {
  let clean = title.replace(new RegExp(brand, 'gi'), '');
  clean = clean.replace(/\b(mtb|fully|hardtail|mountainbike|fahrrad|bike|xl|l|m|s|xs|rahmen|frame|\d{2,4}€?|29|27\.5|26|zoll)\b/gi, '');
  clean = clean.replace(/[^\w\s-]/g, ''); // remove special chars
  const words = clean.trim().split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 3).join(' ') || 'Unknown';
}

async function saveItem(db, item) {
  try {
    const exists = db.prepare('SELECT id FROM market_history WHERE source_url = ?').get(item.url);
    if (exists) return false;
    
    db.prepare(`
      INSERT INTO market_history (
        brand, model, model_name, price, price_eur, title, 
        source_url, year, frame_size, category, source, created_at, scraped_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MTB', 'kleinanzeigen', datetime('now'), datetime('now'))
    `).run(
      item.brand, 
      item.model, 
      item.model, 
      item.price, 
      item.price, 
      item.title, 
      item.url,
      item.year,
      item.frame_size
    );
    
    return true;
  } catch (e) {
    // console.error(`   ❌ Save error: ${e.message}`);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
