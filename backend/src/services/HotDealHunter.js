/**
 * HotDealHunter - Hunts for hot deals from Buycycle high-demand section
 * Runs hourly, checks 5 newest bikes, processes through full pipeline
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const DatabaseManager = require('../../database/db-manager');
const UnifiedNormalizer = require('./UnifiedNormalizer');
const UnifiedBikeMapper = require('../mappers/unified-bike-mapper');
const DatabaseService = require('../../services/database-service-v2');

puppeteer.use(StealthPlugin());

class HotDealHunter {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.dbService = new DatabaseService();
        // Buycycle High Demand URLs
        this.HOT_URLS = [
            'https://buycycle.com/de-de/shop/main-types/bikes/bike-types/mountainbike/min-price/500/sort-by/new/high-demand/1'
        ];

        // Whitelist of premium brands to focus on
        this.ALLOWED_BRANDS = [
            'Specialized', 'Canyon', 'Santa Cruz', 'Trek', 'Cannondale',
            'Scott', 'Cube', 'Orbea', 'Giant', 'Yeti', 'Pivot', 'Propain',
            'Commencal', 'Radon', 'YT', 'Bianchi', 'Pinarello', 'Colnago',
            'Rose', 'Focus', 'BMC', 'S-Works', 'Status', 'Jeffsy', 'Capra',
            'Tyee', 'Spectral', 'Norco', 'Kona', 'Nukeproof', 'Transition'
        ];
    }

    /**
     * Main hunt method - called by HourlyHunter
     * @param {number} limit Max hot deals to process per run (default 5)
     */
    async hunt(limit = 5) {
        console.log('\n🔥 STARTING HOT DEAL HUNT 🔥');
        console.log(`   Limit: ${limit} bikes | Source: Buycycle High Demand\n`);

        const stats = { found: 0, processed: 0, added: 0, duplicates: 0, errors: 0 };

        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

            // Accept cookies if banner appears
            await this.acceptCookies(page);

            for (const url of this.HOT_URLS) {
                console.log(`   ➡️ Scanning: ${url}`);

                // 1. Navigate with retry
                try {
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                } catch (e) {
                    console.error(`   ❌ Navigation failed: ${e.message}`);
                    // Retry once
                    try {
                        await new Promise(r => setTimeout(r, 5000));
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    } catch (e2) {
                        console.error(`   ❌ Retry failed: ${e2.message}`);
                        continue;
                    }
                }

                // 2. Extract Listings
                const listings = await this.extractListingsFromPage(page);
                console.log(`   📊 Found ${listings.length} raw listings`);
                stats.found += listings.length;

                // 3. Filter by whitelist and process top N
                let processedCount = 0;

                for (const candidate of listings) {
                    if (processedCount >= limit) break;

                    // A. Check Whitelist
                    const brand = this.extractBrand(candidate);
                    const isWhitelisted = this.ALLOWED_BRANDS.some(b =>
                        brand.toLowerCase().includes(b.toLowerCase())
                    );

                    if (!isWhitelisted) {
                        continue;
                    }

                    // B. Deduplication Check
                    const isDuplicate = await this.checkDuplicate(candidate.url);
                    if (isDuplicate) {
                        stats.duplicates++;
                        continue;
                    }

                    console.log(`   🔥 Processing: ${candidate.title} (€${candidate.price})`);
                    stats.processed++;

                    // C. Deep Analysis & Save
                    try {
                        const success = await this.processHotCandidate(browser, candidate);
                        if (success) {
                            processedCount++;
                            stats.added++;
                        } else {
                            stats.errors++;
                        }
                    } catch (e) {
                        console.error(`      ❌ Error: ${e.message}`);
                        stats.errors++;
                    }

                    // Rate limiting
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            console.log(`\n✅ Hot Deal Hunt Complete`);
            console.log(`   Found: ${stats.found} | Processed: ${stats.processed}`);
            console.log(`   Added: ${stats.added} | Duplicates: ${stats.duplicates} | Errors: ${stats.errors}\n`);

            return stats;

        } catch (e) {
            console.error(`❌ Hot Deal Hunter Critical Error: ${e.message}`);
            console.error(e.stack);
            return stats;
        } finally {
            if (browser) await browser.close();
        }
    }

    /**
     * Extract brand from candidate
     */
    extractBrand(candidate) {
        if (candidate.brand) return candidate.brand;
        if (candidate.title) {
            // Try to extract first word as brand
            const parts = candidate.title.split(' ');
            return parts[0] || 'Unknown';
        }
        return 'Unknown';
    }

    /**
     * Check if bike URL already exists in DB
     */
    async checkDuplicate(url) {
        try {
            const db = this.dbManager.getDatabase();

            // Check bikes table
            const bike = db.prepare('SELECT id FROM bikes WHERE source_url = ? LIMIT 1').get(url);
            if (bike) return true;

            // Check failed_bikes table if it exists
            try {
                const failed = db.prepare('SELECT id FROM failed_bikes WHERE url = ? LIMIT 1').get(url);
                if (failed) return true;
            } catch (e) {
                // Table might not exist, ignore
            }

            return false;
        } catch (e) {
            console.error(`   ⚠️ Duplicate check error: ${e.message}`);
            return false;
        }
    }

    /**
     * Accept cookie consent banner if present
     */
    async acceptCookies(page) {
        try {
            // Wait for cookie banner to appear
            await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, [id*="accept"], button[class*="accept"]', { timeout: 5000 });

            // Click accept button
            await page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
            console.log('   🍪 Accepted cookies');

            // Wait for banner to disappear
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            // No cookie banner or already accepted
        }
    }

    /**
     * Extract listings from Buycycle page
     */
    async extractListingsFromPage(page) {
        // Wait for content to load
        await new Promise(r => setTimeout(r, 2000));

        // Try __NEXT_DATA__ first (most reliable)
        try {
            const nextData = await page.evaluate(() => {
                const script = document.getElementById('__NEXT_DATA__');
                return script ? JSON.parse(script.textContent) : null;
            });

            if (nextData) {
                const items = [];
                const traverse = (obj) => {
                    if (!obj || typeof obj !== 'object') return;
                    if (obj.price && obj.brand && obj.model && (obj.slug || obj.url)) {
                        items.push({
                            title: `${obj.brand.name || obj.brand} ${obj.model.name || obj.model} ${obj.year || ''}`.trim(),
                            brand: obj.brand.name || obj.brand,
                            model: obj.model.name || obj.model,
                            price: typeof obj.price === 'object' ? (obj.price.amount || 0) : obj.price,
                            year: obj.year,
                            frame_size: obj.frame_size || obj.size,
                            url: obj.url || `https://buycycle.com/de-de/product/${obj.slug}`,
                            image: obj.image || (obj.images ? obj.images[0] : null),
                            images: obj.images || (obj.image ? [obj.image] : []),
                            source: 'buycycle',
                            external_id: obj.id || obj.slug
                        });
                        return;
                    }
                    Object.values(obj).forEach(traverse);
                };

                if (nextData.props?.pageProps) traverse(nextData.props.pageProps);
                else traverse(nextData);

                // Deduplicate
                const unique = [];
                const seen = new Set();
                for (const item of items) {
                    if (!seen.has(item.url)) {
                        seen.add(item.url);
                        unique.push(item);
                    }
                }

                if (unique.length > 0) {
                    return unique;
                }
            }
        } catch (e) {
            console.log(`   ⚠️ __NEXT_DATA__ extraction failed: ${e.message}`);
        }

        // Fallback: DOM Scraping using data-cnstrc-* attributes
        console.log('   📝 Using DOM scraping with Constructor.io data attributes...');
        return await page.evaluate(() => {
            const results = [];

            // Find all product cards with Constructor.io data attributes
            const productCards = document.querySelectorAll('[data-cnstrc-item-id]');

            for (const card of productCards) {
                try {
                    // Extract from data attributes (most reliable)
                    const itemId = card.getAttribute('data-cnstrc-item-id');
                    const itemName = card.getAttribute('data-cnstrc-item-name');
                    const itemPrice = card.getAttribute('data-cnstrc-item-price');

                    const price = parseInt(itemPrice) || 0;
                    const title = itemName || '';

                    // Get URL from link inside card
                    const link = card.querySelector('a[href*="/product/"]');
                    const href = link?.getAttribute('href') || '';
                    const url = href.startsWith('http') ? href : `https://buycycle.com${href}`;

                    // Skip invalid entries
                    if (!title || price < 500 || results.some(r => r.url === url)) {
                        continue;
                    }

                    // Extract brand from title (first word usually)
                    const cleanTitle = title.replace(/Stark gefragt\d*/gi, '').replace(/sehr gefragt/gi, '').trim();
                    const brand = cleanTitle.split(/[\s-]/)[0] || 'Unknown';

                    // Try to extract year from title
                    const yearMatch = cleanTitle.match(/\b(20\d{2})\b/);
                    const year = yearMatch ? parseInt(yearMatch[1]) : null;

                    // Get images
                    const imgEl = card.querySelector('img');
                    const image = imgEl?.src || imgEl?.getAttribute('data-src');

                    results.push({
                        title: cleanTitle,
                        brand,
                        model: cleanTitle.replace(brand, '').replace(/\d{4}$/, '').trim(),
                        price,
                        year,
                        url,
                        image,
                        images: image ? [image] : [],
                        source: 'buycycle',
                        external_id: itemId || href
                    });
                } catch (e) {
                    // Skip this item
                }
            }

            // If no data attributes found, try traditional DOM scraping
            if (results.length === 0) {
                const productLinks = document.querySelectorAll('a[href*="/product/"]');
                for (const link of productLinks) {
                    const href = link.getAttribute('href');
                    const url = href?.startsWith('http') ? href : `https://buycycle.com${href}`;

                    // Extract from URL slug as fallback
                    const slug = href?.split('/').pop() || '';
                    const title = slug.replace(/-/g, ' ').replace(/\d+$/, '').trim();
                    const brand = title.split(/[\s-]/)[0] || 'Unknown';

                    if (title && title.length > 3 && !results.some(r => r.url === url)) {
                        results.push({
                            title,
                            brand,
                            price: 0, // Unknown price
                            url,
                            source: 'buycycle',
                            external_id: href
                        });
                    }
                }
            }

            return results.slice(0, 30);
        });
    }

    /**
     * Process a single hot candidate through full pipeline
     */
    async processHotCandidate(browser, candidate) {
        let page = null;
        try {
            page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            // Scrape detailed info
            const details = await this.scrapeListingDetails(page);

            // Merge candidate + details
            const rawBike = {
                ...candidate,
                ...details,
                brand: details.brand || candidate.brand || 'Unknown',
                model: details.model || candidate.model || 'Unknown',
                external_id: candidate.external_id || this.extractExternalId(candidate.url),
                url: candidate.url,
                source: 'buycycle'
            };

            console.log(`      🤖 Normalizing with AI...`);

            // Normalize through UnifiedNormalizer (includes Gemini AI)
            const normalized = await UnifiedNormalizer.normalize(rawBike, 'buycycle');

            // Quality Gate
            if (!normalized || !normalized.quality_score || normalized.quality_score < 40) {
                console.log(`      ⚠️ Low Quality (${normalized?.quality_score || 0}). Skipping.`);
                return false;
            }

            // Inject Hot Deal Flags
            normalized.ranking = normalized.ranking || {};
            normalized.ranking.is_hot_offer = true;
            normalized.ranking.ranking_score = Math.max(normalized.ranking.ranking_score || 0.7, 0.80);
            normalized.ranking.hotness_score = 0.9;
            normalized.ranking.priority = 'high';

            normalized.meta = normalized.meta || {};
            normalized.meta.source_platform = 'buycycle';
            normalized.meta.source_url = candidate.url;
            normalized.meta.is_high_demand = true;

            normalized.internal = normalized.internal || {};
            normalized.internal.tags = normalized.internal.tags || [];
            normalized.internal.tags.push('hot_deal');
            normalized.internal.tags.push('buycycle_high_demand');

            // Save to database
            console.log(`      💾 Saving to database...`);
            if (!normalized) {
                console.log(`      ⚠️ Normalization failed, skipping save.`);
                return false;
            }

            const saveResult = await this.dbService.saveBikesToDB([normalized], { skipPhotoDownload: false });

            if (saveResult.inserted > 0) {
                const savedId = saveResult.results[0]?.id;
                console.log(`      ✅ Saved: ${normalized.basic_info?.name || 'Unknown'} (ID: ${savedId || 'unknown'})`);

                // Log event
                this.logHunterEvent('HOT_DEAL_ADDED', {
                    bike_id: savedId,
                    title: normalized.basic_info?.name,
                    price: normalized.pricing?.price,
                    quality_score: normalized.quality_score
                });

                return true;
            } else {
                console.log(`      ⚠️ Save failed: ${saveResult.results[0]?.reason || 'Unknown'}`);
                return false;
            }

        } catch (e) {
            console.error(`      ❌ Error: ${e.message}`);
            return false;
        } finally {
            if (page) await page.close();
        }
    }

    /**
     * Scrape detailed listing info from bike page
     */
    async scrapeListingDetails(page) {
        return page.evaluate(() => {
            const details = {};
            const clean = (t) => t ? t.trim().replace(/\s+/g, ' ') : '';

            // JSON-LD extraction
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const s of scripts) {
                try {
                    const data = JSON.parse(s.textContent);
                    const product = Array.isArray(data) ? data.find(i => i['@type'] === 'Product') : (data['@type'] === 'Product' ? data : null);

                    if (product) {
                        details.title = product.name;
                        details.brand = product.brand?.name || product.brand;
                        details.description = product.description;
                        details.images = Array.isArray(product.image) ? product.image : [product.image];

                        if (product.offers) {
                            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                            details.price = parseFloat(offer.price);
                            details.currency = offer.priceCurrency;
                        }
                    }
                } catch (e) { }
            }

            // DOM fallback for components
            const headings = Array.from(document.querySelectorAll('h2, div.text-xl'));
            const detailsHeader = headings.find(h =>
                h.textContent.includes('Fahrraddetails') || h.textContent.includes('Bike details')
            );

            if (detailsHeader) {
                let container = detailsHeader.nextElementSibling;
                while (container && (container.tagName === 'HR' || container.textContent.trim().length === 0)) {
                    container = container.nextElementSibling;
                }
                if (container) {
                    details.components = details.components || {};
                    details.components.raw_text = clean(container.textContent);
                }
            }

            // Images
            const domImages = Array.from(document.querySelectorAll('img[src*="/uploads/"], img[src*="cloudfront"]'))
                .map(img => img.src)
                .filter(src => src && src.length > 20 && !src.includes('avatar') && !src.includes('logo'));

            details.images = [...new Set([...(details.images || []), ...domImages])];

            // Description
            const descEl = document.querySelector('.overflow-hidden.mt-2.text-contentPrimary');
            if (descEl) {
                details.description = clean(descEl.textContent);
            }

            // Seller info
            details.seller = {};
            const sellerNameEl = document.querySelector('.font-medium.text-lg.text-contentPrimary');
            if (sellerNameEl) {
                details.seller.name = clean(sellerNameEl.textContent).replace(/^(Verkauft von|Sold by)\s*/i, '');
            }

            return details;
        });
    }

    /**
     * Extract external ID from URL
     */
    extractExternalId(url) {
        try {
            const parsed = new URL(url);
            const parts = parsed.pathname.split('/').filter(Boolean);
            return parts[parts.length - 1] || url;
        } catch (e) {
            return url || null;
        }
    }

    /**
     * Log hunter event to database
     */
    logHunterEvent(type, details) {
        try {
            const db = this.dbManager.getDatabase();
            db.prepare(`
                INSERT INTO hunter_events (type, source, details, created_at)
                VALUES (?, ?, ?, datetime('now'))
            `).run(type, 'HotDealHunter', JSON.stringify(details));
        } catch (e) {
            console.error(`   ⚠️ Failed to log event: ${e.message}`);
        }
    }
}

// Export singleton instance
module.exports = new HotDealHunter();
