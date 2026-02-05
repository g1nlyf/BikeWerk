const DatabaseManager = require('../../database/db-manager');
const UnifiedBikeMapper = require('../mappers/unified-bike-mapper');
const PhotoManager = require('./PhotoManager');

class DatabaseService {
    constructor(options = {}) {
        this.dbManager = options.dbManager || new DatabaseManager();
        this.photoManager = options.photoManager || new PhotoManager(options.photoOptions || {});
        this.log = options.logger || ((message) => console.log(message));
    }

    validateUnifiedBike(bike) {
        const missing = [];
        if (!bike || typeof bike !== 'object') return ['bike'];
        const meta = bike.meta || {};
        const basic = bike.basic_info || {};
        if (!meta.source_platform) missing.push('meta.source_platform');
        if (!meta.source_ad_id) missing.push('meta.source_ad_id');
        if (!basic.brand) missing.push('basic_info.brand');
        if (!basic.model) missing.push('basic_info.model');
        return missing;
    }

    async saveBikesToDB(bikeData, options = {}) {
        const bikes = Array.isArray(bikeData) ? bikeData : [bikeData];
        const db = this.dbManager.getDatabase();
        const includePhotoResults = options.includePhotoResults === true;
        const summary = {
            total: bikes.length,
            inserted: 0,
            duplicates: 0,
            failed: 0,
            photosDownloaded: 0,
            photosTotal: 0,
            results: []
        };

        const insertBike = db.prepare(`
            INSERT INTO bikes (
                name, brand, model, year, price, original_price, discount, currency, category, sub_category, wheel_size,
                condition_score, condition_grade, condition_status, quality_score, ranking_score, hotness_score, is_hot_offer,
                description, main_image, gallery, source_url, source_platform, source_ad_id,
                is_active, created_at, updated_at,
                unified_data, specs_json, inspection_json, seller_json, logistics_json, features_json, fmv, size,
                discipline, is_new, seller_type, delivery_option, completeness
            ) VALUES (
                @name, @brand, @model, @year, @price, @original_price, @discount, @currency, @category, @sub_category, @wheel_size,
                @condition_score, @condition_grade, @condition_status, @quality_score, @ranking_score, @hotness_score, @is_hot_offer,
                @description, @main_image, @gallery, @source_url, @source_platform, @source_ad_id,
                @is_active, @created_at, @updated_at,
                @unified_data, @specs_json, @inspection_json, @seller_json, @logistics_json, @features_json, @fmv, @size,
                @discipline, @is_new, @seller_type, @delivery_option, @completeness
            )
        `);

        const imageColumns = db.prepare('PRAGMA table_info(bike_images)').all().map((row) => row.name);
        const imageColumnSet = new Set(imageColumns);
        const imageInsertColumns = [
            'bike_id',
            'image_url',
            'local_path',
            'image_type',
            'position',
            'is_main',
            'image_order',
            'is_downloaded',
            'download_attempts',
            'download_failed',
            'width',
            'height'
        ].filter((col) => imageColumnSet.has(col));
        const imageInsertPlaceholders = imageInsertColumns.map(() => '?').join(', ');
        const insertImage = db.prepare(`
            INSERT OR IGNORE INTO bike_images (${imageInsertColumns.join(', ')})
            VALUES (${imageInsertPlaceholders})
        `);

        const updateBikeMainImage = db.prepare(`
            UPDATE bikes SET main_image = ?, updated_at = ? WHERE id = ?
        `);

        const checkDuplicate = db.prepare(`
            SELECT id FROM bikes WHERE source_platform = ? AND source_ad_id = ? LIMIT 1
        `);

        for (const bike of bikes) {
            try {
                const missing = this.validateUnifiedBike(bike);
                if (missing.length > 0) {
                    summary.failed += 1;
                    summary.results.push({ success: false, reason: 'missing_fields', missing });
                    this.log(`❌ [DatabaseService] Отказ: отсутствуют поля ${missing.join(', ')}`);
                    continue;
                }

                // 3.1 Validation: Check for valid photos
                const mainImage = bike.media?.main_image;
                const gallery = Array.isArray(bike.media?.gallery) ? bike.media.gallery : [];
                const allImages = Array.from(new Set([mainImage, ...gallery].filter(Boolean)));

                const validPhotos = allImages.filter(url => {
                    const lower = String(url).toLowerCase();
                    return !lower.includes('buycyclebwhite') && !lower.includes('.svg') && !lower.includes('/icon/');
                });

                if (validPhotos.length === 0) {
                    // Mark as needing audit instead of failing completely, but log warning
                    bike.audit = bike.audit || {};
                    bike.audit.needs_audit = true;
                    bike.audit.audit_status = 'no_photos';
                    bike.audit.audit_notes = 'No valid photos found';
                    this.log(`⚠️ [DatabaseService] Bike has no valid photos. Marked for audit.`);
                }

                const platform = bike.meta?.source_platform;
                const adId = bike.meta?.source_ad_id;
                const existing = checkDuplicate.get(platform, adId);
                if (existing) {
                    summary.duplicates += 1;
                    summary.results.push({ success: false, duplicate: true, bike_id: existing.id });
                    this.log(`⚠️ [DatabaseService] Дубликат: ${platform} ${adId}`);
                    continue;
                }

                const mapped = UnifiedBikeMapper.toDatabase(bike);
                const nowIso = new Date().toISOString();
                const record = {
                    ...mapped,
                    name: mapped.name || bike.basic_info?.name || `${bike.basic_info?.brand || 'Unknown'} ${bike.basic_info?.model || 'Unknown'}`.trim(),
                    brand: mapped.brand || bike.basic_info?.brand,
                    model: mapped.model || bike.basic_info?.model,
                    year: mapped.year || bike.basic_info?.year || new Date().getFullYear(),
                    price: mapped.price ?? bike.pricing?.price ?? 0,
                    original_price: mapped.original_price || bike.pricing?.original_price || null,
                    discount: mapped.discount ?? bike.pricing?.discount ?? 0,
                    currency: mapped.currency || bike.pricing?.currency || 'EUR',
                    category: mapped.category || bike.basic_info?.category || 'Mountain Bike',
                    condition_score: mapped.condition_score || bike.condition?.score || bike.quality_score || 0,
                    condition_grade: mapped.condition_grade || bike.condition?.grade || null,
                    condition_status: mapped.condition_status || bike.condition?.status || null,
                    quality_score: mapped.quality_score || bike.quality_score || null,
                    ranking_score: mapped.ranking_score || bike.ranking?.ranking_score || null,
                    hotness_score: mapped.hotness_score || bike.ranking?.hotness_score || null,
                    description: mapped.description || bike.basic_info?.description || '',
                    main_image: mapped.main_image || bike.media?.main_image || '',
                    source_url: mapped.source_url || bike.meta?.source_url || '',
                    source_platform: mapped.source_platform || bike.meta?.source_platform || '',
                    source_ad_id: mapped.source_ad_id || bike.meta?.source_ad_id || '',
                    is_active: mapped.is_active ?? (bike.meta?.is_active ? 1 : 0),
                    created_at: mapped.created_at || nowIso,
                    updated_at: mapped.updated_at || nowIso,
                    unified_data: mapped.unified_data || JSON.stringify(bike || {}),
                    specs_json: mapped.specs_json,
                    inspection_json: mapped.inspection_json,
                    seller_json: mapped.seller_json,
                    logistics_json: mapped.logistics_json,
                    features_json: mapped.features_json,
                    fmv: mapped.fmv || bike.pricing?.fmv || null,
                    fmv_confidence: mapped.fmv_confidence || null,
                    market_comparison: mapped.market_comparison || null,
                    optimal_price: mapped.optimal_price || null,
                    days_on_market: mapped.days_on_market || 0,
                    size: mapped.size || bike.specs?.frame_size || null,
                    discipline: bike.discipline || mapped.discipline || bike.basic_info?.discipline || null,
                    is_new: bike.is_new ?? mapped.is_new ?? (bike.condition?.status === 'new' ? 1 : 0),
                    seller_type: bike.seller_type || mapped.seller_type || bike.seller?.type || 'unknown',
                    sub_category: mapped.sub_category || bike.basic_info?.sub_category || null,
                    wheel_size: mapped.wheel_size || bike.specs?.wheel_size || (mapped.specs_json ? JSON.parse(mapped.specs_json).wheel_size : null) || null,
                    delivery_option: (() => {
                        const opt = bike.shipping_option || mapped.shipping_option || bike.logistics?.shipping_option || 'unknown';
                        if (opt === 'seller_arranged') return 'delivery';
                        if (['delivery', 'pickup_only', 'both', 'unknown'].includes(opt)) return opt;
                        return 'unknown';
                    })(),
                    completeness: bike.completeness || mapped.completeness || bike.meta?.completeness_score || 0,
                    is_hot_offer: bike.ranking?.is_hot_offer ? 1 : (mapped.is_hot_offer ? 1 : 0)
                };

                this.log(`DEBUG RECORD: discipline=${record.discipline}, seller_type=${record.seller_type}, delivery_option=${record.delivery_option}, completeness=${record.completeness}`);

                const info = insertBike.run(record);
                const bikeId = info.lastInsertRowid;
                summary.photosTotal += validPhotos.length;

                let downloaded = [];
                if (options.skipPhotoDownload) {
                    downloaded = validPhotos.map((url, index) => ({
                        image_url: url,
                        local_path: null,
                        is_downloaded: 0,
                        download_attempts: 0,
                        download_failed: 0,
                        width: null,
                        height: null,
                        position: index
                    }));
                } else if (validPhotos.length > 0) {
                    downloaded = await this.photoManager.downloadAndSave(bikeId, validPhotos);
                }

                downloaded.forEach((img, index) => {
                    const isMain = img.image_url === record.main_image ? 1 : 0;
                    const imageType = isMain ? 'main' : 'gallery';
                    const imageOrder = img.position ?? index;
                    const valuesByColumn = {
                        bike_id: bikeId,
                        image_url: img.image_url,
                        local_path: img.local_path,
                        image_type: imageType,
                        position: imageOrder,
                        is_main: isMain,
                        image_order: imageOrder,
                        is_downloaded: img.is_downloaded ? 1 : 0,
                        download_attempts: img.download_attempts ?? 0,
                        download_failed: img.download_failed ?? 0,
                        width: img.width ?? null,
                        height: img.height ?? null
                    };
                    const values = imageInsertColumns.map((col) => valuesByColumn[col]);
                    insertImage.run(values);
                });

                // Update main_image with ImageKit URL if available
                const mainPhoto = downloaded.find(img => img.is_downloaded === 1 && (img.is_main || img.position === 0));
                if (mainPhoto && mainPhoto.local_path && mainPhoto.local_path.startsWith('http')) {
                    updateBikeMainImage.run(mainPhoto.local_path, nowIso, bikeId);

                    // Also update Unified JSON with new URLs
                    const updatedGallery = downloaded.map(d => d.local_path || d.image_url);
                    const updatedUnified = { ...bike };
                    if (!updatedUnified.media) updatedUnified.media = {};
                    updatedUnified.media.gallery = updatedGallery;
                    updatedUnified.media.main_image = mainPhoto.local_path;

                    db.prepare('UPDATE bikes SET unified_data = ?, gallery = ? WHERE id = ?').run(
                        JSON.stringify(updatedUnified),
                        JSON.stringify(updatedGallery),
                        bikeId
                    );
                }

                summary.photosDownloaded += downloaded.filter(d => d.is_downloaded === 1).length;
                summary.inserted += 1;
                if (includePhotoResults) {
                    summary.results.push({ success: true, bike_id: bikeId, photoResults: downloaded });
                } else {
                    summary.results.push({ success: true, bike_id: bikeId });
                }
                this.log(`✅ [DatabaseService] Сохранено: ${record.name} (ID: ${bikeId}, Photos: ${downloaded.length})`);

            } catch (error) {
                summary.failed += 1;
                summary.results.push({ success: false, reason: error.message });
                this.log(`❌ [DatabaseService] Ошибка сохранения: ${error.message}`);
                console.error(error);
            }
        }

        return summary;
    }
}

module.exports = DatabaseService;
