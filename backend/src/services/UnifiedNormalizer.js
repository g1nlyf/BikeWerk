const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
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
        this.dbPath = path.resolve(__dirname, '../../database/eubike.db');
        this.dbManager = new DatabaseManager();
        this.fmvAnalyzer = new FMVAnalyzer(this.dbManager);
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
                const fmvData = await this.fmvAnalyzer.getFairMarketValue(brand, model, year);
                
                if (fmvData) {
                    processed.pricing.fmv = fmvData.fmv;
                    processed.pricing.fmv_confidence = fmvData.confidence;
                    // processed.pricing.optimal_price = fmvData.price_range?.min || null; 
                    
                    // Calculate Market Comparison
                    const price = processed.pricing.price;
                    if (price && fmvData.fmv) {
                         const comparison = this.fmvAnalyzer.getMarketComparison(price, fmvData.fmv);
                         processed.pricing.market_comparison = comparison;
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
        this.applyYearFallback(result, preprocessed);
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
        result.meta.completeness_score = Math.round((filled / total) * 100);
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
