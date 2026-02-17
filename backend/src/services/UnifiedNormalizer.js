const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { DB_PATH } = require('../../config/db-path');
const BuycyclePreprocessor = require('./BuycyclePreprocessor');
const KleinanzeigenPreprocessor = require('./KleinanzeigenPreprocessor');
const ManualPreprocessor = require('./ManualPreprocessor');
const GeminiProcessor = require('./geminiProcessor');
const GeminiToDatabaseMapper = require('../mappers/GeminiToDatabaseMapper');
const FMVAnalyzer = require('./FMVAnalyzer');
const { DatabaseManager } = require('../js/mysql-config');

class UnifiedNormalizer {
    constructor() {
        this.preprocessors = {
            buycycle: BuycyclePreprocessor,
            kleinanzeigen: KleinanzeigenPreprocessor,
            manual: ManualPreprocessor
        };
        this.gemini = GeminiProcessor;
        this.mapper = new GeminiToDatabaseMapper();
        this.dbPath = DB_PATH;
        this.dbManager = new DatabaseManager();
        this.fmvAnalyzer = new FMVAnalyzer(this.dbManager);
        this.taxonomy = this.buildTaxonomyIndex();
    }

    async normalize(rawData = {}, source = null, options = {}) {
        const resolvedSource = this.resolveSource(rawData, source);
        console.log(`   🛠️ UnifiedNormalizer: Resolving source '${source}' -> '${resolvedSource}'`);
        
        const preprocessor = this.getPreprocessor(resolvedSource);
        let preprocessed;
        try {
            preprocessed = preprocessor.preprocess(rawData);
        } catch (e) {
            console.error(`   ❌ Preprocessor Error (${resolvedSource}): ${e.message}`);
            throw e;
        }
        preprocessed.source_platform = resolvedSource;

        const useGemini = options.useGemini !== false;
        const unified = useGemini
            ? await this.gemini.analyzeBikeToUnifiedFormat(preprocessed, 3, resolvedSource)
            : this.gemini.getFallbackJSON(preprocessed, null, resolvedSource);

        const processed = this.postProcess(unified, preprocessed, resolvedSource);
        
        console.log('DEBUG: processed.basic_info', JSON.stringify(processed.basic_info));

        // --- FMV ENRICHMENT ---
        try {
            const brand = processed.basic_info.brand;
            const model = processed.basic_info.model;
            const year = processed.basic_info.year;
            
            if (brand && model && year) {
                console.log(`   💰 [UnifiedNormalizer] Calculating FMV for ${brand} ${model} ${year}...`);
                const fmvOptions = {
                    frameSize: processed.specs?.frame_size || preprocessed.size,
                    frameMaterial: processed.specs?.frame_material,
                    listingPrice: processed.pricing?.price,
                    recentDays: Number(process.env.FMV_RECENT_DAYS || 365)
                };
                const fmvData = await this.fmvAnalyzer.getFairMarketValue(brand, model, year, fmvOptions);
                
                if (fmvData) {
                    processed.pricing.fmv = fmvData.fmv;
                    processed.pricing.fmv_confidence = fmvData.confidence;
                    // processed.pricing.optimal_price = fmvData.price_range?.min || null; 
                    
                    // Calculate Market Comparison
                    const price = processed.pricing.price;
                    if (price && fmvData.fmv) {
                         const comparison = this.fmvAnalyzer.getMarketComparison(price, fmvData.fmv);
                         processed.pricing.market_comparison = comparison;
                         processed.pricing.profit_margin = Math.round(((fmvData.fmv - price) / fmvData.fmv) * 1000) / 10;
                    }
                    console.log(`   ✅ FMV: ${fmvData.fmv} (${processed.pricing.market_comparison})`);
                }
            }
        } catch (e) {
            console.error(`   ⚠️ FMV Enrichment Failed: ${e.message}`);
        }

        // Map to DB Schema
        const mapped = this.mapper.mapToDatabase(processed);
        
        // Merge mapped fields back into result for compatibility
        return { ...processed, ...mapped };
    }

    resolveSource(rawData, source) {
        if (source) return source;
        const sourceValue = rawData.source_platform || rawData.source || rawData.platform;
        if (sourceValue) return sourceValue;
        const url = rawData.url || '';
        if (url.includes('kleinanzeigen')) return 'kleinanzeigen';
        if (url.includes('buycycle')) return 'buycycle';
        if (rawData.html && rawData.html.includes('kleinanzeigen')) return 'kleinanzeigen';
        return 'buycycle';
    }

    getPreprocessor(source) {
        return this.preprocessors[source] || this.preprocessors.manual;
    }

    postProcess(unified, preprocessed, source) {
        let result = unified;
        if (!result) {
            console.log('   ⚠️ [UnifiedNormalizer] Unified result is null/undefined, using fallback');
            result = this.gemini.getFallbackJSON(preprocessed, null, source);
        }

        result.meta = result.meta || {};
        result.basic_info = result.basic_info || {};
        result.pricing = result.pricing || {};
        result.specs = result.specs || {};
        result.condition = result.condition || {};
        result.media = result.media || {};
        result.audit = result.audit || {};
        result.features = result.features || {};
        result.ranking = result.ranking || {};

        result.meta.source_platform = source;
        result.meta.source_url = preprocessed.url || result.meta.source_url || null;
        result.meta.source_ad_id = preprocessed.source_ad_id || result.meta.source_ad_id || null;
        result.meta.created_at = result.meta.created_at || new Date().toISOString();
        result.meta.is_active = result.meta.is_active !== false;

        this.applyBrandCorrections(result);
        this.applyBrandModelFallback(result, preprocessed);
        this.applyYearFallback(result, preprocessed);
        this.applyTaxonomyFallback(result, preprocessed);
        this.applyWheelSizeNormalization(result, preprocessed);
        this.applyConditionNormalization(result);
        this.applySellerNormalization(result, preprocessed);
        this.applySourceAdIdFallback(result, preprocessed);
        this.applyShippingDefaults(result, source);
        this.applyImages(result, preprocessed);
        this.applyQualityScore(result);
        this.applyCompletenessScore(result);
        this.applyDuplicateCheck(result);
        this.applyLowQualityAudit(result);

        if (!result.basic_info.name && preprocessed.title) result.basic_info.name = preprocessed.title;
        if (!result.basic_info.brand && preprocessed.brand) result.basic_info.brand = preprocessed.brand;
        if (!result.basic_info.model && preprocessed.model) result.basic_info.model = preprocessed.model;
        if (!result.basic_info.year && preprocessed.year) result.basic_info.year = preprocessed.year;
        
        if (!result.pricing.price && result.pricing.pprice) {
            result.pricing.price = result.pricing.pprice;
            delete result.pricing.pprice;
        }
        if (!result.pricing.price && preprocessed.price) result.pricing.price = preprocessed.price;
        result.features.raw_specs = result.features.raw_specs || {};
        if (preprocessed.components) result.features.raw_specs.components = preprocessed.components;
        if (preprocessed.general_info) result.features.raw_specs.general_info = preprocessed.general_info;

        return result;
    }

    buildTaxonomyIndex() {
        const index = {
            byBrandAndModel: new Map(),
            byModel: new Map()
        };

        const addEntry = (brand, model, category, discipline, subCategory) => {
            if (!model) return;
            const normalizedBrand = this.normalizeToken(brand);
            const normalizedModel = this.normalizeToken(model);
            if (!normalizedModel) return;

            const payload = {
                category: category || null,
                discipline: discipline || null,
                sub_category: subCategory || null
            };

            if (normalizedBrand) {
                index.byBrandAndModel.set(`${normalizedBrand}::${normalizedModel}`, payload);
            }
            if (!index.byModel.has(normalizedModel)) {
                index.byModel.set(normalizedModel, payload);
            }
        };

        try {
            const whitelistPath = path.resolve(__dirname, '../../config/fmv-whitelist.json');
            if (fs.existsSync(whitelistPath)) {
                const whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
                const brands = Array.isArray(whitelist?.brands) ? whitelist.brands : [];
                for (const brandItem of brands) {
                    const brandName = brandItem?.brand || null;
                    const models = Array.isArray(brandItem?.models) ? brandItem.models : [];
                    for (const modelItem of models) {
                        const mapped = this.mapCategoryFromLabel(modelItem?.category);
                        addEntry(brandName, modelItem?.model, mapped.category, mapped.discipline, mapped.sub_category);
                    }
                }
            }
        } catch (e) {
            console.error(`   âš ï¸ Taxonomy whitelist load failed: ${e.message}`);
        }

        try {
            const projectRoot = path.resolve(__dirname, '../../..');
            const brandConstantsPath = path.resolve(projectRoot, 'telegram-bot/BrandConstants.js');
            if (fs.existsSync(brandConstantsPath)) {
                // eslint-disable-next-line global-require, import/no-dynamic-require
                const { BRAND_MODELS } = require(brandConstantsPath);
                if (BRAND_MODELS && typeof BRAND_MODELS === 'object') {
                    for (const [groupLabel, group] of Object.entries(BRAND_MODELS)) {
                        const mapped = this.mapCategoryFromLabel(groupLabel);
                        const groupBrands = Array.isArray(group?.brands) ? group.brands : [];
                        const groupModels = Array.isArray(group?.models) ? group.models : [];
                        for (const model of groupModels) {
                            if (groupBrands.length > 0) {
                                for (const brand of groupBrands) {
                                    addEntry(brand, model, mapped.category, mapped.discipline, mapped.sub_category);
                                }
                            } else {
                                addEntry(null, model, mapped.category, mapped.discipline, mapped.sub_category);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`   âš ï¸ Brand constants taxonomy load failed: ${e.message}`);
        }

        return index;
    }

    mapCategoryFromLabel(label) {
        const source = this.normalizeToken(label);
        if (!source) return { category: null, discipline: null, sub_category: null };
        if (source.includes('dh') || source.includes('downhill')) return { category: 'mtb', discipline: 'downhill', sub_category: 'downhill' };
        if (source.includes('enduro')) return { category: 'mtb', discipline: 'enduro', sub_category: 'enduro' };
        if (source.includes('trail')) return { category: 'mtb', discipline: 'trail_riding', sub_category: 'trail' };
        if (source.includes('xc') || source.includes('cross country')) return { category: 'mtb', discipline: 'cross_country', sub_category: 'cross_country' };
        if (source.includes('emtb') || source.includes('e mtb')) return { category: 'mtb', discipline: 'emtb', sub_category: 'emtb' };
        if (source.includes('gravel')) {
            if (source.includes('race')) return { category: 'gravel', discipline: 'gravel', sub_category: 'race' };
            if (source.includes('bikepacking')) return { category: 'gravel', discipline: 'gravel', sub_category: 'bikepacking' };
            return { category: 'gravel', discipline: 'gravel', sub_category: 'all_road' };
        }
        if (source.includes('road')) {
            if (source.includes('aero')) return { category: 'road', discipline: 'road', sub_category: 'aero' };
            if (source.includes('endurance')) return { category: 'road', discipline: 'road', sub_category: 'endurance' };
            if (source.includes('climbing')) return { category: 'road', discipline: 'road', sub_category: 'climbing' };
            if (source.includes('tt') || source.includes('triathlon')) return { category: 'road', discipline: 'road', sub_category: 'tt' };
            return { category: 'road', discipline: 'road', sub_category: 'road' };
        }
        return { category: null, discipline: null, sub_category: null };
    }

    normalizeToken(value) {
        if (!value && value !== 0) return '';
        return String(value)
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/[^\p{L}\p{N} ]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isMissingValue(value) {
        if (value === null || value === undefined) return true;
        const text = String(value).trim().toLowerCase();
        return text === '' || text === 'unknown' || text === 'other' || text === 'n/a' || text === 'null';
    }

    applyBrandModelFallback(result, preprocessed) {
        result.basic_info = result.basic_info || {};
        const currentBrand = result.basic_info.brand;
        const currentModel = result.basic_info.model;
        if (this.isMissingValue(currentBrand)) {
            result.basic_info.brand = preprocessed.brand || result.basic_info.brand || null;
        }
        if (this.isMissingValue(currentModel)) {
            result.basic_info.model = preprocessed.model || result.basic_info.model || null;
        }
    }

    applyTaxonomyFallback(result, preprocessed) {
        result.basic_info = result.basic_info || {};

        const brand = result.basic_info.brand || preprocessed.brand || null;
        const model = result.basic_info.model || preprocessed.model || null;
        const title = result.basic_info.name || preprocessed.title || '';
        const normalizedBrand = this.normalizeToken(brand);
        const normalizedModel = this.normalizeToken(model);
        const normalizedTitle = this.normalizeToken(title);

        let mapped = null;
        if (normalizedBrand && normalizedModel) {
            mapped = this.taxonomy.byBrandAndModel.get(`${normalizedBrand}::${normalizedModel}`) || null;
        }

        if (!mapped && normalizedModel) {
            mapped = this.taxonomy.byModel.get(normalizedModel) || null;
        }

        if (!mapped && normalizedTitle) {
            for (const [modelKey, payload] of this.taxonomy.byModel.entries()) {
                if (normalizedTitle.includes(modelKey)) {
                    mapped = payload;
                    break;
                }
            }
        }

        if (!mapped) return;
        const shouldOverwriteCategory =
            this.isMissingValue(result.basic_info.category)
            || ['other', 'unknown'].includes(String(result.basic_info.category || '').toLowerCase());
        const shouldOverwriteDiscipline =
            this.isMissingValue(result.basic_info.discipline)
            || ['other', 'unknown'].includes(String(result.basic_info.discipline || '').toLowerCase());
        const shouldOverwriteSubCategory =
            this.isMissingValue(result.basic_info.sub_category)
            || ['other', 'unknown'].includes(String(result.basic_info.sub_category || '').toLowerCase());

        if (shouldOverwriteCategory && !this.isMissingValue(mapped.category)) {
            result.basic_info.category = mapped.category;
        }
        if (shouldOverwriteDiscipline && !this.isMissingValue(mapped.discipline)) {
            result.basic_info.discipline = mapped.discipline;
        }
        if (shouldOverwriteSubCategory && !this.isMissingValue(mapped.sub_category)) {
            result.basic_info.sub_category = mapped.sub_category;
        }
    }

    normalizeWheelSizeValue(value) {
        if (value === null || value === undefined) return null;
        const text = String(value).toLowerCase().replace(',', '.').replace(/["']/g, '');
        if (text.includes('mullet') || text.includes('mallet') || text.includes('mixed') || /\bmx\b/.test(text)) return 'mullet';
        if (text.includes('700c') || /\b28\b/.test(text)) return '700c';
        if (text.includes('650b') || text.includes('27.5') || /\b27\.?5\b/.test(text)) return '27.5';
        if (/\b29\b/.test(text)) return '29';
        if (/\b26\b/.test(text)) return '26';
        return null;
    }

    applyWheelSizeNormalization(result, preprocessed) {
        result.specs = result.specs || {};
        const candidates = [];
        candidates.push(result.specs.wheel_size);
        candidates.push(preprocessed.wheel_size);
        candidates.push(preprocessed.wheelDiameter);
        candidates.push(preprocessed.wheel_diameter);
        if (preprocessed.general_info && typeof preprocessed.general_info === 'object') {
            for (const value of Object.values(preprocessed.general_info)) candidates.push(value);
        }
        if (preprocessed.components && typeof preprocessed.components === 'object') {
            for (const value of Object.values(preprocessed.components)) candidates.push(value);
        }
        candidates.push(result.basic_info?.name);
        candidates.push(preprocessed.title);

        for (const value of candidates) {
            const normalized = this.normalizeWheelSizeValue(value);
            if (normalized) {
                result.specs.wheel_size = normalized;
                result.specs.wheel_diameter = normalized;
                return;
            }
        }
    }

    applyConditionNormalization(result) {
        result.condition = result.condition || {};
        const raw = Number(result.condition.score);
        if (Number.isFinite(raw)) {
            const scaled = raw <= 10 ? raw * 10 : raw;
            const score = Math.max(0, Math.min(100, Math.round(scaled)));
            result.condition.score = score;
            if (!result.condition.grade) {
                if (score >= 95) result.condition.grade = 'A+';
                else if (score >= 80) result.condition.grade = 'A';
                else if (score >= 41) result.condition.grade = 'B';
                else result.condition.grade = 'C';
            }
            if (!result.condition.class) {
                if (score >= 95) result.condition.class = 'excellent';
                else if (score >= 80) result.condition.class = 'very_good';
                else if (score >= 41) result.condition.class = 'good';
                else if (score >= 21) result.condition.class = 'fair';
                else result.condition.class = 'poor';
            }
        }
    }

    applySellerNormalization(result, preprocessed) {
        result.seller = result.seller || {};
        const candidate = String(result.seller.type || preprocessed?.seller_type || preprocessed?.seller?.type || '').toLowerCase();
        if (!candidate) {
            result.seller.type = 'private';
            return;
        }
        if (candidate.includes('privat') || candidate.includes('private')) {
            result.seller.type = 'private';
            return;
        }
        if (
            candidate.includes('gewerblich') ||
            candidate.includes('dealer') ||
            candidate.includes('shop') ||
            candidate.includes('commercial') ||
            candidate.includes('händler') ||
            candidate.includes('handler') ||
            candidate.includes('pro')
        ) {
            result.seller.type = 'pro';
            return;
        }
        result.seller.type = 'private';
    }

    applySourceAdIdFallback(result, preprocessed) {
        result.meta = result.meta || {};
        const current = String(result.meta.source_ad_id || '').trim();
        if (current && current !== 'null' && current !== 'undefined') return;
        const sourceUrl = String(result.meta.source_url || preprocessed?.url || '');
        const klein = sourceUrl.match(/\/(\d+)-\d+-\d+\/?$/);
        if (klein) {
            result.meta.source_ad_id = klein[1];
            return;
        }
        const buycycle = sourceUrl.match(/-(\d{3,})\/?$/);
        if (buycycle) {
            result.meta.source_ad_id = buycycle[1];
        }
    }

    applyShippingDefaults(result, source) {
        result.logistics = result.logistics || {};
        const normalizedSource = this.normalizeToken(source || result.meta?.source_platform || '');
        if (normalizedSource === 'buycycle') {
            result.logistics.shipping_option = 'available';
        }
        // Shipping cost is not persisted at catalog ingestion time.
        result.logistics.shipping_cost = null;
    }

    applyBrandCorrections(result) {
        if (!result.basic_info.brand) return;
        const brand = result.basic_info.brand;
        const corrections = {
            'Specialized Bicycle Components': 'Specialized',
            'Giant Bicycles': 'Giant',
            'Trek Bikes': 'Trek',
            'Cannondale Bikes': 'Cannondale',
            'Scott Sports': 'Scott',
            'Santa Cruz Bicycles': 'Santa Cruz',
            'Yeti Cycles': 'Yeti',
            'Canyon Bicycles': 'Canyon',
            'Cube Bikes': 'Cube',
            'Merida Bikes': 'Merida',
            'Orbea Bicycles': 'Orbea',
            'Bianchi Bicycles': 'Bianchi',
            'Pinarello': 'Pinarello',
            'Colnago': 'Colnago',
            'Cervelo': 'Cervélo',
            'Cervélo': 'Cervélo',
            'BMC Switzerland': 'BMC',
            'Focus Bikes': 'Focus',
            'KTM Bike Industries': 'KTM',
            'Ghost Bikes': 'Ghost',
            'Radon Bikes': 'Radon',
            'Rose Bikes': 'Rose'
        };
        if (corrections[brand]) {
            result.basic_info.brand = corrections[brand];
        }
    }

    applyYearFallback(result, preprocessed) {
        if (result.basic_info.year) return;
        const title = result.basic_info.name || preprocessed.title || '';
        const yearMatch = title.match(/\b(20\d{2})\b/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            if (year >= 2000 && year <= new Date().getFullYear() + 1) {
                result.basic_info.year = year;
            }
        }
    }

    applyImages(result, preprocessed) {
        // Ensure gallery is array
        if (!Array.isArray(result.media.gallery)) {
            result.media.gallery = [];
        }

        // Merge preprocessed images (Unified Hunter Logic: Merge source gallery with Gemini gallery)
        if (Array.isArray(preprocessed.images)) {
             const existingUrls = new Set(result.media.gallery);
             for (const img of preprocessed.images) {
                 if (!existingUrls.has(img)) {
                     result.media.gallery.push(img);
                     existingUrls.add(img);
                 }
             }
        }

        // Filter invalid images
        result.media.gallery = result.media.gallery.filter(url => !this.isInvalidImage(url));

        // Prefer ImageKit assets for stable catalog rendering
        const imagekitOnly = result.media.gallery.filter((url) => {
            try {
                const host = new URL(String(url)).hostname.toLowerCase();
                return host === 'ik.imagekit.io' || host.endsWith('.imagekit.io');
            } catch {
                return false;
            }
        });
        if (imagekitOnly.length > 0) {
            result.media.gallery = imagekitOnly;
        }

        // Ensure main_image is set
        if (!result.media.main_image && result.media.gallery.length > 0) {
            result.media.main_image = result.media.gallery[0];
        }
        
        // Check if main_image is invalid, if so pick another
        if (this.isInvalidImage(result.media.main_image)) {
             result.media.main_image = result.media.gallery.length > 0 ? result.media.gallery[0] : null;
        }
    }

    applyQualityScore(result) {
        // Ensure quality_score exists
        if (typeof result.quality_score !== 'number') {
            result.quality_score = 50; // Default base
        }
        
        if (result.quality_score > 0 && result.quality_score !== 50) return; // Already scored by AI (assuming 50 is default/unscored)

        const brand = result.basic_info.brand;
        const model = result.basic_info.model;
        const year = result.basic_info.year;
        const description = result.basic_info.description || '';
        const images = Array.isArray(result.media.gallery) ? result.media.gallery : [];
        let score = result.quality_score;

        if (brand && model && brand !== 'Unknown' && model !== 'Unknown') score += 5;
        if (year && year > new Date().getFullYear() - 5) score += 5;
        if (images.length > 2) score += 5;
        if (description.length > 200) score += 5;
        if (!result.media.main_image && images.length === 0) score -= 30;
        if (description.length > 0 && description.length < 20) score -= 10;
        
        // Critical failures (No price, no title) -> Score 0
        const isNameInvalid = !result.basic_info.name || result.basic_info.name === 'Unknown' || result.basic_info.name === 'Unknown Bike';
        if (!result.pricing.price && isNameInvalid) {
            score = 0;
        }

        result.quality_score = Math.min(100, Math.max(0, score));
    }

    applyLowQualityAudit(result) {
        if (result.quality_score < 40) {
            result.audit.needs_audit = true;
            result.audit.audit_status = 'low_quality';
            result.audit.audit_notes = result.audit.audit_notes || `Низкий quality_score (${result.quality_score})`;
        }
    }

    applyCompletenessScore(result) {
        const fields = [
            result.basic_info.name,
            result.basic_info.brand,
            result.basic_info.model,
            result.basic_info.year,
            result.basic_info.category,
            result.basic_info.description,
            result.pricing.price,
            result.pricing.currency,
            result.specs.frame_size,
            result.specs.wheel_size,
            result.specs.frame_material,
            result.specs.groupset,
            result.specs.brakes,
            result.specs.fork,
            result.specs.shock,
            result.condition.status,
            result.condition.score,
            result.media.main_image
        ];
        const total = fields.length + 1;
        const filled = fields.filter(value => value !== null && value !== undefined && value !== '').length
            + (Array.isArray(result.media.gallery) && result.media.gallery.length > 0 ? 1 : 0);
        const pct = Math.round((filled / total) * 100);
        result.meta.completeness_score = pct;
        // Keep completeness as 0..1 fraction for DB/API consistency.
        result.completeness = pct / 100;
    }

    applyDuplicateCheck(result) {
        const source = result.meta.source_platform;
        const adId = result.meta.source_ad_id;
        if (!source || !adId) return;
        if (!fs.existsSync(this.dbPath)) return;
        let db;
        try {
            db = new Database(this.dbPath, { readonly: true });
            const row = db.prepare('SELECT id FROM bikes WHERE source_platform = ? AND source_ad_id = ? LIMIT 1').get(source, adId);
            if (row) {
                result.audit.needs_audit = true;
                result.audit.audit_status = 'duplicate';
                result.audit.audit_notes = `Дубликат source_platform=${source}, source_ad_id=${adId}`;
            }
        } catch (e) {
            result.audit.needs_audit = true;
            result.audit.audit_status = 'duplicate_check_failed';
            result.audit.audit_notes = `Ошибка проверки дубликатов: ${e.message}`;
        } finally {
            if (db) db.close();
        }
    }

    isInvalidImage(url) {
        const lower = String(url).toLowerCase();
        if (!lower) return true;
        if (lower.includes('.svg')) return true;
        if (lower.includes('/icons/')) return true;
        if (lower.includes('placeholder')) return true;
        if (lower.includes('buycyclebwhite')) return true;
        if (lower.includes('logo')) return true;
        const sizeMatches = lower.match(/[?&](w|width|h|height)=([0-9]{1,4})/g) || [];
        const sizes = sizeMatches.map(match => parseInt(match.split('=')[1], 10)).filter(Number.isFinite);
        if (sizes.length > 0 && Math.max(...sizes) < 100) return true;
        const dimMatch = lower.match(/(\d{2,3})x(\d{2,3})/);
        if (dimMatch) {
            const w = parseInt(dimMatch[1], 10);
            const h = parseInt(dimMatch[2], 10);
            if (w < 100 && h < 100) return true;
        }
        return false;
    }
}

module.exports = new UnifiedNormalizer();
