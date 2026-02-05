const path = require('path');
const KleinanzeigenParser = require('./kleinanzeigen-parser');
const BikesDatabaseNode = require('./bikes-database-node');
const GeminiProcessor = require('./gemini-processor');
const ValuationService = require('../backend/services/valuation-service');
const DiversityManager = require('./DiversityManager');
const ConditionAnalyzer = require('./ConditionAnalyzer');
const techDecoder = require('../backend/src/services/TechDecoder');
const PhotoManager = require('../backend/src/services/PhotoManager');
const { checkKleinanzeigenStatus } = require('./status-checker');
let geminiClient;
try {
    // Attempt to load TS module (might fail in pure Node)
    // Using require.resolve to check existence, but loading .ts needs ts-node
    // We'll wrap in try-catch and suppress error if not running with ts-node
    geminiClient = require('./autocat-klein/src/lib/geminiClient.ts').geminiClient;
} catch (e) {
    // console.log('Notice: Multi-key Gemini client not loaded (TS module). Using standard key.');
    geminiClient = null;
}
const cheerio = require('cheerio');
const ArbiterService = require('./ArbiterService');
const RateLimiter = require('./RateLimiter');
const KillSwitchFilter = require('./KillSwitchFilter');
const { BRAND_MODELS } = require('./BrandConstants');
const SmartURLBuilder = require('./smart-url-builder');
const SmartTargetStrategy = require('../backend/services/smart-target-strategy');

// Utility
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

class UnifiedHunter {
    constructor(options = {}) {
        this.logger = typeof options === 'function' ? options : (options.logger || console.log);
        this.bikesDB = new BikesDatabaseNode();
        this.parser = new KleinanzeigenParser();
        this.photoManager = new PhotoManager();
        this.publishMode = String(options.publishMode || process.env.HUNTER_PUBLISH_MODE || 'catalog').toLowerCase();
        
        // Gemini Setup
        const geminiKey = process.env.GEMINI_API_KEY || '';
        const geminiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-pro-preview:generateContent';
        this.geminiProcessor = new GeminiProcessor(geminiKey, geminiUrl);
        try {
            this.geminiProcessor.setMultiKeyClient(geminiClient);
            this.log('✅ UnifiedHunter: Multi-key Gemini client attached');
        } catch (e) {
            this.log(`⚠️ UnifiedHunter: Failed to attach multi-key Gemini client: ${e.message}`);
        }
        
        this.conditionAnalyzer = new ConditionAnalyzer(this.geminiProcessor, techDecoder);
        this.valuationService = new ValuationService(this.bikesDB);
        this.arbiter = new ArbiterService();
        this.rateLimiter = new RateLimiter({ logger: this.log.bind(this) });
        this.urlBuilder = new SmartURLBuilder();
        this.killSwitch = new KillSwitchFilter();
        this.targetStrategy = new SmartTargetStrategy();
    }

    log(msg) {
        if (this.logger) this.logger(msg);
    }

    async logHunterEvent(type, details) {
        try {
            const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
            await this.bikesDB.runQuery(`
                INSERT INTO hunter_events (type, source, details)
                VALUES (?, ?, ?)
            `, [type, 'UnifiedHunter', detailsStr]);
        } catch (e) {
            this.log(`⚠️ Failed to log hunter event: ${e.message}`);
        }
    }

    async ensureInitialized() {
        await this.bikesDB.ensureInitialized();
    }

    async checkFMVCoverage(brand, model, tier = 'Budget') {
        try {
            // Count records in market_history for this brand/model
            const result = await this.bikesDB.getQuery(`
                SELECT COUNT(*) as count 
                FROM market_history 
                WHERE brand = ? 
                  AND (model LIKE ? OR title LIKE ?)
            `, [brand, `%${model}%`, `%${model}%`]);
            
            const count = result ? result.count : 0;

            // Dynamic Threshold (Task 2)
            const thresholds = {
                'Budget': 5,      // < 1500
                'Mid-range': 10,  // 1500 - 3000
                'Premium': 15,    // 3000 - 6000
                'High-End': 20    // > 6000
            };
            // Fallback to 'Mid-range' if tier unknown
            const threshold = thresholds[tier] || thresholds['Mid-range'] || 10;

            return { count, sufficient: count >= threshold, threshold };
        } catch (e) {
            this.log(`⚠️ FMV Check Error: ${e.message}`);
            return { count: 0, sufficient: false, threshold: 10 };
        }
    }

    async logSkippedTarget(brand, model, coverage) {
        try {
            // Task 4: Use SQLite for Race Condition Safety
            await this.bikesDB.runQuery(`
                INSERT INTO skipped_targets (brand, model, attempts, last_attempt, coverage)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP, ?)
                ON CONFLICT(brand, model) DO UPDATE SET
                attempts = attempts + 1,
                last_attempt = CURRENT_TIMESTAMP,
                coverage = excluded.coverage
            `, [brand, model, coverage]);
        } catch (e) {
            this.log(`⚠️ Failed to log skipped target: ${e.message}`);
        }
    }

    /**
     * Smart Targets Selector (LRS + Category Balancing)
     */
    async getSmartTargets() {
        // Use New Smart Strategy
        const strategyTargets = await this.targetStrategy.generateTargets(100);
        const targets = [];

        for (const t of strategyTargets) {
            targets.push({
                name: `${t.brand} ${t.model} (${t.tier})`,
                urlPattern: this.urlBuilder.buildSearchURL({
                    brand: t.brand,
                    model: t.model,
                    category: t.category,
                    minPrice: t.minPrice,
                    maxPrice: t.maxPrice,
                    shippingRequired: true
                }).replace(/$/g, '?seite={page}'),
                priority: t.priority,
                quota: t.quota || 3, // Default quota 3 per target if not specified
                _meta: t
            });
        }
        
        // Add Local Fallback (Marburg)
        const localBrands = ['Santa Cruz', 'YT', 'Specialized'];
        for (const brand of localBrands) {
             targets.push({
                name: `${brand} Local (Marburg)`,
                urlPattern: this.urlBuilder.buildSearchURL({
                    brand: brand,
                    minPrice: 500,
                    location: 'marburg',
                    shippingRequired: false
                }).replace(/$/g, '?seite={page}'),
                priority: 'high',
                quota: 2,
                _meta: { brand, tier: 'local' }
             });
        }

        return targets;
    }

    async updateSearchStats(brand, category, count = 0) {
        try {
            await this.bikesDB.runQuery(
                `UPDATE search_stats SET last_scanned_at = ?, total_found = total_found + ? WHERE brand = ? AND category = ?`,
                [new Date().toISOString(), count, brand, category]
            );
        } catch (e) {
            this.log(`⚠️ Failed to update stats: ${e.message}`);
        }
    }

    /**
     * Universal URL Constructor based on User's verified patterns (Jan 2026)
     */
    constructUrl({ brand, priceMin, priceMax, page, type, shipping, customSuffix }) {
        let url = 'https://www.kleinanzeigen.de/s-fahrraeder';
        
        // 1. Price Segment (User provided example puts price first: /preis:500:1200/...)
        if (priceMin !== undefined || priceMax !== undefined) {
             const min = priceMin !== undefined ? priceMin : '';
             const max = priceMax !== undefined ? priceMax : '';
             url += `/preis:${min}:${max}`;
        }
        
        // 2. Brand Segment
        if (brand) {
            const brandSlug = brand.toLowerCase().replace(/\s+/g, '-');
            url += `/${brandSlug}`;
        }
        
        // 3. Base Suffix (Brand -> k0c217, No Brand -> c217)
        let suffix = brand ? 'k0c217' : 'c217';
        
        // 4. Attributes (Type, Shipping)
        let attributes = [];
        
        // Type Mapping (User provided: type_s:mountainbike, type_s:rennrad)
        if (type) {
             const typeMap = {
                 'mtb': 'mountainbike',
                 'road': 'rennrad',
                 'emtb': 'pedelec', // deduced, user didn't specify but this is standard
                 'gravel': null // No specific type, use generic or brand
             };
             const val = typeMap[type] || type;
             // Only add if we have a valid mapping (skip for gravel/null)
             if (val && val !== 'null') {
                 attributes.push(`fahrraeder.type_s:${val}`);
             }
        }
        
        // Shipping (User provided: versand_s:ja)
        if (shipping) {
             attributes.push(`fahrraeder.versand_s:ja`);
        }
        
        // Combine attributes with suffix
        if (attributes.length > 0) {
            suffix += '+' + attributes.join('+');
        }
        
        // Allow custom suffix override (for complicated cases)
        if (customSuffix) {
            suffix = customSuffix;
        }

        url += `/${suffix}`;
        
        // 5. Pagination (Query param is safer for bots)
        if (page) {
            url += `?seite=${page}`;
        } else {
             url += `?seite={page}`;
        }
        
        return url;
    }

    buildSmartTemplates(targets) {
        const templates = [];
        const segments = [
            { id: 'A', min: 500, max: 1500 },
            { id: 'B', min: 1500, max: 3000 },
            { id: 'C', min: 3000, max: '' }
        ];

        targets.forEach(t => {
            // Randomly pick one price segment
            const s = segments[Math.floor(Math.random() * segments.length)];
            
            // Use new constructor
            // Smart targets are Brand-Specific
            const urlPattern = this.constructUrl({
                brand: t.brand,
                priceMin: s.min,
                priceMax: s.max,
                // page is placeholder
            });
            
            templates.push({
                name: `${t.brand} ${t.category.toUpperCase()} (${s.id})`,
                urlPattern: urlPattern,
                _meta: t 
            });
        });
        
        return templates;
    }

    isPickupSafe(location) {
        // Marburg is 35037.
        // Safe prefixes: 35, 34, 36, 60, 61, 63, 64, 65, 57
        // Extract ZIP
        const zipMatch = (location || '').match(/\b(\d{5})\b/);
        if (!zipMatch) return false; // Can't verify distance -> Unsafe for pickup-only
        
        const zip = zipMatch[1];
        const prefix2 = zip.substring(0, 2);
        const safe = ['35', '34', '36', '60', '61', '63', '64', '65', '57'];
        return safe.includes(prefix2);
    }

    // FIX R: Smart Funnel Filter
    async applyFunnelFilter(listings) {
        const filtered = [];
        
        for (const listing of listings) {
            
            // ═══════════════════════════════════════════
            // CHECK 1: Стоп-слова (регистронезависимо!)
            // ═══════════════════════════════════════════
            const stopWords = [
            'defekt', 'kaputt', 'broken', 'damaged',
            'rahmen', 'frame only', 'frameset',
            'laufrad', 'laufradsatz', 'laufradzatz', 'wheelset', 'wheels',
            'gabel', 'fork', 'federgabel',
            'dämpfer', 'shock', 'rear shock',
            'sattel', 'saddle', 'sitz', 'seat',  // ← case-insensitive!
            'lenker', 'handlebar', 'bar',
            'pedale', 'pedals',
            'bremse', 'brake', 'scheibenbremse',
            'schaltung', 'shifter', 'derailleur',
            'kassette', 'cassette',
            'kette', 'chain',
            'reifen', 'tire', 'tyre',
            'tretlager', 'bottom bracket'
            ];
            
            const titleLower = listing.title.toLowerCase();
            let stopWordFound = false;

            for (const word of stopWords) {
                if (titleLower.includes(word)) {
                    console.log(`[FILTER] ❌ Stop-word detected: "${word}" in "${listing.title}"`);
                    stopWordFound = true;
                    break;
                }
            }
            if (stopWordFound) continue;
            
            // ═══════════════════════════════════════════
            // CHECK 2: Цена (safety net, хотя в URL уже есть)
            // ═══════════════════════════════════════════
            const price = this.parsePriceEUR(listing.price) || 0;
            if (price < 500) {
                console.log(`[FILTER] ❌ Price < €500: ${listing.title}`);
                continue;
            }
            
            if (price > 8000) {
                console.log(`[FILTER] ❌ Price > €8000: ${listing.title}`);
                continue;
            }
            
            // ═══════════════════════════════════════════
            // CHECK 3: Слишком короткий title (вероятно запчасть)
            // ═══════════════════════════════════════════
            if (listing.title.length < 20) {
                console.log(`[FILTER] ❌ Title too short: "${listing.title}"`);
                continue;
            }
            
            // ═══════════════════════════════════════════
            // CHECK 4: "Набор запчастей" паттерны
            // ═══════════════════════════════════════════
            const partsPatterns = [
                /\bteile\b/i,           // "Teile"
                /\bparts\b/i,           // "Parts"
                /\bset\b/i,             // "Set" (но не в "Frameset")
                /\bkomponenten\b/i,     // "Komponenten"
                /\bkit\b/i,             // "Kit" (если не "Bike Kit")
                /\bzubeh[öo]r\b/i       // "Zubehör"
            ];
            
            let partsPatternFound = false;
            for (const pattern of partsPatterns) {
                if (pattern.test(titleLower) && !titleLower.includes('bike')) {
                    console.log(`[FILTER] ❌ Parts pattern: ${listing.title}`);
                    partsPatternFound = true;
                    break;
                }
            }
            if (partsPatternFound) continue;
            
            // ✅ Прошёл все проверки
            filtered.push(listing);
        }
        
        console.log(`[FILTER] ${filtered.length}/${listings.length} passed`);
        return filtered;
    }

    // FIX #4: Pre-Filter
    cheapPreFilter(item) {
        const title = (item.title || '').toLowerCase();
        const price = this.parsePriceEUR(item.price) || 0;
        
        // 1. Kill Switch patterns
        const killPatterns = [
            /\b(rahmen|rahmenset)\b/,      // only frame
            /\b(suche|gesucht|wtb)\b/,     // wanted
            /\b(defekt|kaputt)\b/,         // broken
            /\b(bastler|projekt)\b/,       // project
            /\b(ersatzteil|teile)\b/,      // parts
            /\b(tausch|trade)\b/,          // trade
            /\bnur\s+\w+\b/,               // "only ..."
            // Parts patterns (FIX #7)
            /\b(laufradsatz|laufräder|laufrad|laufradzatz|laufradsazz)\b/,  // + опечатки
            /\b(wheelset|wheels|wheel)\b/,
            /\b(gabel|fork|federgabel)\b/,
            /\b(dämpfer|shock|rear\s*shock)\b/,
            /\b(sattel|saddle|sitz)\b/,
            /\b(lenker|handlebar|vorbau|stem)\b/,
            /\b(pedale|pedals|klickpedale)\b/,
            /\b(bremse|brake|scheibenbremse|disc\s*brake)\b/,
            /\b(schaltung|shifter|derailleur)\b/,
            /\b(kassette|cassette|kette|chain)\b/,
            /\b(rahmenkit|framekit|frameset)\b/  // + рамы с комплектом
        ];
        
        for (const pattern of killPatterns) {
            if (pattern.test(title)) {
                return { pass: false, reason: `kill_switch: ${pattern.source}` };
            }
        }
        
        // 2. Sanity check price
        if (price < 500) return { pass: false, reason: 'price_too_low' };
        if (price > 15000) return { pass: false, reason: 'price_suspicious_high' };
        
        // 3. Short title
        if (title.length < 10) return { pass: false, reason: 'title_too_short' };
        
        return { pass: true };
    }

    /**
     * UNIFIED HUNTER - SMART MODE (FIX T Integration)
     */
    async startHunt(config = {}) {
        const { totalBikes = 100 } = config;
        
        this.log('🤖 UNIFIED HUNTER - SMART MODE\n');
        
        // ✅ Generate Smart Targets
        const targets = await this.targetStrategy.generateTargets(totalBikes);
        
        this.log(`Generated ${targets.length} targets\n`);
        
        let processedCount = 0;
        let publishedCount = 0;
        
        // Sort by priority (higher first)
        targets.sort((a, b) => b.priority - a.priority);
        
        for (const target of targets) {
            this.log(`\n${'═'.repeat(60)}`);
            this.log(`🎯 Target: ${target.brand} ${target.model}`);
            this.log(`   Category: ${target.category}`);
            this.log(`   Price: €${target.minPrice}-€${target.maxPrice}`);
            this.log(`   Priority: ${target.priority}/10\n`);
            
            // ✅ Build URL
            const url = this.urlBuilder.buildSearchURL({
                brand: target.brand,
                model: target.model,
                category: target.category,
                minPrice: target.minPrice,
                maxPrice: target.maxPrice
            });
            
            this.log(`[URL] ${url}\n`);
            
            // Collect Data
            const listings = await this.fetchMarketData(url, target.category);
            
            if (!listings || listings.length === 0) {
                this.log('⚠️  No listings found. Skipping...');
                continue;
            }
            
            // Filter
            const filtered = await this.applyFunnelFilter(listings);
            
            // Process
            for (const listing of filtered) {
                const success = await this.processListing(listing.link);
                
                if (success) {
                    publishedCount++;
                    
                    // Check tier target
                    const currentTierCount = await this.getPublishedCountForTier(target.tier);
                    const targetTierCount = (this.targetStrategy.priceDistribution[target.tier].target_percentage * totalBikes) / 100;
                    
                    if (currentTierCount >= targetTierCount) {
                        this.log(`✅ Tier ${target.tier} target reached (${currentTierCount}/${targetTierCount})`);
                        break;
                    }
                }
                
                processedCount++;
                
                if (publishedCount >= totalBikes) {
                    this.log('\n🎉 Total target reached!');
                    return;
                }
                
                // Small delay
                await new Promise(r => setTimeout(r, 5000));
            }
            
            // Delay between targets
            await new Promise(r => setTimeout(r, 2000));
        }
        
        this.log(`\n${'═'.repeat(60)}`);
        this.log('🏁 HUNT COMPLETE');
        this.log(`Processed: ${processedCount}`);
        this.log(`Published (approx): ${publishedCount}/${totalBikes}\n`);
    }

    async getPublishedCountForTier(tier) {
        const tierConfig = this.targetStrategy.priceDistribution[tier];
        try {
            const result = await this.bikesDB.getQuery(`
                SELECT COUNT(*) as count 
                FROM bikes 
                WHERE is_active = 1 
                  AND price BETWEEN ? AND ? 
                  AND created_at > datetime('now', '-1 day')
            `, [tierConfig.min, tierConfig.max]);
            
            return result ? result.count : 0;
        } catch (e) {
            this.log(`⚠️ Error getting tier count: ${e.message}`);
            return 0;
        }
    }

    /**
     * Core Hunting Logic (Hunter 7.0)
     * @param {Object} options
     * @param {string} options.category - 'mtb', 'road', 'emtb', etc.
     * @param {number} options.quota - How many bikes to add
     * @param {Object} options.filters - { minPrice, maxPrice, customQuery }
     */
    async hunt(options) {
        const { category = 'MTB', quota = 50, maxTargets = null, maxRuntimeMs = null } = options || {};
        this.log(`[HUNTER] 🏹 Starting Hunt: ${category}`);

        const startedAt = Date.now();
        const hasTimedOut = () => maxRuntimeMs && (Date.now() - startedAt) > maxRuntimeMs;

        const targets = await this.getSmartTargets();
        const targetList = Number.isFinite(maxTargets) ? targets.slice(0, Math.max(0, maxTargets)) : targets;
        let processedCount = 0;
        let stopEarly = false;

        for (const target of targetList) {
            if (processedCount >= quota || stopEarly) break;
            if (hasTimedOut()) {
                this.log(`[HUNTER] ⏱️ Max runtime reached (${maxRuntimeMs}ms). Stopping early.`);
                break;
            }

            this.log(`[HUNTER] 🎯 ${target.name}`);
            this.log(`[HUNTER] 🔗 ${target.urlPattern}`); // urlPattern holds the URL

            // Use fetchMarketData to get items from the specific URL
            // We need to modify fetchMarketData or use a direct approach here
            // The user snippet used this.fetchMarketData(target.url) returning items
            // Let's adapt fetchMarketData to handle this
            const items = await this.fetchMarketData(target.urlPattern, category);
            
            if (!items || !Array.isArray(items)) {
                this.log(`[HUNTER] ⚠️ No items returned for ${target.name}`);
                continue;
            }

            // Apply Smart Funnel Filter
            const filteredItems = await this.applyFunnelFilter(items);

            // Process according to quota
            const itemsToProcess = filteredItems.slice(0, target.quota);

            for (const item of itemsToProcess) {
                if (hasTimedOut()) {
                    this.log(`[HUNTER] ⏱️ Max runtime reached (${maxRuntimeMs}ms) during processing.`);
                    stopEarly = true;
                    break;
                }
                // Pre-Filter (Double check not strictly needed if applyFunnelFilter works, but cheapPreFilter returns reason)
                // Let's rely on applyFunnelFilter for rejection logic.
                // However, we still need to process.
                
                // Process Single Listing
                const success = await this.processListing(item.link);
                if (success) {
                    processedCount++;
                    if (processedCount >= quota) {
                        stopEarly = true;
                        break;
                    }
                    // Delay
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        }

        this.log(`[HUNTER] ✅ Smart Hunt Complete: ${processedCount} bikes processed`);
    }

    /**
     * Silent Collector / Fetch Helper
     * If 'urlOrCount' is a URL (string starting with http), it fetches items from that URL.
     * If 'urlOrCount' is a number, it behaves as the old Silent Collector (scanning segments).
     */
    async fetchMarketData(urlOrCount, category = 'MTB', brand = 'Canyon') {
        // Mode 1: Fetch from specific URL (New Logic)
        if (typeof urlOrCount === 'string' && urlOrCount.startsWith('http')) {
            const url = urlOrCount.replace('{page}', '1'); // Default to page 1 if not specified
            // this.log(`[HUNTER] 🔎 Fetching items from: ${url}`);
            
            try {
                await this.logHunterEvent('INFO', `Starting fetch from URL: ${url}`);
                const html = await this.fetchHtml(url);
                const items = this.parseSearchItems(html);
                
                if (items.length > 0) {
                     // Log for Silent Collector compliance even in this mode
                     this.log('[HUNTER] [SILENT COLLECTOR] Starting market data collection...');
                     
                     let savedCount = 0;
                     let skippedCount = 0;
                     
                     // Use new saveToMarketHistory for each item
                     for (const item of items) {
                         const price = this.parsePriceEUR(item.price);
                         const brandExtracted = this.extractBrandFromTitle(item.title);
                         
                         if (brandExtracted) {
                             await this.saveToMarketHistory({ ...item, price }, category);
                             savedCount++;
                         } else {
                             skippedCount++;
                         }
                     }
                     
                     this.log(`[HUNTER] [SILENT COLLECTOR] Saved ${savedCount} items to history.`);
                     this.log(`[HUNTER] [SILENT COLLECTOR] Skipped ${skippedCount} items (no brand detected).`);
                     
                     // DEBUG: Show examples of saved brands
                     if (savedCount > 0) {
                        try {
                            // Using direct DB access if possible, or try-catch wrapper
                            // bikesDB is BikesDatabaseNode which wraps better-sqlite3 or sqlite3
                            // BikesDatabaseNode exposes runQuery/allQuery/getQuery.
                            // We need to check how to get distinct brands.
                            // Assuming bikesDB has allQuery method.
                            
                            const recentBrands = await this.bikesDB.allQuery(`
                                SELECT DISTINCT brand 
                                FROM market_history 
                                ORDER BY created_at DESC 
                                LIMIT 5
                            `);
                            
                            if (recentBrands && recentBrands.length > 0) {
                                this.log(`[HUNTER] [SILENT COLLECTOR] Recent brands: ${recentBrands.map(b => b.brand).join(', ')}`);
                            }
                        } catch (err) {
                            // Ignore debug error
                        }
                     }
                }
                
                return items;
            } catch (e) {
                this.log(`❌ Fetch Error: ${e.message}`);
                return [];
            }
        }

        // Mode 2: Silent Collector (Old Logic - scanning segments)
        const count = urlOrCount;
        this.log('[HUNTER] [SILENT COLLECTOR] Starting market data collection...');
        this.log(`🌊 Silent Collector: Sourcing ${count} items for ${brand}...`);
        
        let collected = 0;
        const brandSlug = brand.toLowerCase().replace(/\s+/g, '-');
        
        // Price Segments for Deep Coverage
        const segments = [
            { id: 'A', min: 500, max: 1000 },
            { id: 'B', min: 1000, max: 2500 },
            { id: 'C', min: 2500, max: '' }
        ];

        for (const segment of segments) {
            if (collected >= count) break;
            
            this.log(`   📊 Scanning Segment ${segment.id} (${segment.min}-${segment.max || '∞'}€)`);
            let page = 1;
            let emptyPages = 0;

            while (collected < count && page <= 5 && emptyPages < 2) {
                // Use Universal Constructor
                const url = this.constructUrl({
                    brand: brand,
                    priceMin: segment.min,
                    priceMax: segment.max,
                    page: page
                });
                
                this.log(`   📄 Parsing Page ${page}: ${url}`);

                try {
                    // 1. Get Search Page
                    let html = '';
                    try {
                        html = await this.fetchHtml(url);
                    } catch (e) {
                        this.log(`   ⚠️ Fetch error: ${e.message}`);
                        break;
                    }

                    // 2. Parse Items
                    const items = this.parseSearchItems(html);
                    
                    if (items.length === 0) {
                        emptyPages++;
                        page++;
                        continue;
                    }
                    
                    // Log raw history
                    await this.bikesDB.logMarketHistory(items);

                    // 3. Process Items
                    for (const item of items) {
                        if (collected >= count) break;

                        // Check duplicates
                        const exists = await this.bikesDB.getBikeByOriginalUrl(item.link);
                        if (exists) continue;

                        // Quick Price Validation
                        const price = this.parsePriceEUR(item.price);
                        if (price < 500) continue;

                        // Description Fetch (Lightweight)
                        let description = '';
                        try {
                            const detailHtml = await this.fetchHtml(item.link);
                            const $ = cheerio.load(detailHtml);
                            description = $('#viewad-description-text').text().trim();
                        } catch (e) {
                            this.log(`     ⚠️ Failed to fetch detail: ${e.message}`);
                            continue;
                        }

                        if (!description) continue;

                        // 3. Static Decode & Validation (TechDecoder)
                        const decoded = techDecoder.decode(item.title, description);
                        
                        // CRITICAL: Category Validation
                        if (!decoded.isBike) {
                            this.log(`     ⛔️ Rejected (${decoded.reason}): ${item.title}`);
                            continue;
                        }

                        // 4. AI Enrichment (Lightweight)
                        const aiData = await this.enrichMarketData(item.title, description, decoded);
                        
                        const record = {
                            brand: brand,
                            model: aiData.model || item.title, // Fallback
                            title: item.title,
                            price_eur: price,
                            year: aiData.year || decoded.year,
                            frame_material: aiData.material || decoded.material,
                            wheel_size: aiData.wheelSize || decoded.wheelSize,
                            source_url: item.link,
                            scraped_at: new Date().toISOString()
                        };

                        if (aiData.isBike) {
                            // DEPRECATED: market_history write removed (Sprint 11)
                            // FMVOrchestrator handles this now.
                            collected++;
                            if (collected % 5 === 0) this.log(`     ✅ Collected ${collected}/${count}`);
                        }
                    }
                    
                    page++;
                    // Random delay
                    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

                } catch (e) {
                    this.log(`   ❌ Error on page ${page}: ${e.message}`);
                    break;
                }
            }
        }
        
        this.log(`[HUNTER] [SILENT COLLECTOR] Saved ${collected} items to history.`);
        this.log(`🏁 Silent Collector finished. Total collected: ${collected}`);
        return collected;
    }

    async enrichMarketData(title, description, decoded) {
        // Prepare prompt
        const prompt = `
        Analyze this bike listing. Return JSON ONLY.
        Title: "${title}"
        Description: "${description.slice(0, 500)}..."
        
        Task: Extract specs. 
        - isBike: boolean (false if it's a part, frame only, or looking for bike)
        - year: number (null if unknown)
        - material: "Carbon" | "Alloy" | "Steel" | "Titanium" (null if unknown)
        - wheelSize: "29", "27.5", "26" (null if unknown)
        - model: string (clean model name without brand)

        Context hints (already decoded): ${JSON.stringify(decoded)}
        `;

        try {
            const jsonStr = await this.geminiProcessor.generateJson(prompt);
            return JSON.parse(jsonStr);
        } catch (e) {
            return decoded; // Fallback to static decoder
        }
    }

    async processListing(url) {
        this.log(`🚀 Processing: ${url}`);
        
        try {
            // 1. Fetch & Parse
            const rawData = await this.parser.parseKleinanzeigenLink(url);
            this.log(`[HUNTER][SOURCE] Найдено объявление: ${rawData.title}`);
            
            // --- SPRINT 1.5: KILL-SWITCH SHIELD ---
            const killVerdict = this.killSwitch.evaluate(rawData);
            if (killVerdict.shouldKill) {
                this.log(`🛡️ SHIELD ACTIVATED: Blocked "${rawData.title}" -> ${killVerdict.reason}`);
                // Optional: Save to DB as 'killed' to prevent re-scan? 
                // For now, just return false to save tokens.
                // We might want to log this in system_logs if needed.
                return false;
            }

            const validation = techDecoder.validateBike(rawData.title, rawData.description);
            if (!validation.isBike) {
                this.log(`⛔️ Rejected (${validation.reason}): ${rawData.title}`);
                return false;
            }

            // 2. Check Status / Screenshots
            // We use checkKleinanzeigenStatus to get screenshots AND structured text
            const screenshotsDir = path.resolve(__dirname, 'screenshots');
            // Ensure screenshots directory exists
            try { require('fs').mkdirSync(screenshotsDir, { recursive: true }); } catch (e) {}

            this.log('[HUNTER] Check Status: Running capture...');
            const vis = await checkKleinanzeigenStatus(url, { headless: true, screenshotsDir, postLoadDelayMs: 2000 });
            
            // MERGE PUPPETEER GALLERY (More robust than static parser)
            if (vis && vis.structuredData && Array.isArray(vis.structuredData.gallery) && vis.structuredData.gallery.length > 0) {
                this.log(`[HUNTER] 📸 Puppeteer found ${vis.structuredData.gallery.length} images (Merging...)`);
                // Merge unique images
                const existing = new Set(rawData.images || []);
                vis.structuredData.gallery.forEach(img => {
                    if (!existing.has(img)) {
                        rawData.images = rawData.images || [];
                        rawData.images.push(img);
                        existing.add(img);
                    }
                });
            }

            const slices = (vis && vis.slices) || [];
            if (slices.length === 0 && vis.telegramPhotoPath) slices.push(vis.telegramPhotoPath);
            
            if (slices.length === 0) {
                this.log('⚠️ No screenshots captured. Skipping.');
                return false;
            }

            // 3. Gemini Analysis (Multimodal)
            this.log('[HUNTER][AI_ANALYSIS] Отправка в Gemini (Project N)...');
            
            const ctx = {
                originalUrl: url,
                title: rawData.title,
                description: rawData.description,
                price: rawData.price,
                location: rawData.location,
                structuredSnapshot: vis ? vis.structuredData : null
            };

            let imgData = {};
            try {
                // Wrap Gemini call in RateLimiter (it might trigger API limits too, though less likely than scraping)
                if (slices.length >= 2) {
                    imgData = await this.geminiProcessor.processBikeDataFromTwoShots(slices[0], slices[1], ctx);
                } else {
                    imgData = await this.geminiProcessor.processBikeDataFromImages(slices, ctx);
                }
            } catch (e) {
                if (e.message.includes('isBike=false')) {
                    this.log('⛔️ Gemini says: Not a bike. Skipping.');
                    return false;
                }
                this.log(`⚠️ Gemini Error: ${e.message}`);
                imgData = ctx; // Fallback
            }

            const finalData = await this.geminiProcessor.finalizeUnifiedData(rawData, imgData);

            // ═══════════════════════════════════════════
            // STAGE 8: ARBITER (Data Merge)
            // ═══════════════════════════════════════════
            const arbiterResult = this.arbiter.validate(rawData, finalData);

            if (arbiterResult.needsReview) {
                this.log('[HUNTER] ❌ Arbiter blocked. Manual review required.');
                return false;
            }

            this.log('[HUNTER] ✅ Arbiter: Data Integrity Verified.');

            // ═══════════════════════════════════════════
            // CREATE MERGED LISTING (ВАЖНО: СРАЗУ после Arbiter!)
            // ═══════════════════════════════════════════
            const mergedListing = {
                ...rawData,
                ...finalData,
                ...arbiterResult.data
            };

            // Ensure images are passed correctly
            mergedListing.images = rawData.images || [];

            this.log('[DEBUG] Valuation input:', {
                brand: mergedListing.brand,
                model: mergedListing.model,
                year: mergedListing.year
            });

            // ═══════════════════════════════════════════
            // STAGE 9: CONDITION ANALYZER
            // ═══════════════════════════════════════════
            const techSpecs = techDecoder.decode(mergedListing.title, mergedListing.description);
            const conditionReport = await this.conditionAnalyzer.analyzeBikeCondition(
                slices, 
                mergedListing.description, 
                techSpecs
            );

            Object.assign(mergedListing, {
                condition_grade: conditionReport.grade,
                condition_score: conditionReport.score,
                condition_penalty: conditionReport.penalty,
                condition_reason: conditionReport.reason,
                condition_defects: conditionReport.defects,
                condition_positives: conditionReport.positive_notes,
                needs_review: conditionReport.needs_review
            });

            this.log(`[HUNTER] [VISUAL JUDGE] Score: ${conditionReport.score}/10 (Grade ${conditionReport.grade}). Penalty: ${(conditionReport.penalty*100).toFixed(0)}%`);

            // ═══════════════════════════════════════════
            // STAGE 10: VALUATION (Sprint 3: Intelligent Valuation)
            // ═══════════════════════════════════════════
            let fmvData = null;
            try {
                fmvData = await this.valuationService.calculateFMVWithDepreciation(
                    mergedListing.brand || techSpecs.brand,
                    mergedListing.model || techSpecs.model,
                    mergedListing.year || techSpecs.year,
                    mergedListing.trim_level // Pass if available
                );

                if (fmvData) {
                    this.log(`[DEBUG] FMV result: ${fmvData.fmv} (Confidence: ${fmvData.confidence})`);
                }
            } catch (e) {
                this.log(`[HUNTER] ⚠️ Valuation Error: ${e.message}`);
            }

            // ═══════════════════════════════════════════
            // STAGE 11: SNIPER RULE & DECISION
            // ═══════════════════════════════════════════
            let is_active = 0;
            let priority = 'normal';
            let margin = 0;
            const currentPrice = Number(mergedListing.price || 0);
            const fmv = (typeof fmvData === 'object' && fmvData !== null) ? fmvData.fmv : fmvData;

            if (!fmv || fmv === null) {
                // Task 3: Opportunistic Learning Mode (Jackpot Check)
                const isJackpot = await this.checkJackpotCandidate(mergedListing);
                if (isJackpot.isHit) {
                    this.log(`[HUNTER] 🎰 JACKPOT CANDIDATE detected (No FMV): ${isJackpot.reason}`);
                    await this.saveToManualReview(mergedListing, isJackpot.reason);
                    await this.sendManualReviewAlert(mergedListing, isJackpot.reason);
                    return false; // Saved to review, stop processing here (or continue with is_active=0?)
                    // The user code says "return" in the snippet.
                    // But in my structure I usually save to DB at the end.
                    // If I return here, I skip STAGE 15 (DB SAVE).
                    // BUT saveToManualReview saves to 'needs_manual_review' table.
                    // So returning here is correct to avoid double saving or saving to 'bikes' table prematurely.
                } 
                
                this.log('[HUNTER] ⛔️ Rejected: No FMV data available');
                return false; // Skip saving to bikes table
            } 
            
            // We have FMV
            const profit = fmv - currentPrice;
            margin = profit / currentPrice;
            const discount = (profit / fmv) * 100;
            
            this.log(`[HUNTER] 📊 Deal Analysis:
     Price: €${currentPrice}
     FMV: €${fmv}
     Profit: €${profit.toFixed(0)}
     Margin: ${(margin * 100).toFixed(1)}%
     Discount: ${discount.toFixed(1)}%`);
            
            // Sprint 3 Logic: Discount >= 25% AND Confidence != LOW
            if (discount >= 25 && fmvData.confidence !== 'LOW') {
                 is_active = 1;
                 priority = 'high';
                 this.log(`[HUNTER] 🔥 HOT DEAL! ${discount.toFixed(0)}% below FMV. Auto-Publish.`);
            } else {
                 is_active = 0; // Hold for review
                 this.log('[HUNTER] ⏸  Held for review (Discount < 25% or Low Confidence)');
            }

            // ═══════════════════════════════════════════
            // STAGE 12: HOTNESS SCORE
            // ═══════════════════════════════════════════
            let hotnessScore = 0;
            if (fmv && currentPrice && margin > 0) {
                const profit = fmv - currentPrice;
                const publishDate = new Date(mergedListing.publishDate || Date.now());
                const hoursAlive = Math.max(0.5, (Date.now() - publishDate.getTime()) / 3600000);
                const views = mergedListing.views || 0;
                
                hotnessScore = (profit * (views + 1)) / (hoursAlive + 0.5);
                this.log(`[HUNTER] 🔥 Hotness Score: ${hotnessScore.toFixed(0)}`);
                
                if (hotnessScore > 1000 && margin >= 0.30) {
                    priority = 'ultra_high';
                    this.log('[HUNTER] 🚨 ULTRA-HOT DEAL! Immediate action required');
                    await this.sendHotnessAlert(mergedListing, hotnessScore, fmvData, conditionReport);
                }
            }

            // ═══════════════════════════════════════════
            // STAGE 13: SALVAGE VALUE
            // ═══════════════════════════════════════════
            let salvageValue = 0;
            if (mergedListing.condition_grade === 'C' || mergedListing.condition_grade === 'D') {
                const componentPrices = {
                    'suntour durolux': 400,
                    'marzocchi roco': 300,
                    'shimano xt': 280,
                    'shimano xtr': 450,
                    'sram gx eagle': 320,
                    'sram x01 eagle': 450,
                    'sram xx1 eagle': 600,
                    'fox 36 factory': 650,
                    'fox 38 factory': 750,
                    'fox 40': 800,
                    'rockshox lyrik': 500,
                    'rockshox zeb': 550,
                    'dt swiss': 400,
                    'hope pro': 350,
                    'industry nine': 450,
                    'chris king': 500
                };
                
                const description = (mergedListing.description || '').toLowerCase();
                
                for (const [component, value] of Object.entries(componentPrices)) {
                    if (description.includes(component)) {
                        salvageValue += value * 0.65;
                    }
                }
                
                if (salvageValue > 0) {
                    this.log(`[HUNTER] 💎 Salvage potential: €${salvageValue.toFixed(0)}`);
                    
                    if (salvageValue > currentPrice) {
                        if (priority === 'normal') priority = 'high';
                        this.log('[HUNTER] 🏆 SALVAGE GEM! Parts worth more than asking price!');
                    }
                }
            }

            // ═══════════════════════════════════════════
            // STAGE 14: DECISION
            // ═══════════════════════════════════════════
            this.log(`[HUNTER] 💾 Saving to DB: ${mergedListing.brand} ${mergedListing.model} (Active: ${is_active})`);

            // ═══════════════════════════════════════════
            // STAGE 15: DB SAVE
            // ═══════════════════════════════════════════
            const dbData = {
                name: mergedListing.title || rawData.title,
                brand: mergedListing.brand || 'Unknown',
                model: mergedListing.model || 'Unknown',
                price: currentPrice,
                category: mergedListing.category || 'Other',
                description: mergedListing.description,
                year: mergedListing.year,
                frame_material: mergedListing.frameMaterial,
                size: mergedListing.frameSize,
                wheel_diameter: mergedListing.wheelDiameter,
                condition_status: 'used',
                is_active: is_active,
                priority: priority,
                original_url: url,
                images: [],
                source: 'AutoHunter',
                location: mergedListing.location,
                is_negotiable: mergedListing.isNegotiable ? 1 : 0,
                discipline: mergedListing.discipline,
                seller_name: mergedListing.sellerName,
                seller_type: mergedListing.sellerType,
                seller_member_since: mergedListing.sellerMemberSince,
                seller_badges_json: mergedListing.sellerBadges,
                
                condition_score: mergedListing.condition_score,
                condition_grade: mergedListing.condition_grade,
                condition_penalty: mergedListing.condition_penalty,
                condition_reason: mergedListing.condition_reason,
                condition_defects: mergedListing.condition_defects ? JSON.stringify(mergedListing.condition_defects) : null,
                condition_positives: mergedListing.condition_positives ? JSON.stringify(mergedListing.condition_positives) : null,
                
                needs_audit: (mergedListing.needs_review || (mergedListing.confidence_score && mergedListing.confidence_score < 70)) ? 1 : 0,
                
                hotness_score: hotnessScore,
                views_count: mergedListing.views,
                publish_date: mergedListing.publishDate,
                
                confidence_score: mergedListing.confidence_score || 0,
                salvage_value: salvageValue,
                is_salvage_gem: salvageValue > currentPrice ? 1 : 0,
                fmv: fmv,
                
                shipping_option: rawData.deliveryOption || 'unknown',
                guaranteed_pickup: (this.isPickupSafe(mergedListing.location) && rawData.deliveryOption === 'pickup-only') ? 1 : 0
            };

            const savedBike = await this.bikesDB.addBike(dbData);
            this.log(`[HUNTER] [HUNTER][DB] Запись в каталог успешна. ID: ${savedBike.lastID}. Статус: ${is_active ? 'PUBLISHED' : 'LAKE_ONLY'}.`);
            await this.logHunterEvent('SUCCESS', { 
                action: is_active ? 'PUBLISHED' : 'SAVED_TO_LAKE', 
                id: savedBike.lastID, 
                title: dbData.name, 
                price: dbData.price,
                fmv: dbData.fmv
            });

            // ═══════════════════════════════════════════
            // STAGE 16: IMAGE DOWNLOAD
            // ═══════════════════════════════════════════
            const imagesToDownload = mergedListing.images || [];
            if (imagesToDownload.length > 0) {
                this.log(`[HUNTER] 🖼️ Downloading ${imagesToDownload.length} images...`);
                try {
                    if (savedBike.updated) {
                        await this.bikesDB.clearBikeImages(savedBike.id);
                    }
                    
                    // Use PhotoManager for ImageKit upload
                    const processedImages = await this.photoManager.downloadAndSave(savedBike.id, imagesToDownload);
                    const localPaths = processedImages.map(img => img.local_path); // local_path is ImageKit URL

                    if (localPaths.length > 0) {
                        await this.bikesDB.addBikeImages(savedBike.id, localPaths);
                        await this.bikesDB.updateBike(savedBike.id, { main_image: localPaths[0] });
                        this.log(`[HUNTER] ✅ Images saved: ${localPaths.length} (ImageKit)`);
                    }
                } catch (err) {
                    this.log(`[HUNTER] ❌ Image download failed: ${err.message}`);
                }
            }

            return true;

        } catch (e) {
            this.log(`❌ Processing Failed: ${e.message}`);
            return false;
        }
    }

    async checkJackpotCandidate(listing) {
        const price = listing.price || 0;
        const title = (listing.title || '').toLowerCase();
        const description = (listing.description || '').toLowerCase();

        // Task 3: Jackpot Safety Checks (False Positives)
        // 1. Cracks/Defects
        if (description.includes('riss') || description.includes('crack') || description.includes('defekt') || description.includes('broken')) {
            return { isHit: false, reason: 'Defect detected' };
        }
        // 2. Kids Bikes
        if (description.includes('kinder') || title.includes('kinder') || title.includes('kids') || title.includes('24"') || title.includes('20"')) {
            return { isHit: false, reason: 'Kids bike detected' };
        }
        // 3. Stolen/Suspicious (often "no papers", "cash only" - simpler to just check "stolen" or "gestohlen" though rare in description)
        if (description.includes('gestohlen') || description.includes('stolen')) {
             return { isHit: false, reason: 'Stolen keyword' };
        }

        // Rule 1: Premium Brand & Low Price
        const premiumBrands = ['santa cruz', 'yeti', 'specialized s-works', 'pivot', 'transition', 'forbidden', 'ibis', 'evil'];
        const isPremium = premiumBrands.some(b => title.includes(b) || (listing.brand && listing.brand.toLowerCase().includes(b)));
        
        if (isPremium && price < 1500 && price > 300) {
             return { isHit: true, reason: `Premium Brand (${listing.brand}) < 1500€` };
        }

        // Rule 2: High Value Components
        const highValueKeywords = ['axs', 'xtr', 'kashima', 'factory', 'oohlins', 'fox 40', 'carbon'];
        const keywordHits = highValueKeywords.filter(k => title.includes(k) || description.includes(k));
        
        if (keywordHits.length >= 2 && price < 1200 && price > 300) {
            return { isHit: true, reason: `High Spec (${keywordHits.join(', ')}) < 1200€` };
        }

        // Rule 3: Very Low Price for Carbon (Generic)
        if ((title.includes('carbon') || description.includes('carbon')) && price < 800 && price > 200) {
             return { isHit: true, reason: 'Carbon Bike < 800€' };
        }

        return { isHit: false };
    }

    async saveToManualReview(listing, reason) {
        try {
            await this.bikesDB.runQuery(`
                INSERT OR IGNORE INTO needs_manual_review (title, brand, model, price, url, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `, [listing.title, listing.brand, listing.model, listing.price, listing.originalUrl || listing.source_url, reason]);
        } catch (e) {
            this.log(`⚠️ Failed to save to manual review: ${e.message}`);
        }
    }

    async sendManualReviewAlert(bike, reason) {
        try {
            const botToken = process.env.BOT_TOKEN;
            const chatId = process.env.ADMIN_CHAT_ID;
            
            if (!botToken || !chatId) return;
            
            const text = `
🎰 <b>JACKPOT CANDIDATE (No FMV)</b>

🚲 <b>${bike.brand} ${bike.model}</b>
💰 <b>Цена:</b> ${bike.price}€
❓ <b>Причина:</b> ${reason}

🧠 <b>Оценка ИИ:</b> ${bike.condition_grade || '?'}
🔗 <a href="${bike.originalUrl || bike.source_url}">Ссылка на объявление</a>
            `.trim();

            const axios = require('axios');
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            });
        } catch (e) {
            this.log(`⚠️ Failed to send alert: ${e.message}`);
        }
    }

    async sendHotnessAlert(bike, score, fmvData, conditionReport) {
        try {
            const botToken = process.env.BOT_TOKEN;
            const chatId = process.env.ADMIN_CHAT_ID;
            
            if (!botToken || !chatId) {
                this.log('⚠️ Missing BOT_TOKEN or ADMIN_CHAT_ID for Hotness Alert');
                return;
            }
            
            const profit = Math.round(fmvData.finalPrice - bike.price);
            const profitPercent = Math.round((profit / bike.price) * 100);
            
            const text = `
🔥 <b>ALARM: ОБНАРУЖЕН СВЕРХ-ЛИКВИДНЫЙ ЛОТ!</b>

🚲 <b>${bike.brand} ${bike.model}</b>
💰 <b>Цена:</b> ${bike.price}€
📊 <b>FMV:</b> ${fmvData.finalPrice}€ (Profit: +${profit}€ / +${profitPercent}%)
📈 <b>Hotness Score:</b> ${score}
👁 <b>Просмотры:</b> ${bike.views || '?'} (за ${bike.publishDate ? Math.round((Date.now() - new Date(bike.publishDate))/3600000*10)/10 : '?'} ч)

🧠 <b>Оценка ИИ:</b> ${conditionReport.grade} (${conditionReport.score}/10)
🔗 <a href="${bike.originalUrl}">Ссылка на объявление</a>
            `.trim();

            const axios = require('axios');
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "⚡️ МГНОВЕННЫЙ ВЫКУП", callback_data: `instant_buy:${bike.sourceAdId || 'unknown'}` }],
                        [{ text: "🔍 ПОСМОТРЕТЬ В ТМА", url: bike.originalUrl }],
                        [{ text: "❌ ИГНОРИРОВАТЬ", callback_data: `ignore_hotness:${bike.sourceAdId || 'unknown'}` }]
                    ]
                }
            });
            this.log(`🚨 ALARM Sent for ${bike.brand} ${bike.model} (Score: ${score})`);

        } catch (e) {
            this.log(`❌ Failed to send Hotness Alert: ${e.message}`);
        }
    }

    /**
     * Unified Cleanup Logic
     * @param {Object} options
     * @param {number} options.limit - Max bikes to check (0 for all)
     * @param {Function} options.onProgress - Callback(msg) for real-time logs
     */
    async checkAndCleanup(options = {}) {
        const { limit = 0, onProgress } = options;
        const log = (msg) => {
            this.log(msg);
            if (onProgress) onProgress(msg);
        };

        log('🧹 Unified Cleanup: Starting...');
        await this.ensureInitialized();

        // Get bikes to check
        let bikes = [];
        if (limit > 0) {
            log(`🧹 Fetching ${limit} least recently checked active bikes...`);
            bikes = await this.bikesDB.getLeastRecentlyCheckedBikes(limit);
        } else {
            log('🧹 Fetching ALL active bikes...');
            bikes = await this.bikesDB.allQuery(
                'SELECT * FROM bikes WHERE is_active = 1 AND original_url LIKE "%kleinanzeigen%"'
            );
        }
        
        const maxBikes = bikes.length;
        log(`🧹 Checking ${maxBikes} active bikes...`);

        let deletedCount = 0;
        const screenshotsDir = path.resolve(__dirname, 'screenshots');
        try { require('fs').mkdirSync(screenshotsDir, { recursive: true }); } catch (e) {}

        for (let i = 0; i < maxBikes; i++) {
            const bike = bikes[i];
            const url = bike.original_url;
            
            log(`🔍 Checking (${i + 1}/${maxBikes}) ID ${bike.id}: ${url}`);

            try {
                // Check Status
                let vis = await checkKleinanzeigenStatus(url, { headless: true, screenshotsDir, postLoadDelayMs: 2000 });
                
                // Retry with slowMo if failed
                if (!vis || (!vis.slices?.length && !vis.telegramPhotoPath)) {
                    vis = await checkKleinanzeigenStatus(url, { headless: true, screenshotsDir, postLoadDelayMs: 2000, slowMo: 50 });
                }

                const deleted = Boolean(vis && vis.dom && vis.dom.hasGelöscht);
                const reserved = Boolean(vis && vis.dom && vis.dom.hasReserviert);

                // Price Check
                try {
                    const parsed = await this.parser.parseKleinanzeigenLink(url);
                    const newPrice = Number(parsed && parsed.price);
                    
                    if (Number.isFinite(newPrice) && newPrice > 0 && newPrice !== bike.price) {
                        const oldPrice = bike.price;
                        await this.bikesDB.updateBike(bike.id, { price: newPrice });
                        log(`💸 Price changed: ${oldPrice} -> ${newPrice}€`);
                        // TODO: Trigger Price Drop Notifications here
                    }
                } catch (e) { /* ignore price parse error */ }

                if (deleted) {
                    log(`❌ Bike ${bike.id} is deleted/sold. Deactivating...`);
                    await this.bikesDB.setBikeActive(bike.id, false);
                    // Move to recent deliveries (simplified)
                    await this.bikesDB.addRecentDelivery({
                        bikeId: bike.id,
                        price: bike.price,
                        status: 'Снято'
                    });
                    deletedCount++;
                } else if (reserved) {
                    log(`⛔️ Bike ${bike.id} is reserved.`);
                    await this.bikesDB.updateBike(bike.id, { is_reserviert: 1 });
                } else {
                    log(`✅ Bike ${bike.id} is active.`);
                    await this.bikesDB.markBikeChecked(bike.id);
                }

                // Small delay
                await new Promise(r => setTimeout(r, 2000));

            } catch (e) {
                log(`⚠️ Error checking bike ${bike.id}: ${e.message}`);
            }
        }

        log(`✅ Cleanup Finished. Deactivated ${deletedCount} bikes.`);
    }

    // --- Helpers ---
    async fetchHtml(url) {
        return await this.rateLimiter.execute(async () => {
            const axios = require('axios');
            const { HttpsProxyAgent } = require('https-proxy-agent');
            
            const proxyUrl = 'http://user258350:otuspk@191.101.73.161:8984';
            const agent = new HttpsProxyAgent(proxyUrl);

            // Random User Agents
            const uas = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
            ];
            const ua = uas[Math.floor(Math.random() * uas.length)];

            try {
                const res = await axios.get(url, {
                    httpsAgent: agent,
                    proxy: false,
                    headers: { 
                        'User-Agent': ua,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Referer': 'https://www.kleinanzeigen.de/',
                        'Cache-Control': 'max-age=0',
                        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-User': '?1',
                        'Sec-Fetch-Dest': 'document'
                    },
                    timeout: 10000,
                    validateStatus: status => status < 500
                });
                
                if (res.status === 403 || res.status === 429) {
                    throw new Error(`Blocked: ${res.status}`);
                }
                return res.data;
            } catch (err) {
                if (err.response) {
                    // Log details of 500 error
                    const status = err.response.status;
                    const data = err.response.data;
                    // If html, take snippet
                    const snippet = typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data);
                    throw new Error(`Request failed with ${status}. Snippet: ${snippet}`);
                }
                throw err;
            }
        });
    }

    parseSearchItems(html) {
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const items = [];
        
        // Try multiple selectors
        let adItems = $('.aditem');
        if (adItems.length === 0) {
            adItems = $('.ad-listitem');
        }
        if (adItems.length === 0) {
            adItems = $('article.aditem');
        }

        adItems.each((i, el) => {
            const $el = $(el);
            const linkEl = $el.find('.aditem-main--middle--price-shipping--price').closest('a'); // Try to find link near price or title
            const titleEl = $el.find('.text-module-begin > a');
            
            let link = titleEl.attr('href') || $el.data('href') || $el.find('a[href*="/s-anzeige/"]').attr('href');
            let title = titleEl.text().trim() || $el.find('h2').text().trim();
            let price = $el.find('.aditem-main--middle--price-shipping--price').text().trim() || $el.find('.aditem-main--middle--price').text().trim();
            let location = $el.find('.aditem-main--top--left').text().trim() || $el.find('.aditem-main--top--left').text().trim();

            if (link && title) {
                const fullUrl = link.startsWith('http') ? link : `https://www.kleinanzeigen.de${link}`;
                items.push({ title, price, link: fullUrl, location });
            }
        });
        return items;
    }

    parsePriceEUR(s) {
        const t = String(s || '').replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(/,(?=\d{2}\b)/g, '.');
        const m = t.match(/(\d+(?:\.\d+)?)/);
        return m ? Math.round(parseFloat(m[1])) : 0;
    }

    async saveToMarketHistory(item, category) {
        // Extract brand from title
        const brand = this.extractBrandFromTitle(item.title);
        
        if (!brand) {
            // Do not save if brand is unknown
            return;
        }
        
        const model = this.extractModelFromTitle(item.title, brand);
        const price = this.parsePriceEUR(item.price);
        
        // Use INSERT OR IGNORE to handle duplicates gracefully
        try {
            await this.bikesDB.runQuery(
                `INSERT OR IGNORE INTO market_history 
                (brand, model, price_eur, title, source_url, created_at, scraped_at, category) 
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
                [brand, model, price, item.title, item.link, category || 'MTB']
            );
        } catch(e) {
            // Only log if it's NOT a constraint error
            if (!e.message.includes('UNIQUE constraint')) {
                console.error('Error logging market history item:', e.message);
            }
        }
    }

    extractBrandFromTitle(title) {
        const brandAliases = {
            'Santa Cruz': ['santa cruz', 'santa-cruz', 'santacruz', 'sc bikes'],
            'YT': ['yt industries', 'yt-industries', 'yt bikes', 'yt '],
            'Specialized': ['specialized', 's-works', 'sworks'],
            'Canyon': ['canyon'],
            'Pivot': ['pivot'],
            'Trek': ['trek'],
            'Giant': ['giant'],
            'Scott': ['scott'],
            'Cube': ['cube'],
            'Propain': ['propain'],
            'Rose': ['rose', 'rosebikes'],
            'Commencal': ['commencal'],
            'Transition': ['transition'],
            'Evil': ['evil bikes', 'evil'],
            'Intense': ['intense'],
            'Yeti': ['yeti cycles', 'yeti']
        };
        
        const titleLower = title.toLowerCase();
        
        for (const [brand, aliases] of Object.entries(brandAliases)) {
            for (const alias of aliases) {
                // Search for whole word (with boundaries)
                const regex = new RegExp(`\\b${alias}\\b`, 'i');
                if (regex.test(titleLower)) {
                    return brand;
                }
            }
        }
        
        return null;
    }

    extractModelFromTitle(title, brand) {
        // Remove brand from title
        let cleanTitle = title.replace(new RegExp(brand, 'gi'), '').trim();
        
        // Remove junk
        cleanTitle = cleanTitle
            .replace(/\b(mtb|mountainbike|fahrrad|bike|fully|hardtail)\b/gi, '')
            .replace(/\b(xl|l|m|s|xs|rahmen|frame)\b/gi, '')
            .replace(/\b\d{2,4}[\s]*€?\b/g, '') // prices
            .replace(/\b(29|27\.5|26|28|zoll)\b/gi, '') // wheel sizes
            .replace(/[^\w\s-]/g, '') // special chars
            .trim();
        
        // Take first 2-3 words
        const words = cleanTitle.split(/\s+/).filter(w => w.length > 2);
        return words.slice(0, 3).join(' ').trim() || 'Unknown Model';
    }

    buildTemplates(category) {
        // Sprint 22: Strict Brand-Based Hunting
        const segments = [
            { id: 'A', min: 500, max: 1000 },
            { id: 'B', min: 1000, max: 2500 },
            { id: 'C', min: 2500, max: '' }
        ];
        
        const templates = [];

        // Helper to collect brands for a broad category
        const getBrandsForCategory = (cat) => {
            const brands = new Set();
            if (cat === 'mtb') {
                BRAND_MODELS['MTB DH'].brands.forEach(b => brands.add(b));
                BRAND_MODELS['MTB Enduro'].brands.forEach(b => brands.add(b));
                BRAND_MODELS['MTB Trail'].brands.forEach(b => brands.add(b));
                BRAND_MODELS['MTB XC'].brands.forEach(b => brands.add(b));
            } else if (cat === 'road') {
                BRAND_MODELS['Road Aero'].brands.forEach(b => brands.add(b));
                BRAND_MODELS['Road Endurance'].brands.forEach(b => brands.add(b));
                BRAND_MODELS['Road Climbing'].brands.forEach(b => brands.add(b));
                BRAND_MODELS['Road TT/Triathlon'].brands.forEach(b => brands.add(b));
            } else if (cat === 'gravel') {
                BRAND_MODELS['Gravel Race'].brands.forEach(b => brands.add(b));
                BRAND_MODELS['Gravel All-road'].brands.forEach(b => brands.add(b));
                BRAND_MODELS['Gravel Bikepacking'].brands.forEach(b => brands.add(b));
            } else if (cat === 'emtb') {
                BRAND_MODELS['eMTB'].brands.forEach(b => brands.add(b));
            }
            return Array.from(brands);
        };

        const targetBrands = getBrandsForCategory(category);

        targetBrands.forEach(brand => {
            segments.forEach(s => {
                // Use Universal Constructor
                // We pass 'type' to ensure we filter e.g. only MTBs for Canyon
                // For Gravel, type is null (generic), relying on Brand
                const urlPattern = this.constructUrl({
                    brand: brand,
                    priceMin: s.min,
                    priceMax: s.max,
                    type: category // e.g. 'mtb' -> 'fahrraeder.type_s:mountainbike'
                });

                templates.push({
                    name: `${brand} ${category.toUpperCase()} (${s.id})`,
                    urlPattern: urlPattern
                });
            });
        });

        return templates;
    }
}

module.exports = UnifiedHunter;
