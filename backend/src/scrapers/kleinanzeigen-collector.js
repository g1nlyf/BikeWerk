
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const path = require('path');

puppeteer.use(StealthPlugin());

class KleinanzeigenCollector {
    /**
     * Lightweight collection of listings only (for FMV)
     * @param {string} url - Full search URL
     * @param {number} limit - Max items
     * @returns {Array} - [{ title, price, url, ad_id, source_platform }]
     */
    static async collectListingsOnly(url, limit = 10) {
        console.log(`🔎 [KLEINANZEIGEN] Collecting from: ${url}`);
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Check for Captcha
            if ((await page.title()).includes('Robot')) {
                console.error('   ❌ [KLEINANZEIGEN] Blocked by Anti-Bot');
                return [];
            }

            const listings = await page.evaluate((limit) => {
                const results = [];
                const cards = document.querySelectorAll('article.aditem');
                
                for (const card of cards) {
                    if (results.length >= limit) break;

                    const titleEl = card.querySelector('.aditem-main--middle--title a') || card.querySelector('h2 a');
                    const priceEl = card.querySelector('.aditem-main--middle--price-shipping--price');
                    
                    if (!titleEl) continue;

                    const title = titleEl.innerText.trim();
                    const priceText = priceEl ? priceEl.innerText.trim() : '';
                    
                    // Filter "VB" (Verhandlungsbasis) or "Zu verschenken" if strict price needed?
                    // For FMV we want numeric prices. 
                    // "2.500 € VB" -> 2500
                    const price = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));
                    
                    if (!price || isNaN(price)) continue;

                    const partialUrl = titleEl.getAttribute('href');
                    const fullUrl = partialUrl.startsWith('http') ? partialUrl : `https://www.kleinanzeigen.de${partialUrl}`;
                    
                    // Extract ID: /.../1234567890-217-123 -> 1234567890
                    // Or data-adid attribute
                    const adId = card.getAttribute('data-adid') || partialUrl.match(/(\d+)-/)?.[1] || null;

                    if (!adId) continue;

                    results.push({
                        title: title,
                        price: price,
                        url: fullUrl,
                        ad_id: adId,
                        location: card.querySelector('.aditem-main--top--left')?.innerText.trim(),
                        source_platform: 'kleinanzeigen'
                    });
                }
                return results;
            }, limit);

            console.log(`   ✅ [KLEINANZEIGEN] Found ${listings.length} listings`);
            return listings;

        } catch (e) {
            console.error(`   ❌ [KLEINANZEIGEN] Error: ${e.message}`);
            return [];
        } finally {
            if (browser) await browser.close();
        }
    }

    static async searchBikes(term, options = {}) {
        const limit = options.limit || 5;
        console.log(`🔎 KleinanzeigenCollector: Searching for "${term}" (Limit: ${limit})...`);
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            
            const page = await browser.newPage();
            
            // Construct URL
            // Format: https://www.kleinanzeigen.de/s-fahrraeder/preis:MIN:MAX/TERM/k0c217
            // Clean term: spaces to hyphens, lowercase
            const cleanTerm = term.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
            
            let url = 'https://www.kleinanzeigen.de/s-fahrraeder';
            if (options.minPrice || options.maxPrice) {
                const min = options.minPrice || '';
                const max = options.maxPrice || '';
                url += `/preis:${min}:${max}`;
            }
            url += `/${cleanTerm}/k0c217`;
            
            console.log(`   🌐 Navigating to: ${url}`);
            
            // Set User-Agent to look real
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Navigate with timeout
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Check for Captcha/Bot block
            const title = await page.title();
            if (title.includes('Robot') || title.includes('Captcha')) {
                throw new Error('Blocked by Anti-Bot (Captcha/Robot check)');
            }
            
            // Get content
            const content = await page.content();
            const $ = cheerio.load(content);
            
            const results = [];
            
            $('.ad-listitem').each((i, el) => {
                if (results.length >= limit) return false;
                
                const $el = $(el);
                const titleText = $el.find('.text-module-begin a').text().trim() || $el.find('h2').text().trim();
                const link = $el.find('.text-module-begin a').attr('href') || $el.find('article').data('href');
                
                // Skip ads/pro (usually have specific classes, but we'll take organic first)
                if ($el.hasClass('is-topad')) {
                    // Decide if we want top ads. Usually yes.
                }
                
                if (!titleText || !link) return;
                
                // Price
                let priceText = $el.find('.aditem-main--middle--price-shipping--price').text().trim();
                if (!priceText) priceText = $el.find('p[class*="price"]').text().trim();
                
                // Image
                let imageUrl = $el.find('.imagebox').data('imgsrc');
                if (!imageUrl) imageUrl = $el.find('img').attr('src');
                
                // Description/Location
                const location = $el.find('.aditem-main--top--left').text().trim();
                const description = $el.find('.aditem-main--middle--description').text().trim();
                
                // Full URL
                const fullUrl = link.startsWith('http') ? link : `https://www.kleinanzeigen.de${link}`;
                
                // External ID
                const externalId = $el.attr('data-adid') || $el.find('article').attr('data-adid');

                // Normalize Price
                const price = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));
                
                results.push({
                    external_id: externalId,
                    title: titleText,
                    price: isNaN(price) ? 0 : price,
                    price_text: priceText,
                    url: fullUrl,
                    image: imageUrl,
                    location: location,
                    description: description,
                    source: 'kleinanzeigen'
                });
            });
            
            console.log(`   ✅ Found ${results.length} listings.`);
            return results;
            
        } catch (e) {
            console.error(`   ❌ Scraping Error: ${e.message}`);
            return [];
        } finally {
            if (browser) await browser.close();
        }
    }

    static async scrapeListing(url) {
        console.log(`🔎 KleinanzeigenCollector: Scraping detail page ${url}...`);
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            const content = await page.content();
            const $ = cheerio.load(content);

            // 🛡️ CHECK ACTIVE STATUS
            // Проверяем видимость "Reserviert/Gelöscht"
            // Note: .not('.is-hidden') might not work perfectly if class is added dynamically, but we have static HTML here.
            // However, Kleinanzeigen puts "Reserviert" in .pvap-reserved-title and usually adds .is-hidden if it's NOT reserved?
            // Actually, if it IS reserved, the badge is visible.
            // Let's check text content of the badge.
            const reservedText = $('.pvap-reserved-title').not('.is-hidden').text().trim();
            const isReserved = reservedText.includes('Reserviert');
            const isDeleted = reservedText.includes('Gelöscht') || $('body').text().includes('Diese Anzeige ist leider nicht mehr verfügbar');
            
            // Check for contact button/form
            const hasContact = $('#viewad-contact, .contactbox, [data-contact], #viewad-contact-form').length > 0;

            if (isReserved || isDeleted) {
                const status = isReserved ? 'Reserved' : 'Deleted';
                console.log(`   ⚠️ [KLEINANZEIGEN] Skipping inactive listing (${status}): ${$('#viewad-title').text().trim().substring(0, 50)}...`);
                return null;
            }

            // 🛡️ EXTRACT TITLE (Remove hidden junk)
            const $titleEl = $('#viewad-title, h1[itemprop="name"]');
            let title = '';
            
            if ($titleEl.length) {
                const $clone = $titleEl.clone();
                
                // Remove hidden elements that pollute the title
                $clone.find('.is-hidden').remove();
                $clone.find('[style*="display: none"]').remove();
                $clone.find('[style*="display:none"]').remove();
                $clone.find('.pvap-reserved-title.is-hidden').remove();
                
                title = $clone.text().trim();
                
                // Fallback cleanup regex
                title = title.replace(/^(Reserviert|Gelöscht|Verkauft)\s*[•|-]?\s*/i, '');
                title = title.replace(/\s+/g, ' ').trim();
            } else {
                // Fallback if ID changes
                title = $('meta[property="og:title"]').attr('content') || $('title').text().split('|')[0].trim();
            }
            
            // Price
            const priceText = $('#viewad-price').text().trim();
            const price = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));

            // Description
            const description = $('#viewad-description-text').text().trim();

            // Attributes
            const attributes = {};
            $('#viewad-details .addetailslist--detail').each((i, el) => {
                // Key is usually the direct text node of the li, Value is in the span
                let key = $(el).clone().children().remove().end().text().trim();
                let val = $(el).find('span').text().trim();
                
                // Fallback for different layouts
                if (!key) key = $(el).text().split(':')[0]?.trim();
                if (!val) val = $(el).text().split(':')[1]?.trim();

                if (key && val) attributes[key.replace(/:$/, '')] = val;
            });

            // Images (High Res)
            const gallery = [];
            
            // 1. Try Gallery Elements
            $('.galleryimage-element img').each((i, el) => {
                let src = $(el).attr('src') || $(el).data('src') || $(el).data('imgsrc');
                if (src) {
                    // Upgrade resolution if possible: $_2.JPG -> $_59.JPG / $_57.JPG
                    // Actually usually they are already $_59 in the carousel
                    gallery.push(src);
                }
            });

            // 2. Fallback to main image if gallery empty
            if (gallery.length === 0) {
                 const main = $('#viewad-image').attr('src') || $('#viewad-image').data('src');
                 if (main) gallery.push(main);
            }

            // Location
            const location = $('#viewad-locality').text().trim();

            return {
                title,
                price: isNaN(price) ? 0 : price,
                price_text: priceText,
                description,
                attributes,
                gallery,
                location,
                url
            };

        } catch (e) {
            console.error(`   ❌ Detail Scraping Error: ${e.message}`);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }
}

module.exports = KleinanzeigenCollector;
