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
            const parsePrice = (value) => {
                if (!value) return null;
                const text = String(value).replace(/[^\d,.\-]/g, '').trim();
                if (!text) return null;
                const normalized = text.replace(/\./g, '').replace(',', '.');
                const parsed = Number.parseFloat(normalized);
                return Number.isFinite(parsed) ? Math.round(parsed) : null;
            };

            // Expand hidden bike details if the page renders a collapsed table.
            const expandToggle = Array.from(document.querySelectorAll('button, a, span, div'))
                .find((el) => /details\s*einblenden|show details|mehr details|details anzeigen/i.test((el.textContent || '').trim()));
            if (expandToggle && typeof expandToggle.click === 'function') {
                try { expandToggle.click(); } catch (_) {}
            }

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
                            const oldPrice = parsePrice(
                                offer.highPrice ||
                                offer.priceSpecification?.highPrice ||
                                offer.priceSpecification?.price
                            );
                            if (oldPrice && details.price && oldPrice > details.price) details.originalPrice = oldPrice;
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

                        // Parse compacted table text fallback:
                        // "GabelRockShox ... Gabelmaterialaluminum ... KassetteSRAM ..."
                        const markerDefs = [
                            ['Sattelstütze', 'sattelst(?:ü|u)tze'],
                            ['Gabelmaterial', 'gabelmaterial'],
                            ['Laufräder', 'laufr(?:ä|a)der'],
                            ['Schaltwerk', 'schaltwerk'],
                            ['Dämpfer', 'd(?:ä|a)mpfer'],
                            ['Bremsen', 'bremsen'],
                            ['Kassette', 'kassette'],
                            ['Pedale', 'pedale'],
                            ['Reifen', 'reifen'],
                            ['Lenker', 'lenker'],
                            ['Sattel', 'sattel'],
                            ['Kurbel', 'kurbel'],
                            ['Gabel', 'gabel']
                        ];
                        const markerPattern = markerDefs.map(([, pattern]) => `(?:${pattern})`).join('|');
                        const raw = details.components.raw_text || '';
                        if (raw) {
                            const rowRegex = new RegExp(`(${markerPattern})\\s*:?\\s*([\\s\\S]*?)(?=(?:${markerPattern})\\s*:?|$)`, 'gi');
                            let rowMatch;
                            while ((rowMatch = rowRegex.exec(raw)) !== null) {
                                const rawKey = clean(rowMatch[1]);
                                const rawValue = clean(rowMatch[2]);
                                if (!rawKey || !rawValue) continue;
                                const marker = markerDefs.find(([, pattern]) => new RegExp(`^${pattern}$`, 'i').test(rawKey));
                                const canonicalKey = marker ? marker[0] : rawKey;
                                if (!details.components[canonicalKey]) {
                                    details.components[canonicalKey] = rawValue;
                                }
                            }
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
                        } else {
                            const text = clean(chip.textContent);
                            const parts = text.split(':');
                            if (parts.length >= 2) {
                                const label = clean(parts.shift());
                                const val = clean(parts.join(':'));
                                if (label && val) details.general[label] = val;
                            }
                        }
                    });
                }
            }
            // 2.1 Current/Original price from DOM card (fallback if JSON-LD missed old price)
            if (!details.price || !details.originalPrice) {
                const hasPriceToken = (text) => {
                    const value = String(text || '');
                    return /(?:€|eur)\s*\d|\d[\d.,\s]*\s*(?:€|eur)/i.test(value);
                };

                const strikeEl = Array.from(document.querySelectorAll('s, del, .line-through, [style*="line-through"]'))
                    .find((el) => hasPriceToken(el.textContent || ''));
                if (strikeEl) {
                    const strikePrice = parsePrice(strikeEl.textContent);
                    if (strikePrice) details.originalPrice = strikePrice;
                }

                if (!details.price) {
                    const priceEl = Array.from(document.querySelectorAll('h1, h2, h3, p, span, div'))
                        .find((el) => hasPriceToken(el.textContent || '') && !(el.closest('s, del') || el.classList.contains('line-through')));
                    if (priceEl) {
                        const parsedPrice = parsePrice(priceEl.textContent);
                        if (parsedPrice) details.price = parsedPrice;
                    }
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
            const streamChunks = [];
            if (Array.isArray(nextFData)) {
                streamChunks.push(nextFData.map(item => item && item[1] ? item[1] : '').join(''));
            }
            const inlineScripts = Array.from(document.querySelectorAll('script'))
                .map((script) => script.textContent || '')
                .filter(Boolean)
                .join('\n');
            if (inlineScripts) streamChunks.push(inlineScripts);
            const stream = streamChunks.join('\n');
            const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const decodeStreamValue = (value) => clean(
                String(value || '')
                    .replace(/\\n/g, ' ')
                    .replace(/\\"/g, '"')
                    .replace(/\\u00a0/gi, ' ')
            );
            const normalizeMarketComparisonValue = (rawRange, rawText = '') => {
                const normalized = clean(`${rawRange || ''} ${rawText || ''}`)
                    .toLowerCase()
                    .replace(/\s+/g, ' ')
                    .trim();
                if (!normalized) return null;
                if (/no[\s_-]?rating|keine\s+bewertung|kein\s+rating/.test(normalized)) return 'no_rating';
                if (/excellent|great|sehr\s+gut/.test(normalized)) return 'great';
                if (/good|guter\s+preis/.test(normalized)) return 'good';
                if (/fair/.test(normalized)) return 'fair';
                if (/high|over|zu\s+teuer|expensive/.test(normalized)) return 'high';
                if (/low|under|g(?:ü|u)nstig|cheap/.test(normalized)) return 'low';
                return null;
            };
            const readStreamLabeledValue = (sourceText, labels = []) => {
                if (!sourceText || !labels.length) return null;
                for (const label of labels) {
                    const escaped = escapeRegex(label);
                    const patterns = [
                        new RegExp(`"key"\\s*:\\s*"${escaped}"[\\s\\S]{0,220}?"value"\\s*:\\s*"([^"]{1,600})"`, 'i'),
                        new RegExp(`\\\\"key\\\\"\\s*:\\s*\\\\"${escaped}\\\\"[\\s\\S]{0,280}?\\\\"value\\\\"\\s*:\\s*\\\\"([^\\\\"]{1,600})\\\\"`, 'i')
                    ];
                    for (const pattern of patterns) {
                        const match = sourceText.match(pattern);
                        if (match && match[1]) return decodeStreamValue(match[1]);
                    }
                }
                return null;
            };
            if (stream) {
                try {
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

                    // Regex extraction for attributes/components from stream.
                    // Works for both plain JSON and escaped chunks from App Router payload.
                    const attrRegexes = [
                        /{"key":"(.*?)","value":"(.*?)"[^}]*}/g,
                        /\\"key\\"\s*:\s*\\"(.*?)\\"\s*,\s*\\"value\\"\s*:\s*\\"(.*?)\\"[^}]*\}/g
                    ];
                    for (const attrRegex of attrRegexes) {
                        let match;
                        while ((match = attrRegex.exec(stream)) !== null) {
                            const key = match[1];
                            const val = decodeStreamValue(match[2] || '');
                            if (key && val) {
                                details.components = details.components || {};
                                if (key === 'component_name') details.components['Groupset'] = val;
                                else if (key === 'frame_material_name') details.components['Frame Material'] = val;
                                else if (key === 'brake_type_name') details.components['Brakes'] = val;
                                else details.components[key] = val;
                            }
                        }
                    }

                    // Explicit key/value extraction to handle escaped stream chunks with extra fields.
                    details.components = details.components || {};
                    const streamComponentMap = [
                        { key: 'Kassette', labels: ['Kassette', 'Cassette'] },
                        { key: 'Reifen', labels: ['Reifen', 'Tires', 'Tire'] },
                        { key: 'Bremsen', labels: ['Bremsen', 'Brakes'] },
                        { key: 'Schaltwerk', labels: ['Schaltwerk', 'Rear derailleur'] },
                        { key: 'Gabel', labels: ['Gabel', 'Fork'] },
                        { key: 'Dämpfer', labels: ['Dämpfer', 'Daempfer', 'Shock', 'Damper'] }
                    ];
                    for (const entry of streamComponentMap) {
                        if (details.components[entry.key]) continue;
                        const value = readStreamLabeledValue(stream, entry.labels);
                        if (value) details.components[entry.key] = value;
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

                    // Seller metadata from stream (contains stable machine values).
                    details.seller = details.seller || {};
                    const readStreamValue = (patterns) => {
                        for (const pattern of patterns) {
                            const match = stream.match(pattern);
                            if (match && match[1] !== undefined) return match[1];
                        }
                        return null;
                    };
                    const sellerNameFromStream = readStreamValue([
                        /"seller":\{[\s\S]{0,400}?"name":"([^"]+)"/,
                        /\\"seller\\":\{[\s\S]{0,400}?\\"name\\":\\"([^\\"]+)\\"/
                    ]);
                    const avgRatingRaw = readStreamValue([
                        /"avg_rating":(null|[0-9]+(?:\.[0-9]+)?)/,
                        /\\"avg_rating\\":(null|[0-9]+(?:\.[0-9]+)?)/
                    ]);
                    const reviewsRaw = readStreamValue([
                        /"user_reviews_count":(null|[0-9]+)/,
                        /\\"user_reviews_count\\":(null|[0-9]+)/
                    ]);
                    const lastActiveFormatted = readStreamValue([
                        /"last_active_at_formatted":"([^"]+)"/,
                        /\\"last_active_at_formatted\\":\\"([^\\"]+)\\"/
                    ]);

                    if (sellerNameFromStream && !details.seller.name) details.seller.name = sellerNameFromStream;
                    if (avgRatingRaw && avgRatingRaw !== 'null') {
                        const rating = Number(avgRatingRaw);
                        if (Number.isFinite(rating)) details.seller.rating = rating;
                    }
                    if (reviewsRaw && reviewsRaw !== 'null') {
                        const reviews = Number(reviewsRaw);
                        if (Number.isFinite(reviews)) details.seller.reviews_count = reviews;
                    }
                    if (lastActiveFormatted && !details.seller.last_active) {
                        details.seller.last_active = clean(lastActiveFormatted).replace(/^(Zuletzt aktiv:|Last active:)\s*/i, '');
                    }

                    // Buycycle price assessment badge (e.g., "Guter Preis").
                    const badgeRange = readStreamValue([
                        /"price_badge":\{[\s\S]{0,500}?"range_value":"([^"]+)"/,
                        /\\"price_badge\\":\{[\s\S]{0,500}?\\"range_value\\":\\"([^\\"]+)\\"/
                    ]);
                    const badgeText = readStreamValue([
                        /"price_badge":\{[\s\S]{0,500}?"text_value":"([^"]+)"/,
                        /\\"price_badge\\":\{[\s\S]{0,500}?\\"text_value\\":\\"([^\\"]+)\\"/
                    ]);
                    const badgeDescription = readStreamValue([
                        /"price_badge":\{[\s\S]{0,700}?"description":"([^"]+)"/,
                        /\\"price_badge\\":\{[\s\S]{0,700}?\\"description\\":\\"([^\\"]+)\\"/
                    ]);
                    const normalizedBadgeRange = normalizeMarketComparisonValue(badgeRange, `${badgeText || ''} ${badgeDescription || ''}`);
                    if (normalizedBadgeRange) details.priceBadgeRange = normalizedBadgeRange;
                    else if (badgeRange) details.priceBadgeRange = clean(badgeRange).toLowerCase();
                    if (badgeText) details.priceBadgeText = decodeStreamValue(badgeText);
                    if (badgeDescription) details.priceBadgeDescription = decodeStreamValue(badgeDescription);
                    if (!details.marketComparison) {
                        details.marketComparison = normalizeMarketComparisonValue(details.priceBadgeRange, details.priceBadgeText || details.priceBadgeDescription || '');
                    }

                    const inDemandShort = readStreamValue([
                        /"key":"in_high_demand_short","value":"([^"]+)"/,
                        /\\"key\\":\\"in_high_demand_short\\",\\"value\\":\\"([^\\"]+)\\"/
                    ]);
                    if (inDemandShort && !details.inHighDemandShort) {
                        details.inHighDemandShort = inDemandShort;
                    }

                } catch (e) {
                    console.error('Next.js App Router extraction failed:', e);
                }
            }

            // DOM fallback for price badge on pages where stream is incomplete.
            if (!details.priceBadgeText || !details.priceBadgeRange) {
                const badgeCandidates = Array.from(document.querySelectorAll('span, p, div'))
                    .map((el) => clean(el.textContent || ''))
                    .filter((text) => text.length >= 6 && text.length <= 120 && /(preis|price)/i.test(text));
                const badgeFromDom = badgeCandidates.find((text) =>
                    /(guter|sehr guter|fairer|zu teurer?|good|great|fair|price)\s+(preis|price)/i.test(text)
                );
                if (badgeFromDom && !details.priceBadgeText) details.priceBadgeText = badgeFromDom;
                if (!details.priceBadgeRange) {
                    const domRange = normalizeMarketComparisonValue('', badgeFromDom || '');
                    if (domRange) details.priceBadgeRange = domRange;
                }
            }
            if (!details.marketComparison) {
                details.marketComparison = normalizeMarketComparisonValue(details.priceBadgeRange, details.priceBadgeText || details.priceBadgeDescription || '');
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

            // Platform social proof (Trustpilot reviews count shown in card footer).
            const bodyText = clean(document.body.innerText || '');
            const trustpilotMatch =
                bodyText.match(/(?:sehen sie unsere|see our)\s*([0-9][0-9.,\s]{2,})\s*(?:bewertungen|reviews?)\s*auf\s*trustpilot/i) ||
                bodyText.match(/([0-9][0-9.,\s]{2,})\s*(?:bewertungen|reviews?)\s*auf\s*trustpilot/i);
            if (trustpilotMatch && trustpilotMatch[1]) {
                const parsedCount = Number.parseInt(String(trustpilotMatch[1]).replace(/[^\d]/g, ''), 10);
                if (Number.isFinite(parsedCount) && parsedCount > 0) {
                    details.platformReviewsCount = parsedCount;
                    details.platformReviewsSource = 'Trustpilot';
                }
            } else {
                const trustpilotNode = Array.from(document.querySelectorAll('a, p, div, span'))
                    .find((el) => /trustpilot/i.test(el.textContent || ''));
                if (trustpilotNode) {
                    const context = clean((trustpilotNode.closest('div')?.textContent || trustpilotNode.textContent || ''));
                    const fallbackMatch = context.match(/([0-9][0-9.,\s]{2,})\s*(?:bewertungen|reviews?)/i);
                    if (fallbackMatch && fallbackMatch[1]) {
                        const parsedCount = Number.parseInt(String(fallbackMatch[1]).replace(/[^\d]/g, ''), 10);
                        if (Number.isFinite(parsedCount) && parsedCount > 0) {
                            details.platformReviewsCount = parsedCount;
                            details.platformReviewsSource = 'Trustpilot';
                        }
                    }
                }
            }
            if (!details.platformReviewsSource) {
                const hasTrustpilotWidget = Boolean(
                    document.querySelector('.trustpilot-widget') ||
                    document.querySelector('iframe[src*="trustpilot"]') ||
                    document.querySelector('script[src*="trustpilot"]')
                );
                if (hasTrustpilotWidget) details.platformReviewsSource = 'Trustpilot';
            }
            if (!details.platformReviewsSource) {
                // Buycycle consistently uses Trustpilot as a platform-level social proof source.
                details.platformReviewsSource = 'Trustpilot';
            }

            // 7. Normalize high-value fields for downstream mapping.
            const general = details.general || {};
            const normalizeKey = (value) => String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            const generalMap = Object.entries(general).reduce((acc, [key, value]) => {
                acc[normalizeKey(key)] = value;
                return acc;
            }, {});
            const readGeneral = (...keys) => {
                for (const key of keys) {
                    const found = generalMap[normalizeKey(key)];
                    if (found) return found;
                }
                return null;
            };

            details.frameSize = details.frameSize || readGeneral('Rahmengröße', 'Rahmengroesse', 'frame size');
            details.year = details.year || parseInt(readGeneral('Jahr', 'year') || '', 10) || null;
            details.wheelSize = details.wheelSize || readGeneral('Laufradgröße', 'Laufradgroesse', 'wheel size');
            details.frameMaterial = details.frameMaterial || readGeneral('Rahmenmaterial', 'frame material');
            details.color = details.color || readGeneral('Farbe', 'color');
            details.brakesType = details.brakesType || readGeneral('Bremstyp', 'brake type');
            details.condition = details.condition || readGeneral('Zustand', 'condition');
            details.location = details.location || details.seller.location || null;
            details.sellerLastActive = details.seller.last_active || null;
            details.sellerName = details.seller.name || null;
            details.sellerRating = Number.isFinite(Number(details.seller.rating)) ? Number(details.seller.rating) : null;
            details.sellerReviewsCount = Number.isFinite(Number(details.seller.reviews_count)) ? Number(details.seller.reviews_count) : null;
            details.sellerRatingVisual = details.sellerRating !== null ? `${details.sellerRating}/5` : null;

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

