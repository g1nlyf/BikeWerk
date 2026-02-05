const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
    const url = 'https://buycycle.com/de-de/product/reign-1-2019-58146';
    console.log(`Testing URL: ${url}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        console.log('Navigating...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Run the EXACT logic from BuycycleCollector.js (scrapeListingDetails)
        // I'm pasting the function body here to see what it currently returns
        const result = await page.evaluate(() => {
            const details = {};
            const clean = (t) => t ? t.trim().replace(/\s+/g, ' ') : '';

            // STRATEGY: JSON-LD (Schema.org) - Priority 1
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
                } catch (e) {}
            }

            // Fallback: DOM Extraction for Richer Data
            const headings = Array.from(document.querySelectorAll('h2, div.text-xl'));

            // 3. Verkäuferbeschreibung (Full Text)
            const descHeader = headings.find(h => h.textContent.includes('Verkäuferbeschreibung') || h.textContent.includes('Seller description'));
            if (descHeader) {
                const wrapper = descHeader.closest('.mt-8') || descHeader.parentElement;
                if (wrapper) {
                    const contentClone = wrapper.cloneNode(true);
                    const headerInClone = contentClone.querySelector('.text-xl');
                    if (headerInClone) headerInClone.remove();
                    const buttons = contentClone.querySelectorAll('button');
                    buttons.forEach(b => b.remove());
                    
                    const fullText = clean(contentClone.textContent);
                    if (fullText.length > (details.description?.length || 0)) {
                        details.description = fullText;
                    }
                }
            }

            // 5. Next.js App Router Data Extraction (self.__next_f)
            const nextFData = window.self?.__next_f;
            if (nextFData && Array.isArray(nextFData)) {
                try {
                    const stream = nextFData.map(item => item[1]).join('');
                    const descMatch = stream.match(/"description":\{"key":"[^"]+","value":"(.*?)"/);
                    if (descMatch && descMatch[1]) {
                         const rawDesc = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                         if (rawDesc.length > (details.description?.length || 0)) {
                             details.description = rawDesc;
                         }
                    }
                } catch(e) {}
            }

            return details;
        });

        console.log('------------------------------------------------');
        console.log('CURRENT PARSER RESULT:');
        console.log(JSON.stringify(result, null, 2));
        console.log('------------------------------------------------');

        // Test User's Selectors
        const selectorCheck = await page.evaluate(() => {
            const res = {};
            
            // Description
            const descEl = document.querySelector('.overflow-hidden.mt-2.text-contentPrimary.font-regular.text-base');
            res.description_selector = descEl ? descEl.textContent.trim() : 'NOT FOUND';

            // Seller Name
            const nameEl = document.querySelector('.font-medium.text-lg.text-contentPrimary.whitespace-nowrap.text-ellipsis.overflow-hidden');
            res.seller_name_selector = nameEl ? nameEl.textContent.trim() : 'NOT FOUND';

            // Seller Location & Active Debug
            const metaEls = Array.from(document.querySelectorAll('.font-regular.text-sm.text-contentTertiary.mt-1'));
            res.seller_meta_elements = metaEls.map(el => el.textContent.trim());
            
            // Find "Deutschland" to see where it is
            const allP = Array.from(document.querySelectorAll('p'));
            const locationP = allP.find(p => p.textContent.includes('Deutschland') || p.textContent.includes('Germany'));
            res.location_debug = locationP ? {
                text: locationP.textContent.trim(),
                classes: locationP.className
            } : 'Location "Deutschland" NOT FOUND';

            return res;
        });

        console.log('SELECTOR CHECK RESULT:');
        console.log(JSON.stringify(selectorCheck, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
})();
