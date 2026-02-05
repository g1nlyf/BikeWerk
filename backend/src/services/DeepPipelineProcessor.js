/**
 * DEEP PIPELINE PROCESSOR
 * 
 * Migrated logic from telegram-bot/unified-hunter.js
 * handles deep analysis, AI filtering, and listing processing.
 */

const path = require('path');
const cheerio = require('cheerio');
const DatabaseManager = require('../../database/db-manager');

// Legacy / External Dependencies (Proxied from telegram-bot)
const KleinanzeigenParser = require('../../../telegram-bot/kleinanzeigen-parser');
const GeminiProcessor = require('../../../telegram-bot/gemini-processor');
// const DiversityManager = require('../../../telegram-bot/DiversityManager'); // Not strictly needed for core pipeline yet
const ConditionAnalyzer = require('../../../telegram-bot/ConditionAnalyzer');
const ArbiterService = require('../../../telegram-bot/ArbiterService');
const KillSwitchFilter = require('../../../telegram-bot/KillSwitchFilter');
const { checkKleinanzeigenStatus } = require('../../../telegram-bot/status-checker');

let geminiClient;
try {
    // Try both TS loc (if ts-node) and Dist loc
    try {
        geminiClient = require('../../../telegram-bot/autocat-klein/src/lib/geminiClient.ts').geminiClient;
    } catch {
        geminiClient = require('../../../telegram-bot/autocat-klein/dist/autocat-klein/src/lib/geminiClient.js').geminiClient;
    }
} catch (e) {
    console.log('NOTICE: Multi-key Gemini client not available.');
}

// Canonical Backend Services - CORRECTED RELATIVE PATHS
const ValuationService = require('./ValuationService');
const techDecoder = require('./TechDecoder');
const PhotoManager = require('./PhotoManager');
const DatabaseServiceV2 = require('../../services/database-service-v2');

class DeepPipelineProcessor {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.dbService = new DatabaseServiceV2(this.dbManager.dbPath);

        // Initialize helpers
        this.parser = new KleinanzeigenParser();
        this.photoManager = new PhotoManager();

        // Gemini Setup
        const geminiKey = process.env.GEMINI_API_KEY || '';
        const geminiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-pro-preview:generateContent';
        this.geminiProcessor = new GeminiProcessor(geminiKey, geminiUrl);
        try {
            if (geminiClient) {
                this.geminiProcessor.setMultiKeyClient(geminiClient);
                console.log('✅ DeepPipeline: Multi-key Gemini client attached');
            }
        } catch (e) {
            console.log(`⚠️ DeepPipeline: Failed to attach multi-key client: ${e.message}`);
        }

        this.conditionAnalyzer = new ConditionAnalyzer(this.geminiProcessor, techDecoder);
        this.valuationService = new ValuationService(this.dbManager);
        this.arbiter = new ArbiterService();
        this.killSwitch = new KillSwitchFilter();
    }

    log(msg) {
        console.log(`[DeepPipeline] ${msg}`);
    }

    /**
     * Fetch Market Data (Silent Collector Mode)
     */
    async fetchMarketData(url, category = 'MTB') {
        // Simple fetch if URL
        if (typeof url === 'string' && url.startsWith('http')) {
            try {
                this.log(`🔎 Fetching: ${url}`);
                const html = await this.parser.fetchHtml(url);
                const items = this.parser.parseSearchItems(html);
                return items;
            } catch (e) {
                this.log(`❌ Fetch Error: ${e.message}`);
                return [];
            }
        }
        return [];
    }

    /**
     * Apply Funnel Filter (Stop words, price sanity, etc.)
     */
    async applyFunnelFilter(listings) {
        const filtered = [];
        this.log(`Running Funnel Filter on ${listings.length} items...`);

        for (const listing of listings) {
            // Use Cheap Pre-Filter logic
            const preCheck = this.cheapPreFilter(listing);
            if (!preCheck.pass) {
                continue;
            }
            filtered.push(listing);
        }

        this.log(`[FILTER] ${filtered.length}/${listings.length} passed`);
        return filtered;
    }

    cheapPreFilter(item) {
        const title = (item.title || '').toLowerCase();

        let price = item.price;
        if (typeof price === 'string') {
            price = parseFloat(price.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        }

        // 1. Kill Switch patterns
        const killPatterns = [
            /\b(rahmen|rahmenset)\b/,      // only frame
            /\b(suche|gesucht|wtb)\b/,     // wanted
            /\b(defekt|kaputt)\b/,         // broken
            /\b(bastler|projekt)\b/,       // project
            /\b(ersatzteil|teile)\b/,      // parts
            /\b(tausch|trade)\b/,          // trade
            /\bnur\s+\w+\b/,               // "only ..."
            /\b(laufradsatz|laufräder|laufrad)\b/,
            /\b(gabel|fork|federgabel)\b/,
            /\b(dämpfer|shock)\b/,
            /\b(sattel|saddle)\b/,
            /\b(lenker|handlebar)\b/
        ];

        for (const pattern of killPatterns) {
            if (pattern.test(title)) {
                return { pass: false, reason: `kill_switch: ${pattern.source}` };
            }
        }

        // 2. Sanity check price
        if (price < 300) return { pass: false, reason: 'price_too_low' };
        if (price > 15000) return { pass: false, reason: 'price_suspicious_high' };

        // 3. Short title
        if (title.length < 10) return { pass: false, reason: 'title_too_short' };

        return { pass: true };
    }

    /**
     * Process a single listing URL through the full Deep Pipeline
     * @returns {Promise<boolean>} success
     */
    async processListing(url) {
        this.log(`🚀 Processing Deep Analysis: ${url}`);

        try {
            // 1. Parse Initial Data
            const rawData = await this.parser.parseKleinanzeigenLink(url);
            if (!rawData) {
                this.log('❌ Failed to parse listing');
                return false;
            }

            // 2. Kill Switch Shield
            const killVerdict = this.killSwitch.evaluate(rawData);
            if (killVerdict.shouldKill) {
                this.log(`🛡️ SHIELD ACTIVATED: Blocked "${rawData.title}" -> ${killVerdict.reason}`);
                return false;
            }

            const validation = techDecoder.validateBike(rawData.title, rawData.description);
            if (!validation.isBike) {
                this.log(`⛔️ Rejected (${validation.reason}): ${rawData.title}`);
                return false;
            }

            // 3. Capture Status & Screenshots
            const screenshotsDir = path.resolve(__dirname, '../../../telegram-bot/screenshots');
            try { require('fs').mkdirSync(screenshotsDir, { recursive: true }); } catch (e) { }

            const vis = await checkKleinanzeigenStatus(url, { headless: true, screenshotsDir, postLoadDelayMs: 2000 });

            // Merge Puppeteer Gallery
            if (vis && vis.structuredData && Array.isArray(vis.structuredData.gallery)) {
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
                this.log('⚠️ No screenshots captured. Skipping AI analysis.');
                if (!rawData.images || rawData.images.length === 0) return false;
            }

            // 4. Gemini Analysis
            this.log('[AI] Running Gemini Analysis...');
            const ctx = {
                originalUrl: url,
                title: rawData.title,
                description: rawData.description,
                price: rawData.price,
                location: rawData.location
            };

            let imgData = {};
            try {
                if (slices.length >= 2) {
                    imgData = await this.geminiProcessor.processBikeDataFromTwoShots(slices[0], slices[1], ctx);
                } else if (slices.length === 1) {
                    imgData = await this.geminiProcessor.processBikeDataFromImages(slices, ctx);
                } else {
                    imgData = ctx;
                }
            } catch (e) {
                this.log(`⚠️ Gemini Error: ${e.message}`);
                imgData = ctx;
            }

            const finalData = await this.geminiProcessor.finalizeUnifiedData(rawData, imgData);

            // 5. Arbiter Validation
            const arbiterResult = this.arbiter.validate(rawData, finalData);
            if (arbiterResult.needsReview) {
                this.log('[ARBITER] ❌ Blocked. Needs manual review.');
                return false;
            }

            // 6. Merge Data
            const mergedListing = {
                ...rawData,
                ...finalData,
                ...arbiterResult.data
            };
            mergedListing.images = rawData.images || [];

            // 7. Condition Analysis
            const techSpecs = techDecoder.decode(mergedListing.title, mergedListing.description);
            const analysisImages = slices.length > 0 ? slices : mergedListing.images.slice(0, 3);

            const conditionReport = await this.conditionAnalyzer.analyzeBikeCondition(
                analysisImages,
                mergedListing.description,
                techSpecs
            );

            Object.assign(mergedListing, {
                condition_grade: conditionReport.grade,
                condition_score: conditionReport.score,
                condition_penalty: conditionReport.penalty,
                condition_reason: conditionReport.reason,
                condition_defects: conditionReport.defects
            });

            // 8. Valuation (FMV)
            let fmvData = null;
            try {
                fmvData = await this.valuationService.calculateFMVWithDepreciation(
                    mergedListing.brand,
                    mergedListing.model,
                    mergedListing.year
                );
            } catch (e) {
                this.log(`⚠️ Valuation Error: ${e.message}`);
            }

            const fmv = fmvData ? fmvData.fmv : 0;
            const currentPrice = Number(mergedListing.price || 0);

            // 9. Decision Logic (Is Active?)
            let is_active = 0;
            let priority = 'normal';

            if (fmv > 0) {
                const profit = fmv - currentPrice;
                const discount = (profit / fmv) * 100;

                if (discount >= 20) {
                    is_active = 1;
                    priority = 'high';
                    if (discount > 30) priority = 'ultra_high';
                }
            }

            // 10. Save to Database
            // Convert Legacy to Unified V2
            try {
                const unifiedData = this.mapToUnified(mergedListing, fmv, is_active, priority);
                const result = this.dbService.insertBike(unifiedData);

                if (result && result.changes > 0) {
                    const savedId = result.lastInsertRowid;
                    this.log(`✅ Saved Bike ID: ${savedId} (${is_active ? 'PUBLISHED' : 'LAKE'})`);

                    // 11. Image Download
                    if (mergedListing.images.length > 0) {
                        this.log(`🖼️ Downloading ${mergedListing.images.length} images...`);
                        const processedImages = await this.photoManager.downloadAndSave(savedId, mergedListing.images);

                        if (processedImages && processedImages.length > 0) {
                            const mainImg = processedImages[0].local_path;
                            this.dbManager.getDatabase().prepare('UPDATE bikes SET main_image = ? WHERE id = ?').run(mainImg, savedId);
                        }
                    }
                    return true;
                }
            } catch (saveErr) {
                this.log(`❌ DB Save Error: ${saveErr.message}`);
                console.error(saveErr);
            }

            return false;

        } catch (e) {
            this.log(`❌ Critical Error: ${e.message}`);
            console.error(e);
            return false;
        }
    }

    /**
     * Maps Legacy Hunter Data to Unified Schema V2
     */
    mapToUnified(data, fmv, isActive, priority) {
        const safeStr = (v) => v || '';
        const safeNum = (v) => Number(v) || 0;

        return {
            basic_info: {
                name: safeStr(data.title),
                brand: safeStr(data.brand),
                model: safeStr(data.model),
                year: safeNum(data.year),
                category: safeStr(data.category),
                sub_category: '', // unknown from hunter
                breadcrumb: '',
                description: safeStr(data.description),
                language: 'de'
            },
            pricing: {
                price: safeNum(data.price),
                original_price: 0,
                discount: 0,
                currency: 'EUR',
                is_negotiable: data.isNegotiable ? 1 : 0,
                buyer_protection_price: 0,
                fmv: safeNum(fmv),
                fmv_confidence: safeStr(data.confidence_score),
                market_comparison: '',
                days_on_market: 0
            },
            condition: {
                status: 'used',
                condition_score: safeNum(data.condition_score),
                condition_grade: safeStr(data.condition_grade),
                visual_rating: 0,
                functional_rating: 0,
                receipt_available: 0,
                crash_history: 0,
                frame_damage: 0,
                issues: data.condition_defects || []
            },
            seller: {
                type: safeStr(data.sellerType),
                name: safeStr(data.sellerName),
                rating: 0,
                rating_visual: 0,
                last_active: '',
                trust_score: 0,
                verified: 0,
                reviews_count: 0,
                reviews_source: ''
            },
            location: {
                city: safeStr(data.location),
                country: 'DE',
                shipping_cost: 0,
                is_pickup_available: 1,
                international: 0
            },
            media: {
                main_image: '',
                gallery: data.images || [],
                photo_quality: 0
            },
            scoring: {
                ranking_score: 0,
                value_score: 0,
                demand_score: 0,
                urgency_score: 0,
                is_hot_offer: priority === 'high' ? 1 : 0,
                is_super_deal: priority === 'ultra_high' ? 1 : 0,
                tier: ''
            },
            specs: {
                frame_size: safeStr(data.size || data.frameSize),
                wheel_size: safeStr(data.wheel_diameter || data.wheelSize),
                frame_material: safeStr(data.frame_material || data.frameMaterial),
                // ... populate as needed
                color: null, weight: null, suspension_type: null, travel_front: null, travel_rear: null,
                groupset: null, shifting_type: null, drivetrain: null, brakes: null, brakes_type: null,
                groupset_speeds: null, cassette: null, tires_front: null, tires_rear: null,
                handlebars_width: null, stem_length: null, seatpost_travel: null, pedals_included: 0,
                fork: null, shock: null
            },
            meta: {
                source_platform: 'kleinanzeigen',
                source_ad_id: safeStr(data.external_id),
                source_url: safeStr(data.original_url || data.originalUrl),
                parser_version: 'hunter_v7',
                is_active: isActive,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_checked_at: new Date().toISOString()
            },
            json_fields: {
                unified_data: null, specs: null, features: null, inspection: null,
                seller: null, logistics: null, media: null, ranking: null,
                ai_analysis: null, market_data: null, component_upgrades: null
            },
            quality_metrics: {
                quality_score: 0, completeness: 0, views: safeNum(data.views_count || data.views)
            }
        };
    }
}

module.exports = new DeepPipelineProcessor();
