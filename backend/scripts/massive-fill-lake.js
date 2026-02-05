/**
 * Скрипт: massive-fill-lake.js
 * Цель: Собрать 2000+ уникальных записей в market_history (Massive Fill Lake)
 * Стратегия: "Траулер" - сегментированный поиск по брендам, ценам и доставке.
 */

const path = require('path');
const UnifiedHunter = require('../../telegram-bot/unified-hunter.js');
const { BikesDatabase } = require('../../telegram-bot/bikes-database-node.js');
const techDecoder = require('../../backend/src/services/TechDecoder');

// --- Configuration ---
const BRANDS = [
    'Canyon', 'Specialized', 'Trek', 'Scott', 'Cube', 
    'Giant', 'Orbea', 'Santa Cruz', 'Pinarello', 'Bianchi'
];

const PRICE_RANGES = [
    { min: 500, max: 1200 },
    { min: 1200, max: 2500 },
    { min: 2500, max: 4500 },
    { min: 4500, max: '' }
];

// Shipping: true = Versand möglich (fahrraeder.versand_s:ja), false = All (Nur Abholung + Versand)
const SHIPPING_MODES = [true, false]; 

// User-Agents Pool
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
];

// Helper to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class MassiveLakeTrawler {
    constructor() {
        this.hunter = new UnifiedHunter({ logger: this.log.bind(this) });
        this.db = this.hunter.bikesDB;
        this.stats = {
            processed: 0,
            saved: 0,
            skipped: 0,
            errors: 0,
            duplicates: 0
        };
    }

    log(msg) {
        console.log(`[TRAWLER] ${msg}`);
    }

    async start() {
        this.log('🚀 Starting Massive Lake Trawler...');
        await this.db.ensureInitialized();

        for (const brand of BRANDS) {
            for (const price of PRICE_RANGES) {
                for (const shipping of SHIPPING_MODES) {
                    await this.trawlSegment(brand, price, shipping);
                    
                    // Small break between segments
                    await delay(3000); 
                }
            }
        }

        this.log('🏁 Trawling Complete!');
        this.log(JSON.stringify(this.stats, null, 2));
    }

    async trawlSegment(brand, price, shipping) {
        const priceStr = `preis:${price.min}:${price.max}`;
        const brandSlug = brand.toLowerCase().replace(/\s+/g, '-');
        const shippingSuffix = shipping ? '+fahrraeder.versand_s:ja' : '';
        
        // Kleinanzeigen pagination format: 
        // Page 1: /s-fahrraeder/preis:500:1200/canyon/k0c217+fahrraeder.versand_s:ja
        // Page 2+: /s-fahrraeder/preis:500:1200/seite:2/canyon/k0c217+fahrraeder.versand_s:ja
        
        const baseUrlPath = `/s-fahrraeder/${priceStr}`;
        const suffix = `/${brandSlug}/k0c217${shippingSuffix}`;
        
        this.log(`🔍 Segment: ${brand} | ${price.min}-${price.max}€ | ${shipping ? 'Versand' : 'All'}`);

        // Pagination: Pages 1 to 5 (Deep Scan)
        for (let page = 1; page <= 5; page++) {
            let url;
            if (page === 1) {
                url = `https://www.kleinanzeigen.de${baseUrlPath}${suffix}`;
            } else {
                // Correct format: insert /seite:N/ before brand
                url = `https://www.kleinanzeigen.de${baseUrlPath}/seite:${page}${suffix}`;
            }
            
            this.log(`  📄 Page ${page}... URL: ${url}`);

            try {
                // Random Delay
                const pause = Math.floor(Math.random() * 5000) + 2000;
                await delay(pause);

                // Fetch HTML using Hunter's parser mechanism (or custom fetch with rotation)
                // UnifiedHunter has fetchHtml but we want to rotate UA
                const html = await this.fetchHtmlRotated(url);
                
                if (!html) {
                    this.log('  ❌ Failed to fetch page. Pausing for 5 min (403 protection)...');
                    await delay(300000); // 5 min
                    continue; 
                }

                // Parse Items using Hunter's logic (need to expose parseSearchItems or replicate)
                // UnifiedHunter doesn't expose parseSearchItems directly in the class I saw earlier, 
                // but let's assume we can add it or use regex/cheerio here.
                // Since I cannot modify UnifiedHunter to expose it easily without reading it again, 
                // I'll implement a lightweight parser here based on cheerio.
                const items = this.parseItems(html);
                
                if (items.length === 0) {
                    this.log('  ⚠️ No items found on page. Moving to next segment.');
                    break; 
                }

                this.log(`  📦 Found ${items.length} items.`);

                for (const item of items) {
                    await this.processItem(item, brand);
                }

            } catch (e) {
                this.log(`  ❌ Error processing page: ${e.message}`);
                this.stats.errors++;
            }
        }
    }

    async fetchHtmlRotated(url) {
        const axios = require('axios');
        const https = require('https');
        
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            // Randomize User-Agent for each attempt
            const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            
            const headers = {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            };

            // Create a fresh agent for each attempt to avoid sticking to a bad connection/session
            const agent = new https.Agent({
                keepAlive: true,
                rejectUnauthorized: false
            });

            try {
                if (attempt > 1) {
                    this.log(`    🔄 Attempt ${attempt}/${MAX_RETRIES}...`);
                }

                const res = await axios.get(url, { 
                    headers, 
                    timeout: 15000,
                    httpsAgent: agent,
                    decompress: true,
                    // Treat 500s as errors to catch them below
                    validateStatus: status => status >= 200 && status < 300 
                });
                
                return res.data;

            } catch (e) {
                const status = e.response ? e.response.status : 'Network Error';
                const errorMsg = e.message;

                // Log the error
                if (e.response && (status === 500 || status === 502 || status === 503 || status === 504)) {
                    this.log(`    ⚠️ Server Error (${status}) on attempt ${attempt}. Reloading/Retrying...`);
                } else if (e.response && (status === 403 || status === 429)) {
                    this.log(`    🛡️ Blocked/RateLimited (${status}). Pausing 60s...`);
                    await delay(60000); 
                    // After a long pause, we can try again or just fail. 
                    // If it's the last attempt, loop will finish and return null.
                } else {
                    this.log(`    ❌ Error (${status}): ${errorMsg}`);
                }

                if (attempt === MAX_RETRIES) {
                    this.log(`    ❌ Failed to fetch after ${MAX_RETRIES} attempts.`);
                    return null;
                }

                // Wait before retry (longer for server errors)
                const waitTime = (status >= 500) ? 5000 : 3000;
                await delay(waitTime);
            }
        }
        return null;
    }

    parseItems(html) {
        if (!html || typeof html !== 'string') return [];
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const items = [];

        // Debug: Check if we are on a captcha page or empty page
        const title = $('title').text().trim();
        const bodyLen = $('body').text().length;
        
        // Kleinanzeigen list items usually have class 'ad-listitem'
        const listItems = $('.ad-listitem');
        
        if (listItems.length === 0) {
            // Check for explicit "No results"
            const bodyText = $('body').text();
            if (bodyText.includes('Keine Ergebnisse') || bodyText.includes('keine Anzeigen gefunden')) {
                this.log('    ℹ️ No more items found (End of results).');
                return []; // Empty list -> Stop segment
            }

            this.log(`    ⚠️ No items found. Page Title: "${title}". Body Length: ${bodyLen}`);
            // Check for common error texts
            if ($('h1').text().includes('Access Denied') || title.includes('Access Denied')) {
                this.log('    🛡️ Detected Access Denied page.');
            }
            return [];
        }

        listItems.each((i, el) => {
            const title = $(el).find('.text-module-begin a').text().trim();
            const link = $(el).find('.text-module-begin a').attr('href');
            const priceText = $(el).find('.aditem-main--middle--price-shipping--price').text().trim();
            const desc = $(el).find('.aditem-main--middle--description').text().trim();
            const location = $(el).find('.aditem-main--top--left').text().trim();
            const shippingText = $(el).find('.aditem-main--middle--price-shipping--shipping').text().trim();
            const date = $(el).find('.aditem-main--top--right').text().trim();
            
            // Image
            let img = $(el).find('.imagebox img').attr('src');
            if (img && img.includes('f_s.JPG')) img = img.replace('f_s.JPG', 'f_i.JPG'); // High res if possible

            if (title && link) {
                items.push({
                    title,
                    link: link.startsWith('http') ? link : `https://www.kleinanzeigen.de${link}`,
                    price: this.parsePrice(priceText),
                    description: desc,
                    location,
                    shipping: shippingText,
                    date,
                    image: img
                });
            }
        });
        return items;
    }

    parsePrice(s) {
        const t = String(s || '').replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(/,(?=\d{2}\b)/g, '.');
        const m = t.match(/(\d+(?:\.\d+)?)/);
        return m ? Math.round(parseFloat(m[1])) : 0;
    }

    async processItem(item, brand) {
        // 1. Validation (Stop Words)
        const validation = techDecoder.validateBike(item.title, item.description);
        if (!validation.isBike) {
            this.stats.skipped++;
            return;
        }

        // 2. Shipping Logic
        const isVersand = item.shipping.toLowerCase().includes('versand möglich');
        
        // 3. Save to Market History (Lake)
        try {
            // Check existence
            const existing = await this.db.query('SELECT id, price_eur FROM market_history WHERE source_url = ?', [item.link]);
            
            if (existing && existing.length > 0) {
                // Update if price changed
                if (existing[0].price_eur !== item.price) {
                    await this.db.runQuery('UPDATE market_history SET price_eur = ?, scraped_at = CURRENT_TIMESTAMP WHERE id = ?', [item.price, existing[0].id]);
                    this.log(`    📝 Updated price for ${item.title}: ${existing[0].price_eur} -> ${item.price}`);
                } else {
                    // Just update timestamp
                     await this.db.runQuery('UPDATE market_history SET scraped_at = CURRENT_TIMESTAMP WHERE id = ?', [existing[0].id]);
                }
                this.stats.duplicates++;
            } else {
                // Insert
                // We use simplified decoding for lake data
                const decoded = techDecoder.decode(item.title, item.description);
                
                await this.db.runQuery(`
                    INSERT INTO market_history 
                    (brand, model, title, price_eur, year, frame_material, wheel_size, source_url, scraped_at, shipping_option)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                `, [
                    brand, // We know the brand from the search loop!
                    decoded.model || item.title,
                    item.title,
                    item.price,
                    decoded.year,
                    decoded.material,
                    decoded.wheelSize,
                    item.link,
                    isVersand ? 'available' : 'pickup-only'
                ]);
                this.stats.saved++;
                this.log(`    💾 Saved: ${item.title} (${item.price}€)`);
            }
        } catch (e) {
            console.error('DB Error:', e);
            this.stats.errors++;
        }
        
        this.stats.processed++;
    }
}

// Run
if (require.main === module) {
    const trawler = new MassiveLakeTrawler();
    trawler.start();
}
