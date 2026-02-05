const cheerio = require('cheerio');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const DatabaseManager = require('../database/db-manager');
const BuycycleURLBuilder = require('../services/buycycle-url-builder');

const PROXY_URL = 'http://user258350:otuspk@191.101.73.161:8984';

(async () => {
  console.log('🚲 BUYCYCLE DATA LAKE BUILDER - START\n');
  
  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();
  const urlBuilder = new BuycycleURLBuilder();
  
  // Define targets (Tier C logic - broad collection)
  const targets = urlBuilder.generatePriceTierURLs();
  
  let totalCollected = 0;
  
  for (const target of targets) {
    console.log(`\n📦 ${target.brand} (€${target.minPrice}-${target.maxPrice})`);
    
    // Check if we need more data for this segment?
    // For now, just run through them.
    
    const url = target.url;
    console.log(`   🔎 Fetching: ${url}`);
    
    const items = await fetchAndParse(url);
    
    if (items.length === 0) {
        console.log('   ⚠️ No items found or blocked');
    } else {
        let saved = 0;
        for (const item of items) {
          if (saveItem(db, item)) {
            saved++;
            totalCollected++;
          }
        }
        console.log(`   ✅ Saved: ${saved}/${items.length}`);
    }
    
    await sleep(3500); // 3.5s rate limit (Buycycle is strict)
  }
  
  console.log(`\n🌊 BUYCYCLE BUILDER - FINISHED. Total new items: ${totalCollected}`);
  dbManager.close();
})();

async function fetchAndParse(url) {
  return new Promise((resolve) => {
    const agent = new HttpsProxyAgent(PROXY_URL);
    
    https.get(url, { 
        agent: agent,
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://buycycle.com/de-de',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
    } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
            // 1. Try JSON Extraction (__NEXT_DATA__)
            const jsonMatch = data.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
            if (jsonMatch) {
                const json = JSON.parse(jsonMatch[1]);
                const items = extractFromNextData(json);
                if (items.length > 0) {
                    // console.log(`   ✨ Extracted ${items.length} items from JSON`);
                    resolve(items);
                    return;
                }
            }

            // 2. Fallback to Cheerio
            const $ = cheerio.load(data);
            const items = [];
            
            // Try common selectors for product cards
            $('a[href*="/bike/"]').each((i, el) => {
                const $el = $(el);
                const href = $el.attr('href');
                if (!href) return;
                
                const title = $el.find('h3, h2, .title').text().trim();
                const priceText = $el.find('[class*="price"]').text().trim();
                const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
                
                // Try to find specs
                const specs = $el.text(); // quick dirty way
                const yearMatch = specs.match(/\b(20[1-2][0-9])\b/);
                const year = yearMatch ? parseInt(yearMatch[1]) : null;
                
                // Size is harder without specific selectors, but let's try
                // Buycycle usually puts size in a specific tag
                const sizeMatch = specs.match(/\b(XS|S|M|L|XL|XXL)\b/);
                const frameSize = sizeMatch ? sizeMatch[1] : null;

                if (title && price > 0) {
                    items.push({
                        brand: extractBrandFromTitle(title),
                        model: extractModelFromTitle(title),
                        title,
                        price,
                        year,
                        frame_size: frameSize,
                        url: href.startsWith('http') ? href : `https://buycycle.com${href}`,
                        source: 'buycycle'
                    });
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

function extractFromNextData(json) {
    const items = [];
    
    // Recursive search for objects with 'price', 'brand', 'model'
    function traverse(obj) {
        if (!obj || typeof obj !== 'object') return;
        
        if (obj.price && obj.brand && obj.model && (obj.slug || obj.url)) {
            // Found a bike!
            items.push({
                brand: obj.brand.name || obj.brand,
                model: obj.model.name || obj.model,
                title: `${obj.brand.name || obj.brand} ${obj.model.name || obj.model} ${obj.year || ''}`,
                price: typeof obj.price === 'object' ? (obj.price.amount || 0) : obj.price,
                year: obj.year,
                frame_size: obj.frame_size || obj.size,
                frame_material: obj.frame_material || obj.material,
                url: obj.url || `https://buycycle.com/de-de/bike/${obj.slug}`,
                source: 'buycycle'
            });
            return;
        }
        
        for (const key in obj) {
            traverse(obj[key]);
        }
    }
    
    // Optimisation: Look in specific paths if known, otherwise full traversal
    // props.pageProps.initialState...
    if (json.props?.pageProps) {
        traverse(json.props.pageProps);
    } else {
        traverse(json);
    }
    
    // Dedup by URL
    const unique = new Map();
    items.forEach(i => unique.set(i.url, i));
    return Array.from(unique.values());
}

function extractBrandFromTitle(title) {
    // Reuse logic from fill-data-lake.js or simple fallback
    const parts = title.split(' ');
    return parts[0];
}

function extractModelFromTitle(title) {
    const parts = title.split(' ');
    return parts.slice(1, 3).join(' ');
}

function saveItem(db, item) {
  try {
    const exists = db.prepare('SELECT id FROM market_history WHERE source_url = ?').get(item.url);
    if (exists) return false;
    
    // Clean data
    const price = parseInt(item.price);
    if (!price || price < 100) return false;
    
    db.prepare(`
      INSERT INTO market_history (
        brand, model, price, price_eur, title, 
        source_url, year, frame_size, frame_material, category, source, created_at, scraped_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MTB', 'buycycle', datetime('now'), datetime('now'))
    `).run(
      item.brand, 
      item.model, 
      price, 
      price, 
      item.title, 
      item.url,
      item.year || null,
      item.frame_size || null,
      item.frame_material || null
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
