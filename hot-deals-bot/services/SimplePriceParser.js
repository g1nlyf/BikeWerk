/**
 * SimplePriceParser - Lightweight parser for extracting price and title
 * Bypasses full Hunter logic for speed and simplicity
 */
const cheerio = require('cheerio');
const axios = require('axios'); // We might need to install axios if not present, or use fetch

// Headers to mimic a browser
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8'
};

class SimplePriceParser {

    async parse(url) {
        try {
            console.log(`🔍 Simple Parsing: ${url}`);

            // Determine platform
            let platform = 'unknown';
            if (url.includes('kleinanzeigen')) platform = 'kleinanzeigen';
            else if (url.includes('buycycle')) platform = 'buycycle';
            else if (url.includes('mobile.de')) platform = 'mobile.de';
            else if (url.includes('autoscout24')) platform = 'autoscout24';

            // Fetch HTML
            // Note: For Kleinanzeigen we might need puppeteer if they block axios, 
            // but let's try simple fetch first or use existing preprocessors logic

            // Re-using existing preprocessors logic might be safer as they handle specific parsing
            // But we need to bypass the "Hunter" pipeline overhead

            if (platform === 'kleinanzeigen') {
                return await this.parseKleinanzeigen(url);
            } else if (platform === 'buycycle') {
                return await this.parseBuycycle(url);
            } else {
                return await this.parseGeneric(url);
            }

        } catch (error) {
            console.error('Error in SimplePriceParser:', error.message);
            return { title: 'Unknown Bike', price: 0, error: error.message };
        }
    }

    async parseKleinanzeigen(url) {
        // We can reuse the existing KleinanzeigenPreprocessor logic but need to fetch HTML first.
        // Since we want to avoid Puppeteer overhead if possible, let's try axios.
        // IF axios fails (403), we fall back to puppeteer (which is already installed).

        try {
            const response = await axios.get(url, { headers: HEADERS });
            const html = response.data;
            const $ = cheerio.load(html);

            const title = $('#viewad-title').text().trim() || $('h1').first().text().trim();
            let priceText = $('#viewad-price').text().trim() || $('h2').filter((i, el) => $(el).text().includes('€')).text().trim();

            const price = this.normalizePrice(priceText);

            return {
                title: title || 'Kleinanzeigen Bike',
                price: price || 0,
                currency: 'EUR'
            };
        } catch (error) {
            console.log('⚠️ Axios failed, trying Puppeteer for Kleinanzeigen...');
            return await this.parseWithPuppeteer(url, 'kleinanzeigen');
        }
    }

    async parseBuycycle(url) {
        try {
            const response = await axios.get(url, { headers: HEADERS });
            const html = response.data;
            const $ = cheerio.load(html);

            const title = $('h1').first().text().trim();
            // Buycycle usually puts price in specific classes
            let priceText = $('[class*="price"]').first().text().trim();

            if (!priceText) {
                // Try looking for json-ld
                const script = $('script[type="application/ld+json"]').html();
                if (script) {
                    try {
                        const json = JSON.parse(script);
                        if (json.offers && json.offers.price) {
                            return {
                                title: json.name || title,
                                price: parseFloat(json.offers.price),
                                currency: json.offers.priceCurrency || 'EUR'
                            };
                        }
                    } catch (e) { }
                }
            }

            const price = this.normalizePrice(priceText);

            return {
                title: title || 'Buycycle Bike',
                price: price || 0,
                currency: 'EUR'
            };
        } catch (error) {
            console.log('⚠️ Axios failed, trying Puppeteer for Buycycle...');
            return await this.parseWithPuppeteer(url, 'buycycle');
        }
    }

    async parseGeneric(url) {
        return await this.parseWithPuppeteer(url, 'generic');
    }

    async parseWithPuppeteer(url, platform) {
        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());

        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'] // Optimize for low resource
            });

            const page = await browser.newPage();
            // Block images/fonts to speed up
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            const data = await page.evaluate(() => {
                const title = document.querySelector('h1')?.innerText?.trim();

                // Try to find price
                let price = null;
                const priceRegex = /[\d.,]+\s*€/i;

                // Heuristic: look for element with "price" class or containing "€"
                const priceEl = document.querySelector('[class*="price"], [id*="price"]');
                if (priceEl) {
                    price = priceEl.innerText;
                } else {
                    // Search in text nodes
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    while (walker.nextNode()) {
                        if (priceRegex.test(walker.currentNode.nodeValue) && walker.currentNode.parentNode.tagName !== 'SCRIPT') {
                            price = walker.currentNode.nodeValue.match(priceRegex)[0];
                            break;
                        }
                    }
                }

                return { title, price };
            });

            await browser.close();

            const price = this.normalizePrice(data.price);

            return {
                title: data.title || 'Unknown Bike',
                price: price || 0,
                currency: 'EUR'
            };

        } catch (error) {
            if (browser) await browser.close();
            console.error('Puppeteer error:', error.message);
            return { title: 'Error Scraping', price: 0, error: error.message };
        }
    }

    normalizePrice(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;

        let str = String(value).trim();
        // Remove chars except digits, dots, commas
        str = str.replace(/[^\d.,]/g, '');

        if (!str) return 0;

        // Detect format
        // Case 1: 1.299,00 (German standard) -> 1299.00
        if (str.includes('.') && str.includes(',')) {
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                // German: 1.200,50
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                // US: 1,200.50
                str = str.replace(/,/g, '');
            }
        }
        // Case 2: 1,299.00 (US standard or just comma separator)
        else if (str.includes(',')) {
            // If comma is used, check if it's likely a decimal or separator
            if (str.indexOf(',') === str.length - 3) {
                // 1200,50 -> 1200.50 (decimal)
                str = str.replace(',', '.');
            } else {
                // 1,200 -> 1200 (separator)
                str = str.replace(/,/g, '');
            }
        }
        // Case 3: 1.299 (German thousands, no decimal) or 1.299 (Small decimal)
        else if (str.includes('.')) {
            const parts = str.split('.');
            if (parts.length > 2) {
                // Multiple dots -> definitely thousands separator (1.200.000)
                str = str.replace(/\./g, '');
            } else {
                // Single dot. 
                // If 3 digits exactly after dot, assume thousands separator for prices 
                // (Context: Bikes are expensive, usually > 100 EUR).
                // 1.299 -> 1299
                // 12.99 -> 12.99
                if (parts[1].length === 3) {
                    str = str.replace('.', '');
                }
            }
        }

        return parseFloat(str) || 0;
    }
}

module.exports = new SimplePriceParser();
