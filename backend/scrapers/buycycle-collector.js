const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { DatabaseManager } = require('../src/js/mysql-config');
const UnifiedNormalizer = require('../src/services/UnifiedNormalizer');
const path = require('path');

puppeteer.use(StealthPlugin());

class BuycycleCollector {
    constructor() {
        this.db = new DatabaseManager();
        this.ALLOWED_BRANDS = [
            'Specialized', 'Canyon', 'Santa Cruz', 'Trek', 'Cannondale', 
            'Scott', 'Cube', 'Orbea', 'Giant', 'Yeti', 'Pivot', 'Propain',
            'Commencal', 'Radon', 'YT', 'Bianchi', 'Pinarello', 'Colnago', 'Rose', 'Focus', 'BMC',
            // Allow sub-brands/models that are often mislabeled as brands
            'S-Works', 'Status', 'Jeffsy', 'Capra', 'Tyee', 'Spectral'
        ];
    }

    /**
     * Collect data from a single URL (Standalone mode)
     */
    async collect(url) {
        console.log(`🕵️ BuycycleCollector: Collecting ${url}`);
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        try {
            await this._navigateWithRetry(page, url);
            const details = await this.scrapeListingDetails(page);
            
            // Basic enrichment usually done by hunter, but we do minimal here
            return {
                url: url,
                source: 'buycycle',
                ...details
            };
        } catch (e) {
            console.error(`❌ BuycycleCollector Error: ${e.message}`);
            return null;
        } finally {
            await browser.close();
        }
    }

    /**
     * Helper: Navigate with Retry Logic
     */
    async _navigateWithRetry(page, url, timeout = 120000, retries = 1) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await page.goto(url, { waitUntil: 'networkidle2', timeout });
            } catch (e) {
                const isTimeout = e.message.includes('Timeout') || e.name === 'TimeoutError';
                if (attempt === retries || !isTimeout) throw e;
                
                console.log(`   ⚠️ Timeout (${timeout}ms) at ${url}. Retrying in 5s... (Attempt ${attempt + 1}/${retries + 1})`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    /**
     * Hunt for "High Demand" / "Great Deal" bikes (Opportunity Hunting)
     * @param {string} categoryUrlSegment - e.g. 'mountainbike/high-demand/1' or 'road-gravel/high-demand/1'
     * @param {number} limit - Max bikes to analyze
     */
    async collectHighDemand(categoryUrlSegment, limit = 5) {
        console.log(`🔥 [BUYCYCLE] Opportunity Hunt: ${categoryUrlSegment}`);
        
        // Full URL construction
        // Supports: 
        // - 'mountainbike/high-demand/1'
        // - 'mountainbike/categories/downhill/high-demand/1'
        const baseUrl = 'https://buycycle.com/de-de/shop/main-types/bikes/bike-types/';
        const url = `${baseUrl}${categoryUrlSegment}`;
        
        console.log(`   ➡️ Opportunity URL: ${url}`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox'] 
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            
            // 1. Navigate
            const response = await this._navigateWithRetry(page, url, 120000);
            if (response.status() === 404) {
                console.log('   ⚠️ Page not found (404).');
                return [];
            }

            // 2. Extract Listings
            const listings = await this.extractListingsFromPage(page);
            console.log(`   📊 Found ${listings.length} high-demand listings.`);
            
            // Debug: Show first few brands found
            if (listings.length > 0) {
                const sampleBrands = listings.slice(0, 5).map(i => i.brand || i.title);
                console.log(`   🐛 Sample Brands found: ${sampleBrands.join(', ')}`);
            }

            // 3. Whitelist Filter
            const filtered = listings.filter(item => {
                const brand = item.brand || item.title.split(' ')[0];
                return this.ALLOWED_BRANDS.some(b => brand.toLowerCase().includes(b.toLowerCase()));
            });
            
            console.log(`   🛡️ Filtered to ${filtered.length} whitelisted candidates.`);

            // 4. Log to FMV (Generic context)
            await this.logBatchToFMV(filtered, { brand: 'Mixed', model: 'HighDemand' });

            // 5. Select Candidates
            const candidates = filtered.slice(0, limit);
            const enrichedBikes = [];

            // 6. Deep Analysis Loop
            for (const candidate of candidates) {
                try {
                    console.log(`   🕵️ Analyzing Opportunity: ${candidate.title} (€${candidate.price})`);
                    await page.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    
                    const details = await this.scrapeListingDetails(page);
                    
                    const rawBike = {
                        ...candidate,
                        ...details,
                        brand: details.brand || candidate.brand || 'Unknown',
                        model: details.model || candidate.model || 'Unknown',
                        external_id: candidate.external_id || this.extractExternalId(candidate.url)
                    };

                    console.log(`      🤖 Отправка в UnifiedNormalizer...`);
                    const normalized = await UnifiedNormalizer.normalize(rawBike, 'buycycle');
                    
                    // FAILED PROCESSING LOGGING
                    if (!normalized.quality_score || normalized.quality_score <= 40 || normalized.meta?.is_active === false) {
                        console.log(`   ⚠️ Processing failed or Quality=${normalized.quality_score}. Logging to failed_bikes...`);
                        try {
                            await this.db.query(`
                                INSERT INTO failed_bikes (url, raw_data, error_message, status) 
                                VALUES (?, ?, ?, 'pending')
                                ON CONFLICT(url) DO UPDATE SET 
                                    raw_data = excluded.raw_data,
                                    status = 'pending',
                                    attempts = 0,
                                    last_retry = NULL
                            `, [
                                rawBike.url, 
                                JSON.stringify(rawBike), 
                                normalized.audit?.error || 'Low Quality Score'
                            ]);
                        } catch (logErr) {
                            console.error('   ❌ Failed to log to failed_bikes:', logErr.message);
                        }
                    } else {
                        normalized.meta = normalized.meta || {};
                        normalized.meta.source_platform = normalized.meta.source_platform || 'buycycle';
                        normalized.meta.source_url = normalized.meta.source_url || candidate.url;
                        normalized.meta.is_high_demand = true;
                        
                        console.log(`      ✅ Quality Score: ${normalized.quality_score}`);
                        enrichedBikes.push(normalized);
                    }


                    await new Promise(r => setTimeout(r, 2000));

                } catch (e) {
                    console.error(`      ⚠️ Failed to analyze candidate ${candidate.url}: ${e.message}`);
                }
            }

            return enrichedBikes;

        } catch (e) {
            console.error(`❌ Buycycle Opportunity Hunt Error: ${e.message}`);
            return [];
        } finally {
            if (browser) await browser.close();
        }
    }

    /**
     * Build Smart Search URL based on criteria
     * @param {Object} criteria 
     */
    buildSearchUrl(criteria) {
        // Base: https://buycycle.com/de-de/shop
        let url = 'https://buycycle.com/de-de/shop';
        
        // 1. Frame Sizes (e.g. /frame-sizes/l,m)
        if (criteria.frameSizes && criteria.frameSizes.length > 0) {
            const sizes = criteria.frameSizes.map(s => s.toLowerCase()).join(',');
            url += `/frame-sizes/${sizes}`;
        }

        // 2. Price Range
        let minP = criteria.minPrice;
        let maxP = criteria.maxPrice;

        // Auto-fix inverted price range
        if (minP && maxP && minP > maxP) {
            console.warn(`   ⚠️ Inverted price range detected: ${minP}-${maxP}. Swapping.`);
            [minP, maxP] = [maxP, minP];
        }

        if (minP) url += `/min-price/${minP}`;
        if (maxP) url += `/max-price/${maxP}`;

        // 3. Year Range
        if (criteria.minYear) url += `/min-year/${criteria.minYear}`;
        if (criteria.maxYear) url += `/max-year/${criteria.maxYear}`;

        // 4. Search Query (Brand + Model)
        // Ensure clean query
        const query = `${criteria.brand} ${criteria.model}`.trim();
        const encodedQuery = encodeURIComponent(query);
        url += `/search/${encodedQuery}`;

        return url;
    }

    /**
     * Collect bikes with Smart Filtering & Deep Analysis
     * @param {Object} target { brand, model, minPrice, maxPrice, sizes: [], minYear, maxYear, limit }
     */
    async collectForTarget(target) {
        console.log(`🔍 [BUYCYCLE] Smart Hunt: ${target.brand} ${target.model}`);
        
        const url = this.buildSearchUrl({
            brand: target.brand,
            model: target.model,
            minPrice: target.minPrice,
            maxPrice: target.maxPrice,
            frameSizes: target.sizes, // Expecting array ['L', 'M']
            minYear: target.minYear,
            maxYear: target.maxYear
        });
        
        console.log(`   ➡️ Smart URL: ${url}`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox'] 
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            
            // 1. Navigate to Search Results
            const response = await this._navigateWithRetry(page, url, 120000);
            
            if (response.status() === 404) {
                console.log('   ⚠️ Page not found (404).');
                return [];
            }

            // 2. Extract Basic Listings (for FMV & Selection)
            const listings = await this.extractListingsFromPage(page);
            console.log(`   📊 Found ${listings.length} listings (logging to FMV...)`);

            // 3. Log ALL to FMV (Market History)
            await this.logBatchToFMV(listings, target);

            // 4. Select "Interesting" Candidates
            // Filter logic: Already filtered by URL, so we just take the top N
            // Maybe prioritize by "Great Price" label if available, or just newest/cheapest?
            // Default: Take top N
            const ListingScorer = require('../src/utils/ListingScorer'); 
            const scorer = new ListingScorer(); 
            
            const limit = target.limit || 3; 
            
            // 🆕 Применяем scoring и сортировку 
            const scoredListings = scorer.sortByScore(listings); 
            
            console.log(`   📊 Top ${limit} scores: ${scoredListings.slice(0, limit).map(l => l.preSelectionScore).join(', ')}`); 
            
            const candidates = scoredListings.slice(0, limit);
            
            console.log(`   🎯 Selected ${candidates.length} candidates for Deep Analysis...`);

            const enrichedBikes = [];

            // 5. Deep Analysis Loop
            for (const candidate of candidates) {
                try {
                    console.log(`   🕵️ Analyzing: ${candidate.title} (€${candidate.price})`);
                    
                    // Navigate to Details
                    await page.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    
                    // Scrape Details
                    const details = await this.scrapeListingDetails(page);
                    
                    // Merge Data
                    const rawBike = {
                        ...candidate,
                        ...details,
                        brand: target.brand,
                        model: target.model,
                        external_id: candidate.external_id || this.extractExternalId(candidate.url)
                    };

                    // 6. Gemini / TechDecoder Normalization & Scoring
                    console.log(`      🤖 Отправка в UnifiedNormalizer...`);
                    const normalized = await UnifiedNormalizer.normalize(rawBike, 'buycycle');
                    
                    // Add source metadata
                    normalized.meta = normalized.meta || {};
                    normalized.meta.source_platform = normalized.meta.source_platform || 'buycycle';
                    normalized.meta.source_url = normalized.meta.source_url || candidate.url;
                    
                    console.log(`      ✅ Quality Score: ${normalized.quality_score}`);
                    enrichedBikes.push(normalized);

                    // Rate limit
                    await new Promise(r => setTimeout(r, 2000));

                } catch (e) {
                    console.error(`      ⚠️ Failed to analyze candidate ${candidate.url}: ${e.message}`);
                }
            }

            return enrichedBikes;

        } catch (e) {
            console.error(`❌ Buycycle Smart Hunt Error: ${e.message}`);
            return [];
        } finally {
            if (browser) await browser.close();
        }
    }

    async extractListingsFromPage(page) {
        // Try __NEXT_DATA__ first (Reliable)
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
                            title: `${obj.brand.name || obj.brand} ${obj.model.name || obj.model} ${obj.year || ''}`,
                            price: typeof obj.price === 'object' ? (obj.price.amount || 0) : obj.price,
                            year: obj.year,
                            frame_size: obj.frame_size || obj.size,
                            frameSize: obj.frame_size || obj.size, // For Scorer
                            url: obj.url || `https://buycycle.com/de-de/bike/${obj.slug}`,
                            image: obj.image || (obj.images ? obj.images[0] : null),
                            images: obj.images || (obj.image ? [obj.image] : []), // For Scorer
                            source: 'buycycle',
                            external_id: obj.id || obj.slug || obj.url
                        });
                        return;
                    }
                    Object.values(obj).forEach(traverse);
                };
                
                if (nextData.props?.pageProps) traverse(nextData.props.pageProps);
                else traverse(nextData);

                // Deduplicate by URL
                const unique = [];
                const map = new Map();
                for (const item of items) {
                    if (!map.has(item.url)) {
                        map.set(item.url, true);
                        unique.push(item);
                    }
                }
                return unique;
            }
        } catch (e) { /* Ignore */ }

        // Fallback: DOM Scraping
        return await page.evaluate(() => {
            // Select product cards
            const items = Array.from(document.querySelectorAll('a[href*="/product/"], a[href*="/bike/"]'));
            
            return items.map(item => {
                const container = item; 
                
                // Clean Text Helper
                const clean = (t) => t ? t.replace(/Stark gefragt\d*/gi, '').trim() : '';

                const priceText = container.textContent.match(/€\s?([0-9.,]+)/)?.[1];
                const price = priceText ? parseInt(priceText.replace(/[^0-9]/g, '')) : 0;
                
                // Title heuristic: Try to find the specific title element
                // Usually it's the element with the largest text or specific classes
                let titleEl = container.querySelector('h3') || 
                              container.querySelector('.font-bold') || 
                              container.querySelector('.text-lg');
                
                let title = titleEl ? titleEl.textContent : container.textContent.split('\n')[0];
                title = clean(title);

                // If title is still messy (contains "Stark gefragt"), brute force clean it
                // Example: "Stark gefragt523TransitionPatrol..."
                // We can try to split by camelCase or known brands if we had them, 
                // but for now let's just strip known bad prefixes.
                
                const link = item.getAttribute('href');
                const img = container.querySelector('img')?.getAttribute('src');

                // Try to extract brand from title (Simple heuristic: First word)
                const brand = title.split(' ')[0];

                return {
                    title: title,
                    brand: brand,
                    price: price,
                    url: link.startsWith('http') ? link : `https://buycycle.com${link}`,
                    image: img,
                    images: img ? [img] : [], // For Scorer
                    source: 'buycycle',
                    external_id: link
                };
            }).filter(l => l.price > 0 && l.title.length > 3 && !l.title.includes('Frameset')); // Exclude framesets if possible
        });
    }

    async scrapeListingDetails(page) {
        return page.evaluate(() => {
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

            // 1. Fahrraddetails (Components)
            const detailsHeader = headings.find(h => h.textContent.includes('Fahrraddetails') || h.textContent.includes('Bike details'));
            if (detailsHeader) {
                // Find the closest grid container. It's often the next sibling or wrapped in a div
                let container = detailsHeader.nextElementSibling;
                // If the next sibling is just a spacer, skip it
                while (container && (container.tagName === 'HR' || container.textContent.trim().length === 0)) {
                    container = container.nextElementSibling;
                }
                
                // If container is not the grid itself, look inside
                    if (container) {
                        // ALWAYS dump entire text content to raw_components_text as a robust fallback
                        // This allows Gemini to parse it even if our DOM selectors miss some rows
                        details.components = details.components || {};
                        details.components.raw_text = clean(container.textContent);

                        // Try to find the grid rows: .grid-cols-2 or just .grid
                        const gridItems = Array.from(container.querySelectorAll('div')).filter(div => {
                            // Heuristic: A detail row usually has two children (Key, Value) and some grid classes
                            // But Buycycle often uses a flat list of divs with col-span classes
                            // Let's look for the specific structure: Label (font-medium) + Value (text-contentTertiary)
                            return div.querySelector('.font-medium') && div.querySelector('.text-contentTertiary');
                        });

                        if (gridItems.length > 0) {
                            gridItems.forEach(item => {
                                const keyEl = item.querySelector('.font-medium');
                                const valEl = item.querySelector('.text-contentTertiary');
                                if (keyEl && valEl) {
                                    const key = clean(keyEl.textContent);
                                    const val = clean(valEl.textContent);
                                    if (key && val) details.components[key] = val;
                                }
                            });
                        }
                    }
                }

            // 2. Allgemeine Informationen (Chips)
            const generalHeader = headings.find(h => h.textContent.includes('Allgemeine Informationen'));
            if (generalHeader) {
                // The container is usually the next sibling or close by
                // Dump shows: h2 -> div.mb-6 -> div.flex.flex-wrap
                let container = generalHeader.nextElementSibling;
                if (container && !container.classList.contains('flex')) {
                    container = container.querySelector('.flex.flex-wrap');
                }
                
                if (container) {
                    const chips = container.querySelectorAll('.rounded-3xl, .rounded-full, .bg-backgroundSecondary');
                    details.general = {};
                    chips.forEach(chip => {
                        const spans = chip.querySelectorAll('span');
                        if (spans.length >= 2) {
                            const label = clean(spans[0].textContent).replace(':', '');
                            const val = clean(spans[1].textContent);
                            details.general[label] = val;
                        }
                    });
                }
            }

            // 3. Verkäuferbeschreibung (Full Text)
            // If JSON-LD description is short or missing, try to get the full one
            const descHeader = headings.find(h => h.textContent.includes('Verkäuferbeschreibung') || h.textContent.includes('Seller description'));
            if (descHeader) {
                // The text is often in a collapsible div
                // Find the wrapper (parent of header usually contains the content in a sibling)
                // In dump: div.mt-8 > div.flex (header) + div.relative (content)
                const wrapper = descHeader.closest('.mt-8') || descHeader.parentElement;
                if (wrapper) {
                    // Look for the text container. It usually has 'text-contentPrimary' or just text nodes
                    // Exclude the header itself
                    const contentClone = wrapper.cloneNode(true);
                    // Remove header
                    const headerInClone = contentClone.querySelector('.text-xl');
                    if (headerInClone) headerInClone.remove();
                    // Remove "Read more" buttons
                    const buttons = contentClone.querySelectorAll('button');
                    buttons.forEach(b => b.remove());
                    
                    const fullText = clean(contentClone.textContent);
                    if (fullText.length > (details.description?.length || 0)) {
                        details.description = fullText;
                    }
                }
            }

            // 4. Images (High Res Fallback & Merge)
            // Always try to extract from DOM to get more photos than JSON-LD might offer
            const domImages = Array.from(document.querySelectorAll('img[src*="/uploads/"], .gallery img, .swiper-slide img, [data-test="gallery-image"], img.product-image'))
                .map(img => img.src || img.dataset.src)
                .filter(src => src && src.length > 20 && !src.includes('avatar') && !src.includes('logo') && !src.includes('icon'));
            
            // User-suggested fix: Explicitly check for cloudfront images if standard selectors fail
            if (domImages.length === 0) {
                 const cloudfrontImages = Array.from(document.querySelectorAll('img'))
                    .map(img => img.src)
                    .filter(src => src && src.includes('cloudfront') && src.length > 50);
                 domImages.push(...cloudfrontImages);
            }

            const existingImages = details.images || [];
            // Merge and Deduplicate
            details.images = [...new Set([...existingImages, ...domImages])];
            
            // If still empty, try to find ANY large image in the main container
            if (details.images.length === 0) {
                 const mainImg = document.querySelector('img[fetchpriority="high"]');
                 if (mainImg && mainImg.src) details.images = [mainImg.src];
            }

            // 5. Next.js App Router Data Extraction (self.__next_f)
            // Critical for bikes where __NEXT_DATA__ is missing or DOM is partial
            const nextFData = window.self?.__next_f;
            if (nextFData && Array.isArray(nextFData)) {
                try {
                    // Flatten the stream
                    const stream = nextFData.map(item => item[1]).join('');
                    
                    // Regex extraction for Description
                    // Pattern: "description":{"key":"Informationen vom Verkäufer","value":"..."
                    const descMatch = stream.match(/"description":\{"key":"[^"]+","value":"(.*?)"/);
                    if (descMatch && descMatch[1]) {
                         // Unescape JSON string
                         const rawDesc = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                         if (rawDesc.length > (details.description?.length || 0)) {
                             details.description = rawDesc;
                         }
                    }

                    // Regex extraction for Attributes (Components)
                    // Pattern: "attributes":[{"key":"year","value":"2022"...
                    const attrMatch = stream.match(/"attributes":(\[\{.*?\}\])/);
                    if (attrMatch && attrMatch[1]) {
                        try {
                            // Need to clean up the JSON string carefully as it might be cut off or contain escaped chars
                            // The match captures strictly the array [...]
                            const attrJson = JSON.parse(attrMatch[1].replace(/\\"/g, '"')); // Simple unescape might fail if complex
                            
                            // Better approach: Parse the attributes manually or robustly
                            // Or use the captured string if valid JSON
                            // Let's rely on a simpler regex to extract key-values from the stream fragment
                            
                            // Re-scan the stream for individual attributes
                            const attrRegex = /{"key":"(.*?)","value":"(.*?)"(?:,"url":.*?)?}/g;
                            let match;
                            while ((match = attrRegex.exec(stream)) !== null) {
                                const key = match[1];
                                const val = match[2];
                                if (key && val) {
                                    details.components = details.components || {};
                                    // Normalize keys: component_name -> Groupset, etc.
                                    if (key === 'component_name') details.components['Groupset'] = val;
                                    else if (key === 'frame_material_name') details.components['Frame Material'] = val;
                                    else if (key === 'brake_type_name') details.components['Brakes'] = val;
                                    else details.components[key] = val;
                                }
                            }
                        } catch (e) {
                            // Regex fallback
                        }
                    }
                    
                    // Also check for "general_information_all"
                    // "general_information_all":{"key":"Allgemeine Informationen","data":[{"key":"Zustand","value":"Gut"...
                    const generalMatch = stream.match(/"general_information_all":\{.*?"data":(\[\{.*?\}\])/);
                    if (generalMatch && generalMatch[1]) {
                         const generalRegex = /{"key":"(.*?)","value":"(.*?)"/g;
                         let match;
                         while ((match = generalRegex.exec(generalMatch[1])) !== null) {
                             const key = match[1];
                             const val = match[2];
                             if (key && val) {
                                 details.components = details.components || {};
                                 details.components[key] = val;
                             }
                         }
                    }

                } catch (e) {
                    console.error('Next.js App Router extraction failed:', e);
                }
            }

            // 6. User-Specified Real Data Extraction (Override Generic)
            // Description (Real seller text vs generic template)
            const realDescEl = document.querySelector('.overflow-hidden.mt-2.text-contentPrimary.font-regular.text-base');
            if (realDescEl && realDescEl.textContent.trim().length > 5) {
                details.description = clean(realDescEl.textContent);
            }

            // Seller Info extraction
            details.seller = details.seller || {};
            
            // Seller Name
            const sellerNameEl = document.querySelector('.font-medium.text-lg.text-contentPrimary.whitespace-nowrap.text-ellipsis.overflow-hidden');
            if (sellerNameEl) {
                // Strip "Verkauft von" / "Sold by" prefixes if present
                details.seller.name = clean(sellerNameEl.textContent).replace(/^(Verkauft von|Sold by)\s*/i, '');
            } else if (!details.seller.name) {
                 details.seller.name = "Unknown";
            }

            // Seller Location & Last Active
            // We look for p tags with specific styling
            const metaEls = Array.from(document.querySelectorAll('.font-regular.text-sm.text-contentTertiary'));
            
            // "Zuletzt aktiv" usually contains "aktiv" or "active"
            const activeEl = metaEls.find(el => el.textContent.toLowerCase().includes('aktiv') || el.textContent.toLowerCase().includes('active'));
            if (activeEl) {
                details.seller.last_active = clean(activeEl.textContent).replace(/^(Zuletzt aktiv:|Last active:)\s*/i, '');
            }

            // Location is likely the one that is NOT activeEl and has content
            // We also check if it looks like a location (contains comma or just text)
            const locationEl = metaEls.find(el => {
                const text = el.textContent.trim();
                return el !== activeEl && text.length > 2 && !text.toLowerCase().includes('aktiv') && !text.toLowerCase().includes('active');
            });
            
            if (locationEl) {
                 details.seller.location = clean(locationEl.textContent);
            }

            return details;
        });
    }

    async logBatchToFMV(listings, target) {
        if (!listings || listings.length === 0) return;
        
        for (const item of listings) {
            // Smart Brand/Model Detection
            // If item has explicit brand (from NEXT_DATA), use it. 
            // If target.brand is specific (not Mixed), use it.
            // Fallback to item.brand or 'Unknown'
            let finalBrand = target.brand;
            if (finalBrand === 'Mixed' && item.brand) finalBrand = item.brand.name || item.brand;
            
            let finalModel = target.model;
            if (finalModel === 'HighDemand' && item.model) finalModel = item.model.name || item.model;

            try {
                // Check if exists
                const existing = await this.db.query('SELECT id FROM market_history WHERE source_url = ?', [item.url]);
                
                if (existing && existing.length > 0) {
                    // Update
                    await this.db.query(`
                        UPDATE market_history 
                        SET price_eur = ?, scraped_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [parseFloat(item.price) || 0, existing[0].id]);
                } else {
                    // Insert
                    await this.db.query(`
                        INSERT INTO market_history 
                        (title, brand, price_eur, year, source, source_url, model, frame_size, created_at, scraped_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `, [
                        item.title,
                        finalBrand,
                        parseFloat(item.price) || 0,
                        item.year || null,
                        'buycycle',
                        item.url,
                        finalModel,
                        item.frame_size || null
                    ]);
                }
            } catch (e) {
                console.error(`      ⚠️ Failed to log item ${item.url}: ${e.message}`);
            }
        }
        console.log(`   💾 Logged ${listings.length} items to FMV.`);
    }

    extractExternalId(url) {
        try {
            const parsed = new URL(url);
            const parts = parsed.pathname.split('/').filter(Boolean);
            return parts[parts.length - 1] || url;
        } catch (e) {
            return url || null;
        }
    }
}

module.exports = new BuycycleCollector();
module.exports.BuycycleCollector = BuycycleCollector;
