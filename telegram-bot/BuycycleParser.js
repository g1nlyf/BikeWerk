const axios = require('axios');
const cheerio = require('cheerio');

class BuycycleParser {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    static _browserPromise = null;
    static _puppeteerExtra = null;
    static _stealthAttached = false;

    async parseListing(url) {
        console.log(`ðŸ” Parsing Buycycle listing: ${url}`);
        try {
            const html = await this._fetch(url);
            const $ = cheerio.load(html);
            const candidates = [];

            // Strategy 1: Look for Product Cards via JSON-LD
            const jsonLd = $('script[type="application/ld+json"]');
            jsonLd.each((i, el) => {
                try {
                    const data = JSON.parse($(el).html());
                    if (data['@type'] === 'ItemList' && data.itemListElement) {
                        data.itemListElement.forEach(item => {
                            if (item.url) {
                                candidates.push({
                                    url: item.url,
                                    price: item.offers?.price,
                                    title: item.name
                                });
                            }
                        });
                    }
                } catch (e) {}
            });

            // Strategy 2: CSS Selectors (Fallback)
            if (candidates.length === 0) {
                // Heuristic: finding links that look like products
                $('a[href*="/product/"]').each((i, el) => {
                    const href = $(el).attr('href');
                    const fullUrl = href.startsWith('http') ? href : `https://buycycle.com${href}`;
                    const title = $(el).text().trim();
                    // Try to find price in children
                    const priceText = $(el).find('*').filter((_, c) => $(c).text().includes('â‚¬')).last().text();
                    const price = this._parsePrice(priceText);
                    
                    if (price > 0) {
                        candidates.push({
                            url: fullUrl,
                            price: price,
                            title: title
                        });
                    }
                });
            }

            console.log(`âœ… Found ${candidates.length} candidates.`);
            return candidates;

        } catch (e) {
            console.error(`âŒ Buycycle Listing Error: ${e.message}`);
            return [];
        }
    }

    async parseDetail(url) {
        console.log(`ðŸ•µï¸ Parsing Buycycle detail: ${url}`);
        try {
            const html = await this._fetch(url);
            const $ = cheerio.load(html);
            let bikeData = {};

            // Strategy 1: __NEXT_DATA__
            const nextData = $('#__NEXT_DATA__').html();
            if (nextData) {
                try {
                    const json = JSON.parse(nextData);
                    // Locate product data in props
                    // Structure varies, usually props.pageProps.product or .bike
                    const props = json.props?.pageProps || {};
                    const product = props.product || props.bike || props.data?.product;
                    
                    if (product) {
                        bikeData = this._mapNextData(product);
                        bikeData.source = 'buycycle_next_data';
                    }
                } catch (e) {
                    console.warn('Failed to parse __NEXT_DATA__', e);
                }
            }

            // Strategy 2: JSON-LD
            if (!bikeData.title) {
                $('script[type="application/ld+json"]').each((i, el) => {
                    try {
                        const data = JSON.parse($(el).html());
                        if (data['@type'] === 'Product') {
                            bikeData = {
                                ...bikeData,
                                title: data.name,
                                price: data.offers?.price,
                                description: data.description,
                                brand: data.brand?.name,
                                image: data.image
                            };
                        }
                    } catch (e) {}
                });
            }

            // Strategy 3: Visual Scraping (CSS)
            if (!bikeData.title) {
                bikeData.title = $('h1').first().text().trim();
                bikeData.price = this._parsePrice($('body').text().match(/â‚¬\s*[\d.,]+/)?.[0]);
                // ... more selectors would be needed here based on actual HTML structure
            }

            // Calibration: Map Attributes
            // Buycycle usually lists: Condition, Year, Size, Groupset
            // If we have raw attributes from NextData, we are good.
            // If not, we scrape list items.
            
            return bikeData;

        } catch (e) {
            console.error(`âŒ Buycycle Detail Error: ${e.message}`);
            return null;
        }
    }

    _mapNextData(p) {
        // Map raw Buycycle product object to our schema
        return {
            title: p.name || p.title,
            brand: p.brand?.name || p.brand,
            model: p.model?.name || p.model,
            year: p.year,
            price: p.price,
            currency: 'EUR',
            frameSize: p.size,
            condition: p.condition, // e.g. "very_good"
            description: p.description,
            images: p.images?.map(i => i.url || i) || [],
            location: p.location?.city || p.location,
            is_active: 1,
            features: {
                groupset: p.components?.groupset,
                wheels: p.components?.wheels,
                fork: p.components?.fork,
                shock: p.components?.shock,
                brakes: p.components?.brakes
            },
            raw: p // Keep raw for debugging
        };
    }

    _parsePrice(str) {
        if (!str) return 0;
        // Assume German format for de-de URL: 1.234,56 or 1.234
        // Remove non-numeric chars except . and ,
        let clean = str.replace(/[^0-9,.]/g, '');
        // Remove dots (thousands separators)
        clean = clean.replace(/\./g, '');
        // Replace comma with dot (decimal separator)
        clean = clean.replace(',', '.');
        return parseFloat(clean);
    }

    async _fetch(url) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://www.google.com/'
                },
                timeout: 15000
            });
            return response.data;
        } catch (err) {
            const status = err?.response?.status;
            // Buycycle often blocks plain HTTP clients; fall back to a real browser when needed.
            if (status === 403 || status === 429 || status === 503) {
                return await this._fetchWithPuppeteer(url);
            }
            throw err;
        }
    }

    _getPuppeteerExtra() {
        if (!BuycycleParser._puppeteerExtra) {
            // Lazy-load so this file stays lightweight in paths that never touch Buycycle.
            // eslint-disable-next-line global-require
            const puppeteerExtra = require('puppeteer-extra');
            // eslint-disable-next-line global-require
            const StealthPlugin = require('puppeteer-extra-plugin-stealth');
            BuycycleParser._puppeteerExtra = puppeteerExtra;
            if (!BuycycleParser._stealthAttached) {
                puppeteerExtra.use(StealthPlugin());
                BuycycleParser._stealthAttached = true;
            }
        }
        return BuycycleParser._puppeteerExtra;
    }

    async _getBrowser() {
        if (!BuycycleParser._browserPromise) {
            const puppeteerExtra = this._getPuppeteerExtra();
            BuycycleParser._browserPromise = puppeteerExtra.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });

            const cleanup = async () => {
                try {
                    const browser = await BuycycleParser._browserPromise;
                    await browser.close();
                } catch { }
            };
            process.once('exit', cleanup);
            process.once('SIGINT', async () => { await cleanup(); process.exit(0); });
        }
        return await BuycycleParser._browserPromise;
    }

    async _fetchWithPuppeteer(url) {
        const browser = await this._getBrowser();
        const page = await browser.newPage();
        try {
            await page.setViewport({ width: 1440, height: 900 });
            await page.setUserAgent(this.userAgent);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            return await page.content();
        } finally {
            try { await page.close(); } catch { }
        }
    }
}

module.exports = BuycycleParser;