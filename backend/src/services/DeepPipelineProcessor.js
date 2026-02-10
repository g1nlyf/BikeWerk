/**
 * DEEP PIPELINE PROCESSOR
 * 
 * Migrated logic from telegram-bot/unified-hunter.js
 * handles deep analysis, AI filtering, and listing processing.
 */

const path = require('path');
const cheerio = require('cheerio');
const DatabaseManager = require('../../database/db-manager');
const BuycycleCollector = require('../../scrapers/buycycle-collector');

// Legacy / External Dependencies (Proxied from telegram-bot)
const KleinanzeigenParser = require('../../../telegram-bot/kleinanzeigen-parser');
const BuycycleParser = require('../../../telegram-bot/BuycycleParser');
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
const unifiedNormalizer = require('./UnifiedNormalizer');

class DeepPipelineProcessor {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.dbService = new DatabaseServiceV2(this.dbManager.dbPath);

        // Initialize helpers
        this.parser = new KleinanzeigenParser();
        this.buycycleParser = new BuycycleParser();
        this.buycycleCollector = BuycycleCollector;
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

    resolveSource(url = '') {
        const normalized = String(url || '').toLowerCase();
        if (normalized.includes('buycycle.com')) return 'buycycle';
        if (normalized.includes('kleinanzeigen.de')) return 'kleinanzeigen';
        return 'kleinanzeigen';
    }

    extractSourceAdIdFromUrl(url = '', source = 'kleinanzeigen') {
        const normalized = String(url || '');
        if (!normalized) return '';

        if (source === 'buycycle') {
            const match = normalized.match(/-([0-9]+)(?:[/?#]|$)/);
            return match?.[1] || '';
        }

        const match = normalized.match(/\/([0-9]+)-[0-9]+-[0-9]+(?:[/?#]|$)/);
        return match?.[1] || '';
    }

    async parseListingBySource(url, source) {
        if (source === 'buycycle') {
            const parsed = await this.buycycleCollector.collect(url);
            if (!parsed?.title || !parsed?.brand) {
                const fallback = await this.buycycleParser.parseDetail(url);
                if (fallback) {
                    fallback.originalUrl = fallback.originalUrl || url;
                    fallback.source = fallback.source || 'buycycle';
                }
                return fallback || null;
            }
            if (!parsed) return null;
            const generalMap = this.parseObjectCandidate(parsed.general || parsed.general_info) || {};
            const readGeneral = (...keys) => {
                const normalizedEntries = Object.entries(generalMap).map(([key, value]) => [this.normalizeLookup(key), value]);
                for (const key of keys) {
                    const normalizedKey = this.normalizeLookup(key);
                    const match = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey);
                    if (match && match[1]) return match[1];
                }
                return null;
            };
            const images = Array.isArray(parsed.images) ? parsed.images.filter(Boolean) : [];
            if (parsed.image && !images.includes(parsed.image)) images.unshift(parsed.image);
            const resolvedBrand = parsed.brand || '';
            let resolvedModel = parsed.model || '';
            if (!resolvedModel && parsed.title) {
                const withoutBrand = resolvedBrand
                    ? String(parsed.title).replace(new RegExp(resolvedBrand, 'i'), '')
                    : String(parsed.title);
                resolvedModel = withoutBrand.replace(/\b20\d{2}\b/g, '').trim().replace(/\s+/g, ' ');
            }
            return {
                title: parsed.title || '',
                brand: resolvedBrand,
                model: resolvedModel,
                category: parsed.category || 'Mountain',
                price: Number(parsed.price || 0),
                originalPrice: this.toNullableNumber(parsed.originalPrice ?? parsed.original_price),
                images,
                description: parsed.description || '',
                attributes: [],
                location: parsed.location || '',
                condition: parsed.condition || 'used',
                frameSize: parsed.frameSize || parsed.size || readGeneral('Rahmengroesse', 'Rahmengröße', 'frame size') || null,
                wheelDiameter: parsed.wheelDiameter || parsed.wheelSize || null,
                wheelSize: parsed.wheelSize || parsed.wheel_size || parsed.wheelDiameter || null,
                year: parsed.year || readGeneral('Jahr', 'year') || null,
                isNegotiable: Boolean(parsed.isNegotiable),
                deliveryOption: parsed.deliveryOption || 'available',
                originalUrl: url,
                source: 'buycycle',
                rawHtmlContent: '',
                components: parsed.components || parsed.features || null,
                general_info: parsed.general || parsed.general_info || null,
                frame_material: parsed.frameMaterial || readGeneral('Rahmenmaterial', 'frame material') || null,
                color: parsed.color || readGeneral('Farbe', 'color') || null,
                brakes_type: parsed.brakesType || readGeneral('Bremstyp', 'brake type') || null,
                seller: parsed.seller || null,
                sellerName: parsed.sellerName || parsed.seller?.name || null,
                sellerMemberSince: parsed.sellerMemberSince || null,
                sellerBadges: parsed.sellerBadges || null,
                sellerLastActive: parsed.seller?.last_active || parsed.sellerLastActive || null,
                sellerRating: parsed.seller?.rating || parsed.sellerRating || null,
                sellerReviewsCount: parsed.seller?.reviews_count || parsed.sellerReviewsCount || null,
                sellerRatingVisual: parsed.sellerRatingVisual || null,
                sellerType: parsed.sellerType || parsed.seller?.type || 'private',
                priceBadgeRange: parsed.priceBadgeRange || parsed.price_badge_range || null,
                priceBadgeText: parsed.priceBadgeText || parsed.price_badge_text || null,
                marketComparison: parsed.marketComparison || parsed.priceBadgeRange || null,
                platformReviewsCount: parsed.platformReviewsCount || null,
                platformReviewsSource: parsed.platformReviewsSource || null,
                sourceAdId: parsed.sourceAdId || this.extractSourceAdIdFromUrl(url, 'buycycle'),
                views: Number(parsed.views || 0),
                publishDate: new Date().toISOString()
            };
        }

        return this.parser.parseKleinanzeigenLink(url);
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
            const source = this.resolveSource(url);
            // 1. Parse Initial Data
            const rawData = await this.parseListingBySource(url, source);
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
            // 3. Capture Status & Screenshots (Klein only)
            let slices = [];
            if (source === 'kleinanzeigen') {
                const screenshotsDir = path.resolve(__dirname, '../../../telegram-bot/screenshots');
                try { require('fs').mkdirSync(screenshotsDir, { recursive: true }); } catch (e) { }

                const vis = await checkKleinanzeigenStatus(url, { headless: true, screenshotsDir, postLoadDelayMs: 2000 });

                if (vis && vis.structuredData && Array.isArray(vis.structuredData.gallery)) {
                    const existing = new Set(rawData.images || []);
                    vis.structuredData.gallery.forEach((img) => {
                        if (!existing.has(img)) {
                            rawData.images = rawData.images || [];
                            rawData.images.push(img);
                            existing.add(img);
                        }
                    });
                }

                slices = (vis && vis.slices) || [];
                if (slices.length === 0 && vis?.telegramPhotoPath) slices.push(vis.telegramPhotoPath);
            }

            if (slices.length === 0) {
                this.log('No screenshots captured. Skipping screenshot-based AI analysis.');
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
            if (!finalData.brand && rawData.brand) finalData.brand = rawData.brand;
            if (!finalData.model && rawData.model) finalData.model = rawData.model;
            if ((!finalData.price || Number(finalData.price) <= 0) && rawData.price) finalData.price = rawData.price;
            if (!finalData.originalUrl && rawData.originalUrl) finalData.originalUrl = rawData.originalUrl;
            if (!finalData.category && rawData.category) finalData.category = rawData.category;
            if (!finalData.sub_category && rawData.sub_category) finalData.sub_category = rawData.sub_category;
            if (!finalData.discipline && rawData.discipline) finalData.discipline = rawData.discipline;

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
            // Trust parser-grounded transport/source identifiers over AI guesses.
            if (rawData.deliveryOption) mergedListing.deliveryOption = rawData.deliveryOption;
            if (rawData.sourceAdId) mergedListing.sourceAdId = rawData.sourceAdId;
            if (rawData.originalUrl) mergedListing.originalUrl = rawData.originalUrl;
            if (!mergedListing.frameSize && rawData.frameSize) mergedListing.frameSize = rawData.frameSize;
            if (!mergedListing.wheelDiameter && rawData.wheelDiameter) mergedListing.wheelDiameter = rawData.wheelDiameter;
            if (!mergedListing.sellerType && rawData.sellerType) mergedListing.sellerType = rawData.sellerType;
            if (!mergedListing.location && rawData.location) mergedListing.location = rawData.location;
            if (!mergedListing.originalPrice && rawData.originalPrice) mergedListing.originalPrice = rawData.originalPrice;
            if (!mergedListing.sellerLastActive && rawData.sellerLastActive) mergedListing.sellerLastActive = rawData.sellerLastActive;
            if (!mergedListing.sellerMemberSince && rawData.sellerMemberSince) mergedListing.sellerMemberSince = rawData.sellerMemberSince;
            if (!mergedListing.sellerBadges && rawData.sellerBadges) mergedListing.sellerBadges = rawData.sellerBadges;
            if (!mergedListing.color && rawData.color) mergedListing.color = rawData.color;
            if (!mergedListing.frame_material && rawData.frame_material) mergedListing.frame_material = rawData.frame_material;
            // Preserve parser-grounded rich text/spec blocks for post-merge inference.
            mergedListing.rawDescription = rawData.description || mergedListing.rawDescription || '';
            mergedListing.rawAttributes = rawData.attributes || mergedListing.rawAttributes || [];
            mergedListing.rawComponents = rawData.components || mergedListing.rawComponents || null;
            mergedListing.rawGeneralInfo = rawData.general_info || rawData.general || mergedListing.rawGeneralInfo || null;
            if (!mergedListing.category || !String(mergedListing.category).trim()) {
                this.log('⚠️ Missing category after merge. Skipping listing to avoid invalid DB write.');
                return false;
            }
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
                if (!mergedListing.description_ru && !mergedListing.descriptionRu) {
                    try {
                        const translatedDescription = await this.ensureRussianDescription(mergedListing);
                        if (translatedDescription) {
                            mergedListing.description_ru = translatedDescription;
                            mergedListing.descriptionRu = translatedDescription;
                        }
                    } catch (translateErr) {
                        this.log(`⚠️ RU translation skipped: ${translateErr.message}`);
                    }
                }

                const unifiedData = this.mapToUnified(mergedListing, fmv, is_active, priority, source);
                const savedId = this.dbService.insertBike(unifiedData);

                if (savedId) {
                    if (conditionReport?.reason) {
                        try {
                            this.dbManager
                                .getDatabase()
                                .prepare(
                                    `UPDATE bikes
                                     SET condition_reason = ?,
                                         condition_rationale = ?,
                                         condition_report = ?
                                     WHERE id = ?`
                                )
                                .run(
                                    String(conditionReport.reason),
                                    String(conditionReport.reason),
                                    JSON.stringify(conditionReport || {}),
                                    savedId
                                );
                        } catch (conditionPersistError) {
                            this.log(`Condition rationale persist failed: ${conditionPersistError.message}`);
                        }
                    }
                    this.log(`✅ Saved Bike ID: ${savedId} (${is_active ? 'PUBLISHED' : 'LAKE'})`);

                    // 11. Image Download
                    if (mergedListing.images.length > 0) {
                        this.log(`🖼️ Downloading ${mergedListing.images.length} images...`);
                        const processedImages = await this.photoManager.downloadAndSave(savedId, mergedListing.images);

                        if (processedImages && processedImages.length > 0) {
                            const isManagedImageUrl = (img) =>
                                (typeof img === 'string' && (
                                    /^https:\/\/ik\.imagekit\.io\//i.test(img) ||
                                    img.startsWith('/images/') ||
                                    img.startsWith('images/')
                                ));
                            const allProcessedUrls = processedImages
                                .map((img) => img?.local_path)
                                .filter((img) => typeof img === 'string' && img.length > 0);
                            const galleryUrls = allProcessedUrls.filter(isManagedImageUrl);
                            const mainImg = galleryUrls[0] || processedImages[0].local_path;
                            const db = this.dbManager.getDatabase();

                            db.prepare(
                                `UPDATE bikes
                                 SET main_image = ?,
                                     images = ?,
                                     gallery = ?
                                 WHERE id = ?`
                            ).run(
                                mainImg || null,
                                JSON.stringify(galleryUrls),
                                JSON.stringify(galleryUrls),
                                savedId
                            );

                            try {
                                const current = db.prepare('SELECT media_json, unified_data FROM bikes WHERE id = ?').get(savedId);
                                const parseJson = (value, fallback) => {
                                    try {
                                        if (!value) return fallback;
                                        return typeof value === 'string' ? JSON.parse(value) : value;
                                    } catch {
                                        return fallback;
                                    }
                                };

                                const media = parseJson(current?.media_json, {});
                                media.main_image = mainImg || media.main_image || null;
                                media.gallery = galleryUrls;

                                const unified = parseJson(current?.unified_data, {});
                                unified.media = unified.media || {};
                                unified.media.main_image = media.main_image;
                                unified.media.gallery = galleryUrls;

                                db.prepare(
                                    `UPDATE bikes
                                     SET media_json = ?,
                                         unified_data = ?
                                     WHERE id = ?`
                                ).run(
                                    JSON.stringify(media),
                                    JSON.stringify(unified),
                                    savedId
                                );
                            } catch (mediaPersistError) {
                                this.log(`Media JSON persist failed: ${mediaPersistError.message}`);
                            }
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

    async ensureRussianDescription(data) {
        const existing = String(data?.description_ru || data?.descriptionRu || '').trim();
        if (existing && /[а-яё]/i.test(existing)) return existing;

        const sourceText = String(data?.rawDescription || data?.description || '').trim();
        if (!sourceText) return null;
        if (/[а-яё]/i.test(sourceText)) return sourceText;

        if (!this.geminiProcessor) {
            return null;
        }

        const translationPrompt = `
Translate this listing text from German/English to Russian.
Rules:
1) Strict translation only, no summary.
2) Keep bike component names and model names unchanged (e.g. Shimano XT, SRAM GX Eagle).
3) Output only translated Russian text.

Text:
${sourceText.slice(0, 3500)}
`;

        const normalizeCandidate = (value) => {
            const normalized = String(value || '').trim().replace(/^["']|["']$/g, '');
            if (!normalized) return null;
            if (!/[а-яё]/i.test(normalized)) return null;
            if (normalized.toLowerCase() === sourceText.toLowerCase()) return null;
            return normalized;
        };

        try {
            if (this.geminiProcessor._mkClient && typeof this.geminiProcessor._mkClient.generateContent === 'function') {
                const response = await this.geminiProcessor._mkClient.generateContent({
                    contents: [{ parts: [{ text: translationPrompt }] }],
                    generationConfig: {
                        responseMimeType: 'text/plain',
                        temperature: 0.1
                    }
                });
                const text = response?.response?.text?.() || response?.text || response;
                const candidate = normalizeCandidate(text);
                if (candidate) return candidate;
            }
        } catch {}

        try {
            if (typeof this.geminiProcessor.callGeminiAPI === 'function') {
                const translated = await this.geminiProcessor.callGeminiAPI(translationPrompt);
                const candidate = normalizeCandidate(translated);
                if (candidate) return candidate;
            }
        } catch {}

        return null;
    }

    /**
     * Maps Legacy Hunter Data to Unified Schema V2
     */
    mapToUnified(data, fmv, isActive, priority, source = "kleinanzeigen") {
        const inferredYear = this.inferYear(data);
        const inferredFrameSize = this.inferFrameSize(data);
        const inferredWheelSize = this.inferWheelSize(data);
        const normalizedSellerType = this.normalizeSellerType(data.sellerType || data.seller_type);
        const inferredSpecs = this.inferSpecs(data, {
            inferredFrameSize,
            inferredWheelSize,
            source
        });
        const safeStr = (v) => (v === null || v === undefined ? '' : String(v));
        const safeNum = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };
        const sourceDescription = safeStr(data.rawDescription || data.description);
        const sourceDescriptionRu = safeStr(
            data.description_ru ||
            data.descriptionRu ||
            (/[а-яё]/i.test(sourceDescription) ? sourceDescription : '')
        );

        const nowIso = new Date().toISOString();
        const shippingOption = this.inferShippingOption(source, data);
        const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
        const sellerPayload = this.parseObjectCandidate(data.seller);
        const sellerName = safeStr(data.sellerName || data.seller_name || sellerPayload?.name || '');
        const sellerRating = this.toNullableNumber(data.sellerRating ?? data.seller_rating ?? sellerPayload?.rating);
        const sellerLastActive = safeStr(
            data.sellerLastActive ||
            data.seller_last_active ||
            sellerPayload?.last_active ||
            sellerPayload?.lastActive ||
            ''
        );
        const sellerMemberSince = safeStr(
            data.sellerMemberSince ||
            data.seller_member_since ||
            sellerPayload?.member_since ||
            sellerPayload?.memberSince ||
            ''
        );
        const sellerBadges = (() => {
            const value = data.sellerBadges || data.seller_badges_json || sellerPayload?.badges || null;
            if (!value) return null;
            if (Array.isArray(value)) return value.filter(Boolean);
            if (typeof value === 'object') return value;
            if (typeof value === 'string') {
                const parsed = this.parseObjectCandidate(value);
                if (parsed) return parsed;
                return value;
            }
            return null;
        })();
        const sellerReviewsCount = this.toNullableNumber(
            data.sellerReviewsCount ??
            data.seller_reviews_count ??
            sellerPayload?.reviews_count ??
            sellerPayload?.reviewsCount ??
            sellerPayload?.user_reviews_count
        );
        const sellerRatingVisual = safeStr(
            data.sellerRatingVisual ||
            data.seller_rating_visual ||
            sellerPayload?.rating_visual ||
            ''
        );
        const location = safeStr(data.location || sellerPayload?.location || '');
        const pickupAvailable = this.inferPickupAvailable(data, shippingOption) ? 1 : 0;
        const country = this.inferCountry(source, data, location);
        const explicitOriginalPrice = this.toNullableNumber(
            data.originalPrice ?? data.original_price ?? data.price_original
        );
        const extractedOriginalPrice = this.toNullableNumber(this.extractOriginalPriceFromText(data));
        const currentPrice = safeNum(data.price);
        const originalPrice = (explicitOriginalPrice && explicitOriginalPrice > 0)
            ? explicitOriginalPrice
            : ((extractedOriginalPrice && extractedOriginalPrice > 0) ? extractedOriginalPrice : null);
        const discount = (originalPrice && currentPrice > 0 && originalPrice > currentPrice)
            ? Math.max(0, Math.round((1 - (currentPrice / originalPrice)) * 100))
            : 0;
        const marketComparison = safeStr(
            data.marketComparison ||
            data.market_comparison ||
            data.priceBadgeRange ||
            data.price_badge_range ||
            ''
        );
        // Business decision: keep platform_reviews_count empty (NULL) to avoid noisy/unstable values.
        const platformReviewsCount = null;
        const platformReviewsSource = safeStr(
            data.platformReviewsSource ||
            data.platform_reviews_source ||
            ''
        );
        const conditionScore = this.normalizeConditionScore(this.toNullableNumber(data.condition_score));
        const conditionConfidence = this.deriveConditionConfidence(data);
        const conditionRatings = this.deriveConditionRatings(data, conditionScore);

        const unified = {
            basic_info: {
                name: safeStr(data.title),
                brand: safeStr(data.brand),
                model: safeStr(data.model),
                year: inferredYear,
                category: safeStr(data.category),
                discipline: safeStr(data.discipline || ''),
                sub_category: safeStr(data.sub_category || ''),
                description: sourceDescription,
                description_ru: sourceDescriptionRu || null,
                language: 'de'
            },
            pricing: {
                price: currentPrice,
                original_price: originalPrice,
                discount,
                currency: 'EUR',
                is_negotiable: data.isNegotiable ? 1 : 0,
                buyer_protection_price: null,
                fmv: safeNum(fmv),
                fmv_confidence: null,
                market_comparison: marketComparison || null,
                days_on_market: 0
            },
            condition: {
                status: 'used',
                score: conditionScore,
                grade: safeStr(data.condition_grade),
                class: safeStr(data.condition_class || ''),
                rationale: safeStr(data.condition_reason || data.condition_rationale || ''),
                confidence: conditionConfidence,
                visual_rating: conditionRatings.visual,
                functional_rating: conditionRatings.functional,
                receipt_available: 0,
                crash_history: 0,
                frame_damage: 0,
                issues: Array.isArray(data.condition_defects) ? data.condition_defects : []
            },
            seller: {
                type: normalizedSellerType,
                name: sellerName,
                rating: sellerRating,
                rating_visual: sellerRatingVisual || null,
                reviews_count: sellerReviewsCount,
                last_active: sellerLastActive || null,
                member_since: sellerMemberSince || null,
                badges: sellerBadges,
                trust_score: null,
                verified: 0
            },
            logistics: {
                location,
                country,
                shipping_option: shippingOption,
                shipping_cost: null,
                pickup_available: pickupAvailable,
                international: 0,
                ready_to_ship: shippingOption === 'available' ? 1 : 0,
                zip_code: null,
                shipping_days: null
            },
            media: {
                main_image: images[0] || null,
                gallery: images,
                photo_quality: null
            },
            ranking: {
                score: null,
                value_score: null,
                demand_score: null,
                urgency_score: null,
                is_hot_offer: priority === 'high' ? 1 : 0,
                is_super_deal: priority === 'ultra_high' ? 1 : 0,
                tier: null,
                views: safeNum(data.views_count || data.views)
            },
            specs: {
                frame_size: inferredSpecs.frame_size,
                wheel_size: inferredSpecs.wheel_size,
                wheel_diameter: inferredSpecs.wheel_size,
                frame_material: inferredSpecs.frame_material,
                color: inferredSpecs.color,
                weight: null,
                suspension_type: inferredSpecs.suspension_type,
                travel_front: inferredSpecs.travel_front,
                travel_rear: inferredSpecs.travel_rear,
                groupset: inferredSpecs.groupset,
                shifting_type: null,
                drivetrain: inferredSpecs.drivetrain,
                brakes: inferredSpecs.brakes,
                brakes_type: inferredSpecs.brakes_type,
                groupset_speeds: inferredSpecs.groupset_speeds,
                cassette: inferredSpecs.cassette,
                tires_front: inferredSpecs.tires_front,
                tires_rear: inferredSpecs.tires_rear,
                handlebars_width: null,
                stem_length: null,
                seatpost_travel: null,
                pedals_included: inferredSpecs.pedals_included,
                fork: inferredSpecs.fork,
                shock: inferredSpecs.shock
            },
            features: this.buildFeaturesPayload(data, inferredSpecs),
            inspection: this.buildInspectionPayload(data, nowIso),
            meta: {
                source_platform: source,
                source_ad_id: safeStr(data.sourceAdId || data.source_ad_id || data.external_id || data.ad_id || this.extractSourceAdIdFromUrl(data.originalUrl || data.original_url || data.url || '', source)),
                source_url: safeStr(data.originalUrl || data.original_url || data.url || ''),
                parser_version: 'hunter_v7',
                is_active: isActive ? 1 : 0,
                created_at: nowIso,
                updated_at: nowIso,
                last_checked_at: nowIso,
                platform_trust: (platformReviewsCount || platformReviewsSource)
                    ? {
                        reviews_count: platformReviewsCount || null,
                        source: platformReviewsSource || null
                    }
                    : null
            },
            quality_score: 50,
            completeness: 0
        };

        // Fill taxonomy and normalize wheel size without extra Gemini calls.
        try { unifiedNormalizer.applyTaxonomyFallback(unified, data); } catch {}
        try { unifiedNormalizer.applyWheelSizeNormalization(unified, data); } catch {}

        // Compute quality + completeness (stored as 0..1 fraction).
        try {
            unifiedNormalizer.applyQualityScore(unified);
            unifiedNormalizer.applyCompletenessScore(unified);
            const pct = Number(unified.meta?.completeness_score || 0);
            unified.completeness = Number.isFinite(pct) ? Math.round(pct) / 100 : 0;
        } catch {}

        return unified;
    }

    toNullableNumber(value) {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    normalizeConditionScore(value) {
        if (value === undefined || value === null || value === '') return 0;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        const rounded = Math.round(numeric);
        return Math.max(0, Math.min(100, rounded));
    }

    deriveConditionConfidence(data) {
        const direct = this.toNullableNumber(
            data?.condition_confidence ??
            data?.conditionConfidence ??
            data?.confidence
        );
        if (direct !== null) {
            if (direct > 1 && direct <= 100) return Math.max(0, Math.min(1, direct / 100));
            if (direct >= 0 && direct <= 1) return direct;
        }

        const confidenceScore = this.toNullableNumber(data?.confidence_score);
        if (confidenceScore !== null) {
            if (confidenceScore > 1 && confidenceScore <= 100) return Math.max(0, Math.min(1, confidenceScore / 100));
            if (confidenceScore >= 0 && confidenceScore <= 1) return confidenceScore;
        }

        const descriptor = this.normalizeLookup(
            data?.condition ||
            data?.condition_status ||
            data?.condition_grade ||
            data?.condition_reason ||
            data?.condition_rationale
        );
        if (descriptor.includes('neu') || descriptor.includes('new') || descriptor.includes('sehr gut') || descriptor.includes('excellent')) {
            return 0.9;
        }
        if (descriptor.includes('gut') || descriptor.includes('good')) return 0.8;
        if (descriptor.includes('fair') || descriptor.includes('ok')) return 0.7;
        return 0.75;
    }

    deriveConditionRatings(data, normalizedScore) {
        const score = this.normalizeConditionScore(normalizedScore);
        let functional = 3;
        if (score >= 92) functional = 5;
        else if (score >= 80) functional = 4;
        else if (score >= 65) functional = 3;
        else if (score >= 45) functional = 2;
        else functional = 1;

        let visual = functional;
        const text = `${data?.rawDescription || ''} ${data?.description || ''} ${data?.condition_reason || ''} ${data?.condition_rationale || ''}`.toLowerCase();
        const hasWearIndicators = /\b(kratzer|scratch|steinschlag|chip|scuff|gebrauchsspuren|wear|cosmetic)\b/i.test(text);
        if (hasWearIndicators) visual = Math.max(1, functional - 1);
        if (/\b(crack|dent|delle|bruch)\b/i.test(text)) visual = Math.max(1, visual - 1);

        return { visual, functional };
    }

    parseObjectCandidate(value) {
        if (!value) return null;
        if (typeof value === 'object') return value;
        if (typeof value !== 'string') return null;
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    normalizeLookup(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    collectComponentEntries(data) {
        const candidates = [
            data?.components,
            data?.rawComponents,
            data?.features,
            data?.specifications,
            data?.general,
            data?.general_info,
            data?.rawGeneralInfo
        ];
        const entries = [];
        const seen = new Set();

        const pushEntry = (rawKey, rawValue) => {
            const key = String(rawKey || '').trim();
            const value = String(rawValue || '').trim();
            if (!key || !value) return;
            const fingerprint = `${this.normalizeLookup(key)}::${value}`;
            if (seen.has(fingerprint)) return;
            seen.add(fingerprint);
            entries.push([key, value]);
        };

        const extractEmbeddedKeyValuePairs = (source) => {
            const text = String(source || '');
            if (!text || (!text.includes('"key"') && !text.includes('\\"key\\"'))) return 0;

            const patterns = [
                /"key"\s*:\s*"([^"]{1,120})"\s*,\s*"value"\s*:\s*"([^"]{1,600})"/gi,
                /\\"key\\"\s*:\s*\\"([^"]{1,120})\\"\s*,\s*\\"value\\"\s*:\s*\\"([^"]{1,600})\\"/gi
            ];

            let count = 0;
            for (const re of patterns) {
                let match;
                while ((match = re.exec(text)) !== null) {
                    pushEntry(match[1], match[2].replace(/\\"/g, '"'));
                    count += 1;
                }
            }
            return count;
        };

        for (const candidate of candidates) {
            const obj = this.parseObjectCandidate(candidate);
            if (!obj || typeof obj !== 'object') continue;
            for (const [key, value] of Object.entries(obj)) {
                if (value === undefined || value === null) continue;
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (item && typeof item === 'object' && item.key && item.value) {
                            pushEntry(item.key, item.value);
                        } else if (item !== null && item !== undefined) {
                            extractEmbeddedKeyValuePairs(item);
                        }
                    }
                    continue;
                }

                if (typeof value === 'object') {
                    if (value.key && value.value) pushEntry(value.key, value.value);
                    extractEmbeddedKeyValuePairs(JSON.stringify(value));
                    continue;
                }

                const keyStr = String(key);
                const valueStr = String(value);
                const embeddedCount = extractEmbeddedKeyValuePairs(`${keyStr} ${valueStr}`);
                const looksSerializedBlob =
                    /"key"\s*:|\\"key\\"|","data"|\\",\\\"data\\\"/i.test(keyStr) ||
                    /"key"\s*:|\\"key\\"/i.test(valueStr);
                if (looksSerializedBlob && embeddedCount > 0) continue;
                pushEntry(keyStr, valueStr);
            }
        }

        return entries;
    }

    collectTextForInference(data, entries) {
        const textParts = [
            data?.title,
            data?.description,
            data?.rawDescription,
            data?.model,
            data?.attributes,
            data?.rawAttributes,
            data?.components,
            data?.rawComponents,
            data?.features,
            data?.specifications,
            data?.general,
            data?.general_info,
            data?.rawGeneralInfo
        ];

        if (Array.isArray(data?.attributes)) textParts.push(data.attributes.join(' '));
        for (const [key, value] of entries) textParts.push(`${key}: ${value}`);

        return textParts
            .filter(Boolean)
            .map((value) => String(value))
            .join(' ');
    }

    findByComponentKey(entries, patterns) {
        for (const [rawKey, rawValue] of entries) {
            const key = this.normalizeLookup(rawKey);
            if (patterns.some((pattern) => key.includes(pattern))) {
                const value = String(rawValue || '').trim();
                if (value) return value;
            }
        }
        return '';
    }

    findByRegex(text, regexes) {
        for (const re of regexes) {
            const match = text.match(re);
            if (match && match[1]) return String(match[1]).trim();
        }
        return '';
    }

    cleanFieldValue(value, stopTokens = []) {
        if (!value) return '';
        const rawValue = String(value);

        // Some sources leak serialized fragments like:
        // ","value":"SRAM SX Eagle","is_main_data":true...
        const embeddedValue =
            rawValue.match(/"value"\s*:\s*"([^"]{1,200})"/i)?.[1] ||
            rawValue.match(/\\"value\\"\s*:\s*\\"([^"]{1,200})\\"/i)?.[1];

        let result = String(value)
            .replace(/\s+/g, ' ')
            .replace(/[|]+/g, ' ')
            .replace(/^[\s:;,\-]+/, '')
            .trim();
        if (embeddedValue) result = embeddedValue.trim();
        if (!result) return '';

        for (const token of stopTokens) {
            const escaped = String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (!escaped) continue;
            const re = new RegExp(`${escaped}\\s*[:\\-]?.*$`, 'i');
            result = result.replace(re, '').trim();
        }

        result = result
            .replace(/\s{2,}/g, ' ')
            .replace(/[;,.:\-]+$/g, '')
            .replace(/^["',\s]+|["',\s]+$/g, '')
            .trim();

        return result;
    }

    extractLabeledValue(text, labels = []) {
        const source = String(text || '');
        if (!source || !Array.isArray(labels) || labels.length === 0) return '';

        const labelPattern = labels
            .map((label) => String(label || '').trim())
            .filter(Boolean)
            .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'))
            .join('|');
        if (!labelPattern) return '';

        const strict = new RegExp(`(?:${labelPattern})\\s*[:\\-]\\s*([^\\n\\r]{1,200})`, 'i');
        const strictMatch = source.match(strict);
        if (strictMatch && strictMatch[1]) return strictMatch[1].trim();

        const loose = new RegExp(`(?:${labelPattern})\\s*([^\\n\\r]{1,200})`, 'i');
        const looseMatch = source.match(loose);
        return looseMatch && looseMatch[1] ? looseMatch[1].trim() : '';
    }

    extractTravelByContext(normalizedText, contextTokens) {
        const patterns = [
            new RegExp(`(?:${contextTokens.join('|')})[^\\d]{0,16}(\\d{2,3})\\s*mm`, 'i'),
            new RegExp(`(\\d{2,3})\\s*mm[^\\d]{0,16}(?:${contextTokens.join('|')})`, 'i')
        ];
        for (const re of patterns) {
            const match = normalizedText.match(re);
            if (match && match[1]) {
                const value = Number(match[1]);
                if (Number.isFinite(value) && value >= 60 && value <= 250) return value;
            }
        }
        return null;
    }

    normalizeMaterial(value) {
        const text = this.normalizeLookup(value);
        if (!text) return '';
        if (text.includes('carbon')) return 'carbon';
        if (text.includes('aluminum') || text.includes('aluminium') || text.includes('alloy')) return 'aluminum';
        if (text.includes('steel') || text.includes('stahl')) return 'steel';
        if (text.includes('titan')) return 'titanium';
        return '';
    }

    normalizeBrakesType(value) {
        const text = this.normalizeLookup(value);
        if (!text) return '';
        const hasDisc = text.includes('disc') || text.includes('scheibe') || text.includes('scheiben');
        const hasHydraulic = text.includes('hydraulic') || text.includes('hydraul');
        const hasMechanical = text.includes('mechanical') || text.includes('mechanisch');

        if (hasHydraulic && hasDisc) return 'hydraulic disc';
        if (hasMechanical && hasDisc) return 'mechanical disc';
        if (
            text.includes('sram db8') ||
            text.includes('guide') ||
            text.includes('shimano deore') ||
            text.includes('shimano slx') ||
            text.includes('shimano xt') ||
            text.includes('shimano xtr') ||
            text.includes('magura mt')
        ) return 'hydraulic disc';
        if (hasDisc) return 'disc';
        if (text.includes('rim') || text.includes('felgen')) return 'rim';
        return '';
    }

    normalizeSuspensionType(value) {
        const text = this.normalizeLookup(value);
        if (!text) return '';
        if (text.includes('hardtail')) return 'hardtail';
        if (text.includes('full') || text.includes('fully')) return 'full';
        if (text.includes('rigid')) return 'rigid';
        return '';
    }

    normalizeDrivetrain(value) {
        const text = String(value || '').trim().toLowerCase();
        if (!text) return '';
        const compact = text.replace(/\s+/g, '');
        const direct = compact.match(/\b([123]x[0-9]{1,2})\b/);
        if (direct) return direct[1];
        const pattern = compact.match(/\b([123])x?([0-9]{1,2})\b/);
        if (pattern) return `${pattern[1]}x${pattern[2]}`;
        return '';
    }

    extractOriginalPriceFromText(data) {
        const text = [
            data?.rawDescription,
            data?.description,
            data?.rawAttributes,
            data?.attributes
        ]
            .flat()
            .filter(Boolean)
            .map((value) => String(value))
            .join(' ');
        if (!text) return null;

        const patterns = [
            /(?:uvp|neupreis|np|original(?:\s*price|er\s*preis)?)\s*(?:war\s*)?[:\-]?\s*(?:€\s*)?([0-9][0-9.,\s]{2,})(?:\s*(?:€|eur|euro|\u20ac))?/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (!match || !match[1]) continue;
            const raw = String(match[1]).trim();
            const normalized = raw
                .replace(/\s+/g, '')
                .replace(/\.(?=\d{3}(?:\D|$))/g, '')
                .replace(',', '.');
            const parsedFloat = Number.parseFloat(normalized);
            const parsed = Number.isFinite(parsedFloat)
                ? Math.round(parsedFloat)
                : Number(String(match[1]).replace(/[^\d]/g, ''));
            if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return null;
    }

    inferSpecs(data, seed = {}) {
        const entries = this.collectComponentEntries(data);
        const text = this.collectTextForInference(data, entries);
        const normalizedText = this.normalizeLookup(text);
        const sourceNormalized = this.normalizeLookup(seed.source || data?.source || data?.source_platform || '');
        const categoryNormalized = this.normalizeLookup(data?.category || '');
        const isMtbLikeCategory = ['mtb', 'emtb', 'trail', 'trail riding', 'mountain', 'enduro', 'downhill'].some((token) => categoryNormalized.includes(token));
        const isMtbContext = isMtbLikeCategory || /\b(e\s*mtb|mountain|trail|enduro|downhill)\b/i.test(normalizedText);
        const sectionStopTokens = [
            'kassette', 'cassette', 'bremsen', 'brakes', 'bremstyp',
            'reifen', 'tire', 'tires', 'federweg', 'travel', 'farbe', 'color',
            'modell', 'model', 'rahmengroesse', 'rahmengröße', 'rahmenmaterial',
            'sattel', 'lenker', 'pedale', 'fork', 'gabel',
            'dampfer', 'daempfer', 'dämpfer', 'shock', 'damper',
            'schaltwerk', 'groupset', 'sattelstütze', 'sattelstuetze',
            'seriennummer', 'serial', 'motor', 'akku', 'battery', 'achsbreite', 'axle',
            'zustand', 'condition', 'uvp', 'privatverkauf'
        ];

        const frameMaterialCandidate =
            this.findByComponentKey(entries, ['rahmenmaterial', 'frame material', 'frame_material']) ||
            this.extractLabeledValue(text, ['Rahmenmaterial', 'Frame material']) ||
            this.findByRegex(normalizedText, [/\b(carbo(?:n)?[a-z]*|aluminium|aluminum|alloy|stahl|steel|titanium)\b/i]);
        const frameMaterial = this.normalizeMaterial(frameMaterialCandidate || data?.frame_material || data?.frameMaterial);

        const groupsetCandidateRaw =
            this.findByComponentKey(entries, ['groupset', 'schaltwerk', 'rear derailleur', 'transmission']) ||
            this.extractLabeledValue(text, ['Schaltwerk', 'Groupset', 'Rear derailleur']) ||
            this.findByRegex(normalizedText, [/\b((?:shimano|sram|campagnolo|microshift|rotor)\s+[a-z0-9+.\- ]{1,40})\b/i]);
        const groupset = this.cleanFieldValue(groupsetCandidateRaw, sectionStopTokens);

        const drivetrainCandidate =
            this.findByComponentKey(entries, ['drivetrain', 'antrieb']) ||
            this.extractLabeledValue(text, ['Antrieb', 'Drivetrain']) ||
            this.findByRegex(normalizedText, [/\b([123]\s*x\s*[0-9]{1,2})\b/i]);
        const drivetrain = this.normalizeDrivetrain(drivetrainCandidate);

        const groupsetSpeedsCandidate = this.findByRegex(normalizedText, [
            /\b([0-9]{1,2})\s*(?:speed|spd|fach)\b/i
        ]);
        let groupsetSpeeds = this.toNullableNumber(groupsetSpeedsCandidate);
        if (groupsetSpeeds === null && drivetrain) {
            const driveMatch = drivetrain.match(/x([0-9]{1,2})$/);
            if (driveMatch) groupsetSpeeds = this.toNullableNumber(driveMatch[1]);
        }
        const cassetteSpeedsFromText = this.findByRegex(normalizedText, [/\b([0-9]{1,2})\s*(?:speed|spd|fach)\b/i]);
        if (groupsetSpeeds === null) groupsetSpeeds = this.toNullableNumber(cassetteSpeedsFromText);
        if (groupsetSpeeds === null && /\beagle\b/i.test(groupset)) groupsetSpeeds = 12;
        if (groupsetSpeeds === null && /\b10\D{0,3}5[01]\b/.test(normalizedText)) groupsetSpeeds = 12;

        const brakesCandidateRaw =
            this.findByComponentKey(entries, ['brake', 'brems', 'bremstyp']) ||
            this.extractLabeledValue(text, ['Bremsen', 'Brakes', 'Bremstyp']) ||
            this.findByRegex(normalizedText, [/(?:brems(?:en|typ)?|brakes?)\s*[:\-]?\s*([a-z0-9 +.\-/]{2,40})/i]);
        const brakes = this.cleanFieldValue(brakesCandidateRaw, sectionStopTokens);
        const explicitBrakesTypeRaw =
            data?.brakes_type ||
            data?.brakesType ||
            this.findByComponentKey(entries, ['bremstyp', 'brake type']) ||
            this.extractLabeledValue(text, ['Bremstyp', 'Brake type']) ||
            '';
        let brakesType = this.normalizeBrakesType(explicitBrakesTypeRaw);
        if (!brakesType && sourceNormalized !== 'kleinanzeigen') {
            brakesType = this.normalizeBrakesType(brakesCandidateRaw || '');
        }
        if (!brakesType && /\bbremstyp\s*[:\-]?\s*scheiben\b/i.test(normalizedText)) {
            brakesType = 'disc';
        }

        const forkCandidate =
            this.findByComponentKey(entries, ['fork', 'gabel']) ||
            this.extractLabeledValue(text, ['Gabel', 'Fork']) ||
            this.findByRegex(normalizedText, [/\b((?:rockshox|rock shox|fox|marzocchi|sr suntour|manitou)\s+[a-z0-9+.\- ]{1,30})\b/i]);
        const fork = this.cleanFieldValue(forkCandidate, sectionStopTokens);

        const shockCandidate =
            this.findByComponentKey(entries, ['shock', 'damper', 'dampfer']) ||
            this.extractLabeledValue(text, ['Dämpfer', 'Daempfer', 'Shock', 'Damper']) ||
            this.findByRegex(normalizedText, [/\b((?:rockshox|rock shox|fox|dvo|x-fusion)\s+[a-z0-9+.\- ]{1,30})\b/i]);
        const shock = this.cleanFieldValue(shockCandidate, sectionStopTokens);

        const suspensionCandidate =
            this.findByComponentKey(entries, ['suspension', 'federung']) ||
            this.extractLabeledValue(text, ['Federungstyp', 'Suspension type']) ||
            this.findByRegex(normalizedText, [/\b(hardtail|full suspension|fully|rigid)\b/i]);
        let suspensionType = this.normalizeSuspensionType(suspensionCandidate);
        if (!suspensionType) {
            if (shock) suspensionType = 'full';
            else if (fork && ['mtb', 'emtb'].includes(String(data?.category || '').toLowerCase())) suspensionType = 'hardtail';
            else if (['road', 'gravel'].includes(String(data?.category || '').toLowerCase())) suspensionType = 'rigid';
        }

        let travelFront = this.extractTravelByContext(normalizedText, ['fork', 'front', 'gabel', 'federweg']);
        let travelRear = this.extractTravelByContext(normalizedText, ['shock', 'rear', 'dampfer', 'damper', 'hinter', 'federweg hinten']);

        if (!travelFront) {
            const genericTravel = this.extractLabeledValue(text, ['Federweg', 'Travel']);
            const genericMatch = String(genericTravel || '').match(/(\d{2,3})\s*mm/i);
            if (genericMatch) {
                const parsed = Number(genericMatch[1]);
                if (Number.isFinite(parsed) && parsed >= 60 && parsed <= 250) travelFront = parsed;
            }
        }
        if (!travelRear) {
            const rearTravel = this.extractLabeledValue(text, ['Federweg hinten', 'Rear travel']);
            const rearMatch = String(rearTravel || '').match(/(\d{2,3})\s*mm/i);
            if (rearMatch) {
                const parsed = Number(rearMatch[1]);
                if (Number.isFinite(parsed) && parsed >= 60 && parsed <= 250) travelRear = parsed;
            }
        }

        const cassetteCandidateRaw =
            this.findByComponentKey(entries, ['cassette', 'kassette']) ||
            this.extractLabeledValue(text, ['Kassette', 'Cassette']) ||
            this.findByRegex(normalizedText, [
                /(?:kassette|cassette)\s*([a-z0-9 +.\-/]{2,40})(?:\b(?:pedale|reifen|sattel|lenker|federweg)\b|$)/i,
                /\b([0-9]{1,2}\s*(?:-|–|—)\s*[0-9]{2})\b/i
            ]);
        const cassette = this.cleanFieldValue(cassetteCandidateRaw, sectionStopTokens);
        if (groupsetSpeeds === null && cassette) {
            const speedInCassette = cassette.match(/\b([0-9]{1,2})\s*(?:speed|spd|fach)\b/i);
            if (speedInCassette) groupsetSpeeds = this.toNullableNumber(speedInCassette[1]);
        }
        if (groupsetSpeeds === null && cassette && /\b10\D{0,3}5[012]\b/.test(cassette)) {
            groupsetSpeeds = 12;
        }

        const tireGenericRaw =
            this.findByComponentKey(entries, ['reifen', 'tires', 'tire']) ||
            this.extractLabeledValue(text, ['Reifen', 'Tires', 'Tire']) ||
            this.findByRegex(normalizedText, [/(?:reifen|tires?|tire)\s*([a-z0-9 .+\-/"]{2,40})(?:\b(?:sattel|kassette|pedale|lenker)\b|$)/i]);
        const tireFrontRaw =
            this.findByComponentKey(entries, ['tire front', 'front tire', 'vorderreifen']) ||
            this.extractLabeledValue(text, ['Vorderreifen', 'Front tire']) ||
            this.findByRegex(normalizedText, [/(?:front tire|vorderreifen)[^a-z0-9]{0,6}([a-z0-9 .+\-/"]{3,40})/i]);
        const tireRearRaw =
            this.findByComponentKey(entries, ['tire rear', 'rear tire', 'hinterreifen']) ||
            this.extractLabeledValue(text, ['Hinterreifen', 'Rear tire']) ||
            this.findByRegex(normalizedText, [/(?:rear tire|hinterreifen)[^a-z0-9]{0,6}([a-z0-9 .+\-/"]{3,40})/i]);
        const tireGeneric = this.cleanFieldValue(tireGenericRaw, sectionStopTokens);
        const tireFront = this.cleanFieldValue(tireFrontRaw, sectionStopTokens);
        const tireRear = this.cleanFieldValue(tireRearRaw, sectionStopTokens);

        const colorCandidateRaw =
            this.findByComponentKey(entries, ['color', 'farbe']) ||
            this.extractLabeledValue(text, ['Farbe', 'Color']) ||
            this.findByRegex(normalizedText, [
                /(?:farbe|color)\s*[:\-]?\s*([a-z0-9 ]{2,24})\b/i,
                /\b(black|white|grey|gray|silver|red|green|blue|orange|yellow|purple|pink|brown|beige|stealth)\b/i
            ]);
        const colorCandidate = this.cleanFieldValue(colorCandidateRaw, sectionStopTokens);

        const pedalsIncluded = /\b(with pedals|pedals included|inkl\.?\s*pedal|mit pedal)\b/i.test(normalizedText) ? 1 : 0;

        let normalizedDrivetrain = drivetrain;
        if (!normalizedDrivetrain && groupsetSpeeds && groupset && /\beagle\b/i.test(groupset)) {
            normalizedDrivetrain = `1x${groupsetSpeeds}`;
        }
        if (!normalizedDrivetrain && groupsetSpeeds && isMtbContext) {
            if (/\b10\D{0,3}5[01]\b/.test(cassette) || /\b12\s*(?:speed|spd|fach)\b/i.test(normalizedText)) {
                normalizedDrivetrain = `1x${groupsetSpeeds}`;
            }
        }

        let normalizedTireFront = tireFront || '';
        let normalizedTireRear = tireRear || '';
        if (!normalizedTireFront && !normalizedTireRear && tireGeneric) {
            normalizedTireFront = tireGeneric;
            normalizedTireRear = tireGeneric;
        }

        return {
            frame_size: seed.inferredFrameSize || '',
            wheel_size: seed.inferredWheelSize || '',
            frame_material: frameMaterial || '',
            color: colorCandidate || '',
            suspension_type: suspensionType || '',
            travel_front: travelFront,
            travel_rear: travelRear,
            groupset: groupset || '',
            groupset_speeds: groupsetSpeeds,
            drivetrain: normalizedDrivetrain || '',
            brakes: brakes || null,
            brakes_type: brakesType || null,
            fork: fork || '',
            shock: shock || '',
            cassette: cassette || '',
            tires_front: normalizedTireFront || null,
            tires_rear: normalizedTireRear || null,
            pedals_included: pedalsIncluded
        };
    }

    buildFeaturesPayload(data, inferredSpecs) {
        const existing = this.parseObjectCandidate(data.features_json) || this.parseObjectCandidate(data.features) || {};
        const highlights = Array.isArray(existing.highlights) ? existing.highlights.filter(Boolean) : [];
        const autoHighlights = [];

        if (inferredSpecs.suspension_type === 'full') autoHighlights.push('Full suspension');
        if (inferredSpecs.suspension_type === 'hardtail') autoHighlights.push('Hardtail');
        if (inferredSpecs.groupset) autoHighlights.push(`Groupset: ${inferredSpecs.groupset}`);
        if (inferredSpecs.fork) autoHighlights.push(`Fork: ${inferredSpecs.fork}`);
        if (inferredSpecs.shock) autoHighlights.push(`Shock: ${inferredSpecs.shock}`);

        const mergedHighlights = Array.from(new Set([...highlights, ...autoHighlights])).slice(0, 8);
        const rawSpecs = existing.raw_specs && typeof existing.raw_specs === 'object' ? existing.raw_specs : {};

        if (!rawSpecs.components && data.components) rawSpecs.components = data.components;
        if (!rawSpecs.general_info && data.general_info) rawSpecs.general_info = data.general_info;
        if (!rawSpecs.attributes && Array.isArray(data.attributes)) rawSpecs.attributes = data.attributes;

        return {
            ...existing,
            highlights: mergedHighlights,
            raw_specs: rawSpecs
        };
    }

    buildInspectionPayload(data, nowIso) {
        const parsedInspection = this.parseObjectCandidate(data.inspection_json) || this.parseObjectCandidate(data.inspection_data);
        if (parsedInspection && typeof parsedInspection === 'object') return parsedInspection;

        const parsedChecklist = this.parseObjectCandidate(data.condition_checklist);
        if (parsedChecklist && typeof parsedChecklist === 'object') {
            return {
                checklist: parsedChecklist,
                updated_at: nowIso
            };
        }

        return { updated_at: nowIso, checklist: {} };
    }

    inferYear(data) {
        const direct = Number(data?.year);
        if (Number.isInteger(direct) && direct >= 1990 && direct <= 2035) return direct;

        const text = [data?.title, data?.description, data?.model].filter(Boolean).join(' ');
        const years = (text.match(/\b(19\d{2}|20\d{2})\b/g) || [])
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 1990 && value <= 2035);

        return years.length > 0 ? Math.max(...years) : null;
    }

    inferFrameSize(data) {
        const directCandidates = [data?.frameSize, data?.frame_size, data?.size].filter(Boolean);
        for (const candidate of directCandidates) {
            const normalized = this.normalizeFrameSizeCandidate(candidate);
            if (normalized) return normalized;
        }

        const componentEntries = this.collectComponentEntries(data);
        const componentText = componentEntries.map(([key, value]) => `${key} ${value}`).join(' ');
        const text = [
            data?.title,
            data?.description,
            data?.rawDescription,
            Array.isArray(data?.attributes) ? data.attributes.join(' ') : data?.attributes,
            data?.rawAttributes,
            componentText
        ]
            .filter(Boolean)
            .map((value) => String(value))
            .join(' ');
        const upperText = text.toUpperCase();

        const labeledSize = this.extractLabeledValue(text, ['Rahmengröße', 'Rahmengroesse', 'Frame size', 'Size']);
        const normalizedLabeled = this.normalizeFrameSizeCandidate(labeledSize);
        if (normalizedLabeled) return normalizedLabeled;

        const combo = upperText.match(/\b(XXL|XL|L|M|S|XS)\s*[\/-]\s*(XXL|XL|L|M|S|XS)\b/);
        if (combo) return `${combo[1]}/${combo[2]}`;

        const cm = upperText.match(/\b(4[0-9]|5[0-9]|6[0-2](?:[.,]\d)?)\s*CM\b/);
        if (cm) return `${String(cm[1]).replace(',', '.')} cm`;

        const specialized = upperText.match(/\bS([1-6])\b/);
        if (specialized) return `S${specialized[1]}`;

        const contextualLetter = upperText.match(/\b(?:RAHMENGR[OÖ]SSE|RAHMENGROESSE|FRAME SIZE|SIZE)\s*[:\-]?\s*(XXL|XL|XS|S|M|L)\b/);
        if (contextualLetter) return contextualLetter[1];

        const contextualNumeric = upperText.match(/\b(?:RAHMENGR[OÖ]SSE|RAHMENGROESSE|FRAME SIZE|SIZE)\s*[:\-]?\s*(4[6-9]|5[0-9]|6[0-2])\b/);
        if (contextualNumeric) return contextualNumeric[1];

        return '';
    }

    normalizeFrameSizeCandidate(value) {
        if (value === undefined || value === null || value === '') return '';
        const raw = String(value).trim().toUpperCase();
        if (!raw) return '';

        const combo = raw.match(/\b(XXL|XL|L|M|S|XS)\s*[\/-]\s*(XXL|XL|L|M|S|XS)\b/);
        if (combo) return `${combo[1]}/${combo[2]}`;

        const specialized = raw.match(/\bS([1-6])\b/);
        if (specialized) return `S${specialized[1]}`;

        // Handles collapsed text like "SFarbe" after OCR/HTML flattening.
        const gluedLetter = raw.match(/^(XXL|XL|XS|S|M|L)(?=(?:FARBE|COLOR|SERIENNUMMER|MOTOR|AKKU|FEDERWEG|DAMPFER|DAEMPFER|SCHALTWERK|KASSETTE|SATTEL|ACHSBREITE|ZUSTAND|UVP|PRIVATVERKAUF))/);
        if (gluedLetter) return gluedLetter[1];

        const cm = raw.match(/\b(\d{2,3}(?:[.,]\d)?)\s*CM\b/);
        if (cm) return `${cm[1].replace(',', '.')} cm`;

        const inch = raw.match(/\b(\d{2}(?:[.,]\d)?)\s*(?:\"|INCH|ZOLL)\b/);
        if (inch) return `${inch[1].replace(',', '.')}\"`;

        const compact = raw.replace(/\s+/g, '');
        if (['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(compact)) return compact;

        const numeric = compact.match(/\b(4[6-9]|5[0-9]|6[0-2])\b/);
        if (numeric) return numeric[1];

        return '';
    }

    inferWheelSize(data) {
        const componentEntries = this.collectComponentEntries(data);
        const componentText = componentEntries.map(([key, value]) => `${key} ${value}`).join(' ');
        const text = [
            data?.wheelDiameter,
            data?.wheel_diameter,
            data?.wheelSize,
            data?.title,
            data?.description,
            data?.rawDescription,
            Array.isArray(data?.attributes) ? data.attributes.join(' ') : data?.attributes,
            data?.rawAttributes,
            componentText
        ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase())
            .join(' ')
            .replace(',', '.');

        if (text.includes('mullet') || text.includes('mallet') || (text.includes('29') && text.includes('27.5'))) return 'mullet';
        if (text.includes('700c') || /\b28\b/.test(text)) return '700c';
        if (text.includes('27.5') || /\b27\.?5\b/.test(text) || text.includes('650b')) return '27.5';
        if (/\b29\b/.test(text)) return '29';
        if (/\b26\b/.test(text)) return '26';
        return '';
    }

    normalizeSellerType(value) {
        const text = String(value || '').trim().toLowerCase();
        if (!text) return 'private';
        if (text.includes('privat') || text.includes('private')) return 'private';
        if (text.includes('shop') || text.includes('dealer') || text.includes('gewerblich') || text.includes('pro')) return 'pro';
        return 'private';
    }

    inferShippingOption(source, data) {
        if (source === 'buycycle') return 'available';

        const direct = this.normalizeLookup(
            data?.shipping_option ||
            data?.deliveryOption ||
            data?.delivery_option ||
            data?.logistics?.shipping_option
        );
        if (direct.includes('available') || direct.includes('versand') || direct.includes('shipping')) return 'available';
        if (direct.includes('pickup') || direct.includes('abholung') || direct.includes('collection')) return 'pickup-only';

        const text = [
            data?.title,
            data?.description,
            Array.isArray(data?.attributes) ? data.attributes.join(' ') : data?.attributes
        ]
            .filter(Boolean)
            .map((value) => String(value))
            .join(' ')
            .toLowerCase();

        const noShippingPattern = /\b(kein versand|nur abholung|pickup only|collection only|nur selbstabholung|no shipping)\b/i;
        const shippingPattern = /\b(versand|lieferung|shipping|delivery)\b/i;

        if (noShippingPattern.test(text)) return 'pickup-only';
        if (shippingPattern.test(text)) return 'available';
        return 'unknown';
    }

    inferPickupAvailable(data, shippingOption) {
        if (shippingOption === 'pickup-only') return true;
        const text = [
            data?.title,
            data?.description,
            Array.isArray(data?.attributes) ? data.attributes.join(' ') : data?.attributes
        ]
            .filter(Boolean)
            .map((value) => String(value))
            .join(' ')
            .toLowerCase();
        return /\b(abholung|pickup|self pickup|collection)\b/i.test(text);
    }

    inferCountry(source, data, location) {
        const direct = String(data?.country || '').trim();
        if (direct) return direct;
        if (source === 'kleinanzeigen') return 'Germany';

        const haystack = `${location || ''} ${data?.description || ''}`.toLowerCase();
        if (/\bdeutschland|germany\b/.test(haystack)) return 'Germany';
        if (/\bfrance|frankreich\b/.test(haystack)) return 'France';
        if (/\bitaly|italien\b/.test(haystack)) return 'Italy';
        if (/\bspain|spanien\b/.test(haystack)) return 'Spain';
        if (/\bnetherlands|niederlande|holland\b/.test(haystack)) return 'Netherlands';
        if (/\baustria|österreich|oesterreich\b/.test(haystack)) return 'Austria';
        if (/\bbelgium|belgien\b/.test(haystack)) return 'Belgium';
        if (/\bswitzerland|schweiz\b/.test(haystack)) return 'Switzerland';
        return null;
    }
}

module.exports = new DeepPipelineProcessor();

