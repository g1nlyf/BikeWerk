
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { DatabaseManager } = require('../js/mysql-config');
const BuycycleCollector = require('../../scrapers/buycycle-collector');
const BikeflipCollector = require('../scrapers/BikeflipCollector'); // Import new collector
const KleinanzeigenCollector = require('../scrapers/kleinanzeigen-collector'); // Import new collector

puppeteer.use(StealthPlugin());

class FMVCollector {
    constructor() {
        this.db = new DatabaseManager();
    }

    /**
     * Collects listings for a specific target and saves directly to DB
     * @param {Object} target - { brand, model, year, url, source: 'buycycle'|'bikeflip'|'kleinanzeigen' }
     * @param {number} limit - Max items to collect
     * @returns {Object} { collected: number, duplicates: number, errors: number }
     */
    async collect(target, limit = 50) {
        // Ensure DB is initialized
        if (!this.db.db) {
            await this.db.initialize();
        }

        console.log(`🔎 [FMV] Collecting (${target.source || 'buycycle'}): ${target.brand} ${target.model} ${target.year}`);
        console.log(`   🌐 URL: ${target.url}`);

        if (target.source === 'bikeflip') {
            return this.collectBikeflip(target, limit);
        } else if (target.source === 'kleinanzeigen') {
            return this.collectKleinanzeigen(target, limit);
        } else {
            return this.collectBuycycle(target, limit);
        }
    }

    async collectKleinanzeigen(target, limit) {
        const stats = { collected: 0, duplicates: 0, errors: 0 };
        let pageNum = 1;
        let consecutiveEmptyPages = 0;

        try {
            while (stats.collected < limit && consecutiveEmptyPages < 2) {
                // Construct Page URL
                let pageUrl = target.url;
                if (pageNum > 1) {
                    // Inject seite:N. target.url is like ".../s-fahrraeder/preis:..."
                    // We want ".../s-fahrraeder/seite:2/preis:..."
                    pageUrl = target.url.replace('/s-fahrraeder/', `/s-fahrraeder/seite:${pageNum}/`);
                }

                console.log(`   📄 [Kleinanzeigen] Processing Page ${pageNum}: ${pageUrl}`);
                
                const listings = await KleinanzeigenCollector.collectListingsOnly(pageUrl, limit - stats.collected);
                
                if (listings.length === 0) {
                    consecutiveEmptyPages++;
                    pageNum++;
                    continue;
                }
                consecutiveEmptyPages = 0;

                let pageDuplicates = 0;

                for (const item of listings) {
                    if (stats.collected >= limit) break;

                    const record = {
                        source_platform: 'kleinanzeigen',
                        source_url: item.url,
                        source_ad_id: item.ad_id,
                        brand: target.brand,
                        model: target.model,
                        year: target.year,
                        price_eur: item.price,
                        currency: 'EUR',
                        frame_size: null, 
                        condition_status: null,
                        title: item.title,
                        image_url: null
                    };

                    const saved = await this.saveToMarketHistory(record);
                    if (saved) stats.collected++;
                    else {
                        stats.duplicates++;
                        pageDuplicates++;
                    }
                }
                
                if (listings.length > 0 && pageDuplicates === listings.length) {
                    console.log(`   🛑 Stopping: All ${listings.length} items on page ${pageNum} are duplicates (Infinite Loop Protection).`);
                    break;
                }

                pageNum++;
                // Small delay between pages
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch (e) {
            console.error(`   ❌ Kleinanzeigen Collection Error: ${e.message}`);
            stats.errors++;
        }
        console.log(`   ✅ Result (Kleinanzeigen): ${stats.collected} saved, ${stats.duplicates} duplicates`);
        return stats;
    }

    async collectBikeflip(target, limit) {
        const stats = { collected: 0, duplicates: 0, errors: 0 };
        let pageNum = 1;
        let consecutiveEmptyPages = 0;

        try {
            while (stats.collected < limit && consecutiveEmptyPages < 2) {
                // BikeFlip URL usually has query params. Append &page=N
                // Also ensure per_page=27 as per user recommendation
                const pageUrl = `${target.url}&page=${pageNum}&per_page=27`;
                console.log(`   📄 [BikeFlip] Processing Page ${pageNum}: ${pageUrl}`);

                // We ask for 'limit' but we might get less per page. 
                // We should ask for enough to fill the gap, but collectFromUrl limit is max items to return.
                // It usually returns ~20 items per page max anyway.
                const listings = await BikeflipCollector.collectFromUrl(pageUrl, 24); // 24 is typical page size
                
                if (listings.length === 0) {
                    consecutiveEmptyPages++;
                    pageNum++;
                    continue;
                }
                consecutiveEmptyPages = 0;
                
                let pageDuplicates = 0;

                for (const item of listings) {
                    if (stats.collected >= limit) break;

                    // Enforce Year
                    const finalYear = target.year;

                    const record = {
                        source_platform: 'bikeflip',
                        source_url: item.url,
                        source_ad_id: item.ad_id,
                        brand: target.brand,
                        model: target.model,
                        year: finalYear,
                        price_eur: item.price,
                        currency: 'EUR',
                        frame_size: null, 
                        condition_status: null,
                        title: item.title,
                        image_url: null 
                    };

                    const saved = await this.saveToMarketHistory(record);
                    if (saved) stats.collected++;
                    else {
                        stats.duplicates++;
                        pageDuplicates++;
                    }
                }
                
                if (listings.length > 0 && pageDuplicates === listings.length) {
                    console.log(`   🛑 Stopping: All ${listings.length} items on page ${pageNum} are duplicates (Infinite Loop Protection).`);
                    break;
                }
                
                pageNum++;
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch (e) {
            console.error(`   ❌ BikeFlip Collection Error: ${e.message}`);
            stats.errors++;
        }
        console.log(`   ✅ Result (BikeFlip): ${stats.collected} saved, ${stats.duplicates} duplicates`);
        return stats;
    }

    async collectBuycycle(target, limit) {
        let browser = null;
        const stats = { collected: 0, duplicates: 0, errors: 0 };
        let pageNum = 1;
        let consecutiveEmptyPages = 0;

        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });

            while (stats.collected < limit && consecutiveEmptyPages < 2) {
                // Buycycle pagination: /page/N
                // Remove trailing slash if exists
                let baseUrl = target.url.endsWith('/') ? target.url.slice(0, -1) : target.url;
                
                // If page > 1, append /page/N
                const pageUrl = pageNum > 1 ? `${baseUrl}/page/${pageNum}` : `${baseUrl}?page=1`;
                
                console.log(`   📄 [Buycycle] Processing Page ${pageNum}: ${pageUrl}`);

                // Navigate
                try {
                    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                } catch (navErr) {
                    console.warn(`   ⚠️ Navigation timeout, trying to proceed with DOM content...`);
                }

                // Use existing BuycycleCollector to parse the grid
                const listings = await BuycycleCollector.extractListingsFromPage(page);
                console.log(`   📊 Found ${listings.length} raw listings`);

                if (listings.length === 0) {
                    consecutiveEmptyPages++;
                    pageNum++;
                    continue;
                }
                consecutiveEmptyPages = 0;

                let pageDuplicates = 0;
                let validItemsOnPage = 0;
                
                // Use a local set to track seen IDs in this session to detect loops even if DB is empty
                const sessionSeenIds = new Set();

                // Process and Save
                for (const item of listings) {
                    if (stats.collected >= limit) break;

                    // 1. Basic Filters
                    if (!item.price || item.price < 100) continue; 
                    if (item.title.toLowerCase().includes('frameset')) continue; 
                    if (item.title.toLowerCase().includes('rahmen')) continue;

                    validItemsOnPage++;

                    // 2. Enforce Year (Context Trust)
                    const finalYear = target.year;

                    // 3. Prepare DB Record
                    const record = {
                        source_platform: 'buycycle',
                        source_url: item.url,
                        source_ad_id: item.external_id || this.extractIdFromUrl(item.url),
                        brand: target.brand,
                        model: target.model,
                        year: finalYear,
                        price_eur: item.price,
                        currency: 'EUR', 
                        frame_size: item.frame_size || null,
                        condition_status: null, 
                        title: item.title,
                        image_url: item.image || (item.images ? item.images[0] : null)
                    };

                    // Check session duplicates (Infinite Loop Protection Level 1)
                    if (sessionSeenIds.has(record.source_ad_id)) {
                        pageDuplicates++;
                        continue;
                    }
                    sessionSeenIds.add(record.source_ad_id);

                    // 4. Save (Upsert/Skip)
                    const saved = await this.saveToMarketHistory(record);
                    if (saved) stats.collected++;
                    else {
                        stats.duplicates++;
                        pageDuplicates++;
                    }
                }
                
                if (validItemsOnPage > 0 && pageDuplicates === validItemsOnPage) {
                    console.log(`   🛑 Stopping: All ${validItemsOnPage} valid items on page ${pageNum} are duplicates (Infinite Loop Protection).`);
                    break;
                }
                
                pageNum++;
                await new Promise(r => setTimeout(r, 2000));
            }

        } catch (e) {
            console.error(`   ❌ Collection Error: ${e.message}`);
            stats.errors++;
        } finally {
            if (browser) await browser.close();
        }

        console.log(`   ✅ Result: ${stats.collected} saved, ${stats.duplicates} duplicates`);
        return stats;
    }

    async saveToMarketHistory(record) {
        try {
            // Check existence
            const existing = await this.db.query(
                'SELECT id FROM market_history WHERE source_platform = ? AND source_ad_id = ?',
                [record.source_platform, record.source_ad_id]
            );

            if (existing && existing.length > 0) {
                return false; // Duplicate
            }

            // Insert
            await this.db.query(`
                INSERT INTO market_history (
                    source_platform, source_url, source_ad_id,
                    brand, model, year,
                    price_eur, title, frame_size,
                    created_at, scraped_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                record.source_platform,
                record.source_url,
                record.source_ad_id,
                record.brand,
                record.model,
                record.year,
                record.price_eur,
                record.title,
                record.frame_size
            ]);

            return true;
        } catch (e) {
            console.error(`   ⚠️ DB Save Error: ${e.message}`);
            return false;
        }
    }

    extractIdFromUrl(url) {
        try {
            const parts = url.split('/');
            return parts[parts.length - 1];
        } catch (e) {
            return null;
        }
    }
}

module.exports = new FMVCollector();
