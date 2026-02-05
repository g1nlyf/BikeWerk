const nodeCron = require('node-cron');
const KleinanzeigenParser = require('./kleinanzeigen-parser');
const BuycycleParser = require('./BuycycleParser');
const GeminiProcessor = require('./gemini-processor');
const BikesDatabase = require('./bikes-database-node');
const ScoringService = require('./ScoringService');
const DiversityManager = require('./DiversityManager');
const UniversalLogger = require('./UniversalLogger');
const SupplyGapAnalyzer = require('./SupplyGapAnalyzer');
const ProfitCalculator = require('./ProfitCalculator');
const LifecycleManager = require('./LifecycleManager');
const AdminBotService = require('./AdminBotService');
const UnifiedHunter = require('./unified-hunter');
const { geminiClient } = require('./autocat-klein/dist/autocat-klein/src/lib/geminiClient.js');

const { BRAND_MODELS } = require('./BrandConstants');

class AutonomousOrchestrator {
    constructor(botInstance = null) {
        this.logger = new UniversalLogger();
        this.scoring = new ScoringService(new BikesDatabase());
        this.diversity = new DiversityManager();
        this.gapAnalyzer = new SupplyGapAnalyzer();
        this.db = new BikesDatabase();
        this.bot = botInstance;
        this.adminBot = new AdminBotService();
        this.profitCalculator = new ProfitCalculator(this.db);
        
        // Initialize Gemini with MultiKey
        const geminiKey = process.env.GEMINI_API_KEY || '';
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.gemini = new GeminiProcessor(geminiKey, geminiUrl);
        try {
            this.gemini.setMultiKeyClient(geminiClient);
        } catch (e) {
            this.logger.error('Failed to attach MultiKey Client to GeminiProcessor', e);
        }
        
        this.parser = new KleinanzeigenParser();
        this.buycycleParser = new BuycycleParser();
        this.lifecycleManager = new LifecycleManager(this.db, this.bot);

        // Initialize Unified Hunter (Fix #7)
        this.unifiedHunter = new UnifiedHunter({
            logger: (msg) => this.logger.info(`[UnifiedHunter] ${msg}`),
            publishMode: 'catalog'
        });
    }

    logToBot(msg) {
        if (this.bot) {
            // Placeholder for bot integration
        }
        this.logger.info(msg);
    }

    async startCron() {
        this.logger.info('🕒 Starting Autonomous Orchestrator Cron (Every 6 hours)...');
        nodeCron.schedule('0 */6 * * *', async () => {
            this.logger.info('⏰ Cron Trigger: Replenishing Catalog...');
            await this.replenishCatalog(10);
        });

        // Sync Schedules (The Sanitizer Strategy)
        // Hot-объявления (Score > 8.5): Проверка каждые 2 часа.
        nodeCron.schedule('0 */2 * * *', async () => {
            this.logger.info('⏰ Cron Trigger: Lifecycle Hot Items...');
            await this.lifecycleManager.syncBikes('hot');
        });

        // Средние (Score 7-8.5): Каждые 6 часов.
        nodeCron.schedule('0 */6 * * *', async () => {
            this.logger.info('⏰ Cron Trigger: Lifecycle Medium Items...');
            await this.lifecycleManager.syncBikes('medium');
        });

        // Остальные: Раз в 24 часа.
        nodeCron.schedule('0 4 * * *', async () => {
            this.logger.info('⏰ Cron Trigger: Lifecycle All Items...');
            await this.lifecycleManager.syncBikes('all');
        });

        // Sanitizer: Every day at 03:00
        nodeCron.schedule('0 3 * * *', async () => {
            this.logger.info('⏰ Cron Trigger: Running Sanitizer...');
            await this.lifecycleManager.runSanitizer();
        });
    }

    async replenishCatalog(targetCount = 10, interactiveCallback = null) {
        const log = (msg) => {
            this.logger.info(msg);
            if (interactiveCallback) interactiveCallback(msg);
        };

        log(`🚀 Starting Smart Strategic Hunt (Target: ${targetCount})`);

        // Sprint 23: Scan Buycycle High Demand
        await this._scanBuycycleHighDemand(log);

        // 1. Analyze Current Inventory
        const inventoryStats = await this.db.allQuery(`
            SELECT brand, category, COUNT(*) as count 
            FROM bikes 
            WHERE is_active = 1 
            GROUP BY brand, category
        `);
        
        const brandCounts = {};
        const categoryCounts = {};
        inventoryStats.forEach(row => {
            brandCounts[row.brand] = (brandCounts[row.brand] || 0) + row.count;
            categoryCounts[row.category] = (categoryCounts[row.category] || 0) + row.count;
        });

        log(`📊 Current Inventory Analysis:
            Brands: ${JSON.stringify(brandCounts)}
            Categories: ${JSON.stringify(categoryCounts)}
        `);

        // 2. Define Ideal Distribution & Rules
        // Sprint 22: Dynamic Strategies from BRAND_MODELS
        
        // Flatten BRAND_MODELS into a list of targets
        const targetStrategies = [];
        
        Object.entries(BRAND_MODELS).forEach(([catKey, data]) => {
            // Map subcategory to main category
            let mainCat = 'MTB';
            if (catKey.includes('Road')) mainCat = 'Road';
            else if (catKey.includes('Gravel')) mainCat = 'Gravel';
            else if (catKey.includes('eMTB')) mainCat = 'eMTB';
            
            // For each brand in this subcategory, create a strategy
            data.brands.forEach(brand => {
                targetStrategies.push({
                     category: mainCat,
                     brand: brand,
                     priority: 1.0, // Baseline
                     // Use price sweet spots if available, or broad ranges
                     priceRange: { min: 500, max: 8000 } 
                });
            });
        });
        
        // 3. Calculate Needs (Gaps)
        const needs = [];
        // Shuffle strategies to vary the hunt
        const shuffledStrategies = targetStrategies.sort(() => Math.random() - 0.5);
        
        // Add them to needs
        shuffledStrategies.forEach(s => needs.push(s));

        /*
        const targetRatios = {
            category: { 'MTB': 0.6, 'Gravel': 0.2, 'Road': 0.1, 'eMTB': 0.1 },
            brand: { 'Canyon': 0.25, 'YT': 0.20, 'Trek': 0.15, 'Specialized': 0.15, 'Commencal': 0.10, 'Santa Cruz': 0.10, 'Cube': 0.05 }
        };

        const priceSweetSpots = {
            'MTB': { min: 1200, max: 2000 },
            'Gravel': { min: 1000, max: 1800 },
            'Road': { min: 1500, max: 2500 },
            'eMTB': { min: 2000, max: 3500 }
        };

        const unwantedBrands = ['Rocky Mountain']; // Example from user

        // 3. Calculate Needs (Gaps)
        const needs = [];
        const totalBikes = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || 1; // avoid div by 0

        // 3a. Category Gaps
        for (const [cat, ratio] of Object.entries(targetRatios.category)) {
            const currentCount = categoryCounts[cat] || 0;
            const targetForTotal = Math.ceil((totalBikes + targetCount) * ratio);
            const deficit = Math.max(0, targetForTotal - currentCount);
            
            if (deficit > 0) {
                // Distribute deficit across brands
                for (const [brand, brandRatio] of Object.entries(targetRatios.brand)) {
                    if (unwantedBrands.includes(brand)) continue;

                    // Check if this brand is over-represented globally
                    const brandCount = brandCounts[brand] || 0;
                    const brandTarget = Math.ceil((totalBikes + targetCount) * brandRatio);
                    
                    if (brandCount < brandTarget) {
                        needs.push({
                            category: cat,
                            brand: brand,
                            priority: (deficit / targetForTotal) + ((brandTarget - brandCount) / brandTarget), // Higher score = higher priority
                            priceRange: priceSweetSpots[cat]
                        });
                    }
                }
                // Also add a generic brand search for this category to find hidden gems
                needs.push({
                    category: cat,
                    brand: null,
                    priority: (deficit / targetForTotal) * 0.5,
                    priceRange: priceSweetSpots[cat]
                });
            }
        }
        */

        // Sort needs by priority
        // needs.sort((a, b) => b.priority - a.priority);
        
        // Take top strategies to fill the target count
        // We will loop through them until we fill the targetCount
        
        let totalAdded = 0;
        let attempts = 0;
        const maxAttempts = needs.length * 2; // Avoid infinite loops

        while (totalAdded < targetCount && attempts < maxAttempts && needs.length > 0) {
            // Pick a strategy (round-robin or weighted? Let's go top-down but re-sort if needed)
            // Actually, let's just pick the top one, try it, if fails move it to bottom or remove
            const strategy = needs.shift(); 
            attempts++;

            const strategyName = strategy.brand ? `${strategy.brand} ${strategy.category}` : `${strategy.category} (Generic)`;
            log(`🎯 Executing Strategy: ${strategyName} (Priority: ${strategy.priority.toFixed(2)})`);
            log(`   💰 Target Price: ${strategy.priceRange.min}-${strategy.priceRange.max}€`);

            // Construct Filter
            const filter = {
                minPrice: strategy.priceRange.min,
                maxPrice: strategy.priceRange.max,
                category: strategy.category,
                brand: strategy.brand
            };

            // Fetch Candidates
            const candidates = await this._fetchFreshCandidates(15, filter);
            
            if (candidates.length === 0) {
                log(`   -> No fresh candidates found.`);
                continue;
            }

            let addedForStrategy = 0;
            for (const candidate of candidates) {
                if (totalAdded >= targetCount) break;
                if (addedForStrategy >= 2) break; // Don't overfill from one query

                // Brand Limit Check (Local to this run)
                // We trust the strategy generator, but let's be safe
                if (strategy.brand && candidate.brand && candidate.brand !== strategy.brand) {
                    // Mismatch? Ignore or loose match
                }

                const success = await this._processCandidate(candidate, log, strategy.category);
                if (success) {
                    addedForStrategy++;
                    totalAdded++;
                    const modelDisplay = candidate.model_name || candidate.model || 'Model Unknown';
                    log(`✅ Added ${candidate.brand || 'Unknown'} ${modelDisplay} (${totalAdded}/${targetCount})`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            // If we found some but not enough, maybe push back to needs with lower priority?
            // If we found 0, drop it.
            if (addedForStrategy > 0 && totalAdded < targetCount) {
                strategy.priority *= 0.8; // Lower priority next time
                needs.push(strategy);
                needs.sort((a, b) => b.priority - a.priority);
            }
        }
        
        log(`🏁 Smart Hunt Complete. Total Added: ${totalAdded}/${targetCount}`);
        return totalAdded;
    }
    
    async _scanBuycycleHighDemand(log) {
        log('🚲 Scanning Buycycle High Demand...');
        const url = 'https://buycycle.com/de-de/shop/main-types/bikes/bike-types/mountainbike/categories/downhill/high-demand/1';
        
        try {
            const candidates = await this.buycycleParser.parseListing(url);
            if (candidates.length === 0) {
                log('⚠️ No candidates found on Buycycle (Check bot protection?)');
                return;
            }
            
            let added = 0;
            for (const c of candidates) {
                // Infer Brand
                const brand = this._inferBrand(c.title) || 'Unknown';
                // Clean model
                const model = c.title.replace(new RegExp(brand, 'i'), '').trim();

                // Check duplicates
                const exists = await this.db.getQuery('SELECT id FROM market_history WHERE source_url = ?', [c.url]);
                if (!exists) {
                    await this.db.runQuery(`
                        INSERT INTO market_history (brand, model_name, price_eur, source_url, scraped_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `, [brand, model, c.price, c.url]);
                    added++;
                }
            }
            log(`✅ Injected ${added} Buycycle candidates into Market History.`);
        } catch (e) {
            log(`❌ Buycycle Scan Error: ${e.message}`);
        }
    }

    _isCuratedBike(brand, model) {
        if (!brand) return false;
        
        // Normalize
        const b = brand.toLowerCase();
        const m = (model || '').toLowerCase();
        
        // Find brand in list
        let validModels = new Set();
        let brandFound = false;
        
        Object.values(BRAND_MODELS).forEach(cat => {
            if (cat.brands.some(cb => cb.toLowerCase() === b)) {
                brandFound = true;
                cat.models.forEach(cm => validModels.add(cm.toLowerCase()));
            }
        });
        
        if (!brandFound) return false;
        
        // Check if model string contains any of the valid model names
        // Use word boundaries to avoid partial matches (e.g. "Lux" in "Luxury")
        for (const validModel of validModels) {
            // Escape special regex chars if any (though models are usually simple)
            const escaped = validModel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            if (regex.test(m)) return true;
        }
        
        return false;
    }

    async _processCandidate(candidate, log, intendedCategory) {
        const url = candidate.source_url || candidate.url;

        // ---------------------------------------------------------
        // PATH A: UNIFIED HUNTER (Kleinanzeigen) - FIX #7
        // ---------------------------------------------------------
        if (!url.includes('buycycle.com')) {
            try {
                // Ensure initialized
                await this.unifiedHunter.ensureInitialized();
                
                log(`🚀 Delegating to UnifiedHunter 7.0: ${url}`);
                const success = await this.unifiedHunter.processListing(url);
                
                if (success) {
                    log(`✅ UnifiedHunter processed successfully.`);
                    // Optional: Bounty Check
                    try {
                        const dbBike = await this.db.getBikeByOriginalUrl(url);
                        if (dbBike) {
                            const bounties = await this.gapAnalyzer.matchBounty(dbBike);
                            if (bounties.length > 0) {
                                log(`🎯🎯🎯 BOUNTY MATCHED! Bike ID ${dbBike.id} matches ${bounties.length} active orders!`);
                            }
                        }
                    } catch (e) { /* ignore */ }
                    return true;
                }
                return false;
            } catch (e) {
                log(`❌ UnifiedHunter Error: ${e.message}`);
                return false;
            }
        }

        // ---------------------------------------------------------
        // PATH B: BUYCYCLE (Legacy Pipeline)
        // ---------------------------------------------------------
        try {
            log(`🕵️ Deep Analyzing Buycycle: ${candidate.brand || ''} ${candidate.model_name} (${candidate.price_eur}€)...`);

            // A. Deep Scrape (Parser)
            let parsedData = await this.buycycleParser.parseDetail(url);
            
            if (!parsedData) {
                log(`❌ Parsing failed for ${url}`);
                return false;
            }
            
            // Normalize for checks
            parsedData.deliveryOption = 'shipping'; // Buycycle is shipping-first
            if (parsedData.features) {
                parsedData.attributes = Object.values(parsedData.features).filter(Boolean);
            }

            // Check Frameset
            if (parsedData.attributes && parsedData.attributes.some(a => /rahmen|frameset/i.test(a))) {
                 if (/rahmen|frameset|rahmenset/i.test(parsedData.title)) {
                     log(`❌ Detected Frameset/Part (not a complete bike). Skipped.`);
                     return false;
                 }
            }
            
            // STRICT CURATION CHECK (Post-Parse)
            const checkBrand = parsedData.brand || candidate.brand;
            const checkModel = parsedData.model || candidate.model_name || parsedData.title;
            
            if (!this._isCuratedBike(checkBrand, checkModel)) {
                 log(`❌ Not in Curated List: ${checkBrand} ${checkModel}. Skipped.`);
                 return false;
            }

            // B. AI Enrichment
            const rawData = {
                ...candidate,
                ...parsedData,
                price: candidate.price_eur,
                originalUrl: url,
                intendedCategory,
                guaranteed_pickup: false
            };
            
            const enrichedData = await this.gemini.enrichBikeData(rawData);
            
            // LOGGING: AI Analysis Result
            const aiScore = enrichedData.technical_score || enrichedData.conditionScore || 'N/A';
            const aiGrade = enrichedData.class || (typeof aiScore === 'number' && aiScore >= 9 ? 'A' : (typeof aiScore === 'number' && aiScore >= 7 ? 'B' : 'C'));
            
            if (enrichedData.processingError) {
                log(`⚠️ AI Error: ${enrichedData.processingError}`);
            } else {
                log(`🧠 AI Analysis: Grade ${aiGrade} (Score ${aiScore}).`);
            }
            
            if (enrichedData.classificationConfidence < 0.6) {
                log(`❌ Low Confidence (${enrichedData.classificationConfidence}). Skipped.`);
                return false;
            }

            // C. Profit Calculation
            const profitData = await this.profitCalculator.calculateProfit(enrichedData);
            log(`💰 Profit Analysis: ${profitData.profit}€ (Method: ${profitData.method}, FMV: ${profitData.fmv}€)`);
            
            if (profitData.profit <= 0) {
                log(`❌ Negative Profit. Skipped.`);
                return false;
            }

            // D. Final Commitment
            try {
                const dbBike = this._mapToDbSchema(enrichedData, candidate, profitData);
                const result = await this.db.addBike(dbBike);
                
                if (result) {
                    log(`✅ Successfully Added to Catalog (ID: ${result.id})`);
                    
                    if (enrichedData.images && Array.isArray(enrichedData.images)) {
                        await this.db.addBikeImages(result.id, enrichedData.images);
                    }

                    return true;
                } else {
                    log(`❌ DB returned null result.`);
                    return false;
                }
            } catch (dbError) {
                log(`❌ Failed to save bike to DB. Error: ${dbError.message}`);
                return false;
            }

        } catch (e) {
            log(`❌ Pipeline Error: ${e.message}`);
            return false;
        }
    }

    async _fetchFreshCandidates(limit, filters = {}) {
        // Build query for market_history which is our "Lake" of candidates
        let query = `
            SELECT m.* 
            FROM market_history m
            WHERE m.source_url NOT IN (SELECT original_url FROM bikes WHERE original_url IS NOT NULL)
            AND m.price_eur > 0
        `;
        const params = [];
        
        // 1. Brand Filter
        if (filters.brand) {
            query += ` AND m.brand LIKE ?`;
            params.push(`%${filters.brand}%`);
        }
        
        // 2. Price Filter
        if (filters.minPrice) {
            query += ` AND m.price_eur >= ?`;
            params.push(filters.minPrice);
        }
        if (filters.maxPrice) {
            query += ` AND m.price_eur <= ?`;
            params.push(filters.maxPrice);
        }

        // 3. Year Filter (>= 2015)
        // Note: year might be null in market_history if not parsed. We allow nulls to be safe, 
        // or we enforce it if we want strictness. User said "if unknown - add".
        query += ` AND (m.year >= 2015 OR m.year IS NULL OR m.year = 0)`;

        // 4. Category Filter (Keywords)
        if (filters.category) {
            const keywords = this._getKeywordsForCategory(filters.category);
            if (keywords.length > 0) {
                 const likeClauses = keywords.map(() => `(m.title LIKE ? OR m.model LIKE ? OR m.model_name LIKE ?)`).join(' OR ');
                 query += ` AND (${likeClauses})`;
                 keywords.forEach(k => {
                     params.push(`%${k}%`);
                     params.push(`%${k}%`);
                     params.push(`%${k}%`);
                 });
            }
        }

        query += ` ORDER BY m.scraped_at DESC LIMIT ?`;
        params.push(limit);
        
        // If we don't have enough in market_history, we should trigger a fresh scrape
        // But for now, let's assume market_history is populated by the "Silent Collector" or similar process.
        // If this returns empty, the Orchestrator will log "No fresh candidates".
        
        const results = await this.db.allQuery(query, params);
        
        // Tricky part: If results are empty, it might mean we need to SCRAPE more.
        // The current architecture separates "Hunting" (Orchestrator) from "Scraping" (UnifiedHunter/Parser).
        // If we want the Orchestrator to trigger a scrape, we should call UnifiedHunter here.
        
        if (results.length < limit) {
             // Optional: Trigger active scraping if lake is dry
             // this.triggerScrape(filters);
        }

        return results;
    }

    _getKeywordsForCategory(category) {
        const map = {
            'MTB': ['Enduro', 'Trail', 'MTB', 'Mountainbike', 'Fully', 'Hardtail', 'Downhill'],
            'Gravel': ['Gravel', 'Cyclocross', 'Crosser', 'Gravelbike'],
            'Road': ['Road', 'Rennrad', 'Aero', 'Tarmac', 'Ultimate', 'Venge'],
            'eMTB': ['e-bike', 'ebike', 'e-mtb', 'hybrid', 'electric']
        };
        
        // Enrich with curated models from BRAND_MODELS
        let models = [];
        if (category === 'MTB') {
            models = [
                ...BRAND_MODELS['MTB DH'].models, 
                ...BRAND_MODELS['MTB Enduro'].models, 
                ...BRAND_MODELS['MTB Trail'].models, 
                ...BRAND_MODELS['MTB XC'].models
            ];
        } else if (category === 'Road') {
            models = [
                ...BRAND_MODELS['Road Aero'].models, 
                ...BRAND_MODELS['Road Endurance'].models, 
                ...BRAND_MODELS['Road Climbing'].models, 
                ...BRAND_MODELS['Road TT/Triathlon'].models
            ];
        } else if (category === 'Gravel') {
             models = [
                ...BRAND_MODELS['Gravel Race'].models, 
                ...BRAND_MODELS['Gravel All-road'].models, 
                ...BRAND_MODELS['Gravel Bikepacking'].models
             ];
        } else if (category === 'eMTB') {
             models = [...BRAND_MODELS['eMTB'].models];
        }
        
        // Remove duplicates and filter short words
        models = [...new Set(models)].filter(m => m.length > 2);
        
        return [...(map[category] || []), ...models];
    }

    _inferBrand(text) {
        if (!text) return null;
        
        // Collect all brands from BRAND_MODELS dynamically
        const allBrands = new Set();
        Object.values(BRAND_MODELS).forEach(cat => cat.brands.forEach(b => allBrands.add(b)));
        const brands = Array.from(allBrands);
        
        const lower = text.toLowerCase();
        for (const b of brands) {
            // Strict word boundary check would be better but simple includes is safer for now
            if (lower.includes(b.toLowerCase())) return b;
        }
        return null;
    }

    _mapToDbSchema(enriched, candidate, profitData) {
        // Fix: Default to 'B' if score/class is missing, instead of falling through to 'C'
        let grade = enriched.class;
        if (!grade) {
            if (typeof enriched.conditionScore === 'number') {
                grade = enriched.conditionScore >= 9 ? 'A' : (enriched.conditionScore >= 7 ? 'B' : 'C');
            } else {
                grade = 'B'; // Safe default
            }
        }
        
        const score = enriched.technical_score || enriched.conditionScore || 7.0;
        const reason = enriched.condition_reason || enriched.justification || 'Автоматическая оценка состояния временно недоступна. Установлен базовый класс B (Рабочее состояние). Требуется визуальная проверка.';

        return {
            name: enriched.title || candidate.title || 'Unknown Bike',
            description: enriched.description,
            price: enriched.price,
            original_price: candidate.fmv || 0,
            brand: enriched.brand || candidate.brand || 'Unknown',
            model: enriched.model || candidate.model_name || candidate.model || 'Unknown',
            year: enriched.year,
            condition: enriched.condition,
            condition_score: score,
            condition_grade: grade,
            initial_quality_class: grade,
            final_quality_class: grade,
            condition_reason: reason,
            condition_report: enriched,
            size: enriched.frameSize,
            wheel_diameter: enriched.wheelDiameter,
            frame_material: enriched.material || 'unknown',
            main_image: (enriched.images && enriched.images.length > 0) ? enriched.images[0] : null,
            images: enriched.images || [],
            original_url: candidate.source_url,
            is_active: 1,
            category: enriched.category,
            discipline: enriched.discipline,
            source: 'kleinanzeigen',
            location: enriched.location,
            shipping_option: enriched.deliveryOption || 'unknown',
            is_negotiable: enriched.isNegotiable || false,
            features: {
                brakeType: enriched.brakeType,
                suspensionType: enriched.suspensionType,
                groupset: enriched.groupset,
                color: enriched.color,
                profit_projection: profitData // Storing profit data in features JSON
            },
            needs_audit: enriched.classificationConfidence < 0.8 ? 1 : 0,
            
            // Seller Data
            seller_name: enriched.sellerName,
            seller_type: enriched.sellerType,
            seller_member_since: enriched.sellerMemberSince,
            seller_badges_json: enriched.sellerBadges
        };
    }
}

module.exports = AutonomousOrchestrator;
