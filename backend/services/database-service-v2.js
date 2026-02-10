const Database = require('better-sqlite3');
const { DB_PATH } = require('../config/db-path');

/**
 * DATABASE SERVICE V2 - Ð˜Ð¡ÐŸÐ ÐÐ’Ð›Ð•ÐÐÐ«Ð™
 * Ð¢Ð¾Ñ‡Ð½Ñ‹Ð¹ Ð¼Ð°Ð¿Ð¿Ð¸Ð½Ð³ Ð½Ð° 191 ÑÑ‚Ð¾Ð»Ð±ÐµÑ† Ð‘Ð”
 */
class DatabaseServiceV2 {

  constructor(dbPath) {
    this.dbPath = dbPath || DB_PATH;
    this.db = new Database(this.dbPath);

    console.log(`âœ… Database Service v2.0 initialized`);
    console.log(`   Database: ${this.dbPath}`);
  }

  normalizeCategory(value) {
    if (value === undefined || value === null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const v = raw.toLowerCase();
    if (v.includes('mountain') || v.includes('mtb')) return 'mtb';
    if (v.includes('road') || v.includes('rennrad')) return 'road';
    if (v.includes('gravel')) return 'gravel';
    if (v.includes('e-bike') || v.includes('ebike') || v.includes('pedelec') || v.includes('emtb')) return 'emtb';
    if (v.includes('kid') || v.includes('child') || v.includes('kinder') || v.includes('youth')) return 'kids';
    return 'other';
  }

  normalizeWheelSize(value) {
    if (value === undefined || value === null) return null;
    const text = String(value)
      .toLowerCase()
      .replace(/["']/g, '')
      .replace(',', '.')
      .trim();
    if (text.includes('mullet') || text.includes('mallet') || /\bmx\b/.test(text) || text.includes('mixed')) return 'mullet';
    if (text.includes('700c') || /\b28\b/.test(text)) return '700c';
    if (text.includes('650b') || text.includes('27.5') || /\b27\.?5\b/.test(text)) return '27.5';
    if (/\b29\b/.test(text)) return '29';
    if (/\b26\b/.test(text)) return '26';
    return null;
  }

  normalizeSellerType(value) {
    if (value === undefined || value === null) return 'private';
    const text = String(value).trim().toLowerCase();
    if (!text) return 'private';
    if (text.includes('privat') || text.includes('private')) return 'private';
    if (
      text.includes('gewerblich') ||
      text.includes('dealer') ||
      text.includes('shop') ||
      text.includes('händler') ||
      text.includes('handler') ||
      text.includes('commercial') ||
      text.includes('pro')
    ) {
      return 'pro';
    }
    return 'private';
  }

  normalizeFrameSize(value, category) {
    if (value === undefined || value === null) return null;
    const raw = String(value).trim().toUpperCase();
    if (!raw) return null;

    const combo = raw.match(/\b(XXL|XL|L|M|S|XS)\s*[\/-]\s*(XXL|XL|L|M|S|XS)\b/);
    if (combo) return `${combo[1]}/${combo[2]}`;

    // Specialized sizing family (S1..S6)
    const specialized = raw.match(/\bS([1-6])\b/);
    if (specialized) return `S${specialized[1]}`;

    const compact = raw.replace(/\s+/g, '');
    if (['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(compact)) return compact;

    // Explicit metric / inch sizes
    const cm = raw.match(/\b(\d{2,3}(?:[.,]\d)?)\s*CM\b/);
    if (cm) return `${cm[1].replace(',', '.')} cm`;
    const inch = raw.match(/\b(\d{2}(?:[.,]\d)?)\s*(?:\"|INCH|ZOLL)\b/);
    if (inch) return `${inch[1].replace(',', '.')}\"`;

    // Numeric road sizes (e.g., 52/54/56/58)
    const numeric = compact.match(/\b(4[6-9]|5[0-9]|6[0-2])\b/);
    if (numeric) return numeric[1];

    // "SMALL/MEDIUM/LARGE" -> S/M/L
    if (compact.includes('SMALL')) return 'S';
    if (compact.includes('MEDIUM')) return 'M';
    if (compact.includes('LARGE')) return 'L';

    // For MTB/eMTB keep compact canonical size labels
    const categoryText = String(category || '').toLowerCase();
    if (categoryText === 'mtb' || categoryText === 'emtb') {
      return compact;
    }
    return compact;
  }

  normalizeConditionScore(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    // Legacy flows sometimes returned 0..10 scale.
    const scaled = num <= 10 ? num * 10 : num;
    const clamped = Math.max(0, Math.min(100, scaled));
    return Math.round(clamped);
  }

  deriveConditionGrade(score) {
    if (!Number.isFinite(score)) return null;
    if (score >= 95) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 41) return 'B';
    return 'C';
  }

  deriveConditionClass(score) {
    if (!Number.isFinite(score)) return null;
    if (score >= 95) return 'excellent';
    if (score >= 80) return 'very_good';
    if (score >= 41) return 'good';
    if (score >= 21) return 'fair';
    return 'poor';
  }

  extractSourceAdId(sourceAdId, sourceUrl) {
    const direct = sourceAdId === undefined || sourceAdId === null ? '' : String(sourceAdId).trim();
    if (direct && direct.toLowerCase() !== 'null' && direct.toLowerCase() !== 'undefined') {
      return direct;
    }

    const url = String(sourceUrl || '');
    // Kleinanzeigen: .../<adId>-...
    const klein = url.match(/\/(\d+)-\d+-\d+\/?$/);
    if (klein) return klein[1];
    // Buycycle: ...-52266
    const buycycle = url.match(/-(\d{3,})\/?$/);
    if (buycycle) return buycycle[1];
    return null;
  }

  normalizeDiscipline(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim().toLowerCase();
    if (!text) return null;
    if (text.includes('downhill') || /\bdh\b/.test(text)) return 'downhill';
    if (text.includes('enduro')) return 'enduro';
    if (text.includes('cross') || /\bxc\b/.test(text)) return 'cross_country';
    if (text.includes('trail') && text.includes('emtb')) return 'emtb_trail';
    if (text.includes('trail')) return 'trail_riding';
    if (text.includes('emtb') || text.includes('e mtb')) return 'emtb';
    if (text.includes('gravel')) return 'gravel';
    if (text.includes('road')) return 'road';
    return text.replace(/\s+/g, '_');
  }

  normalizeSubCategory(value, discipline) {
    const raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
    if (raw) {
      if (raw.includes('downhill') || raw === 'dh') return 'downhill';
      if (raw.includes('enduro')) return 'enduro';
      if (raw.includes('trail')) return 'trail';
      if (raw.includes('cross') || raw === 'xc') return 'cross_country';
      if (raw.includes('all road') || raw.includes('all_road')) return 'all_road';
      if (raw.includes('aero')) return 'aero';
      if (raw.includes('endurance')) return 'endurance';
      if (raw.includes('climb')) return 'climbing';
      return raw.replace(/\s+/g, '_');
    }
    switch (discipline) {
      case 'downhill': return 'downhill';
      case 'enduro': return 'enduro';
      case 'trail_riding': return 'trail';
      case 'cross_country': return 'cross_country';
      case 'road': return 'road';
      case 'gravel': return 'all_road';
      case 'emtb':
      case 'emtb_trail': return 'trail';
      default: return null;
    }
  }

  /**
   * Safe Join Helper
   */
  safeJoin(arr, delimiter = '; ') {
    if (Array.isArray(arr)) return arr.join(delimiter);
    if (typeof arr === 'string') return arr;
    return '';
  }

  /**
   * Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ Ð²ÐµÐ»Ð¾ÑÐ¸Ð¿ÐµÐ´ Ð¸Ð· Unified Format
   */
  insertBike(unifiedData) {
    const u = unifiedData || {};
    u.basic_info = u.basic_info || {};
    u.pricing = u.pricing || {};
    u.condition = u.condition || {};
    u.seller = u.seller || {};
    u.logistics = u.logistics || {};
    u.media = u.media || {};
    u.ranking = u.ranking || {};
    u.specs = u.specs || {};
    u.features = u.features || {};
    u.inspection = u.inspection || {};
    u.meta = u.meta || {};

    u.basic_info.category = this.normalizeCategory(u.basic_info.category);
    const normalizedWheelSize = this.normalizeWheelSize(u.specs.wheel_size || u.specs.wheel_diameter);
    if (normalizedWheelSize) u.specs.wheel_size = normalizedWheelSize;
    u.specs.frame_size = this.normalizeFrameSize(u.specs.frame_size, u.basic_info.category);
    u.seller.type = this.normalizeSellerType(u.seller.type);
    u.logistics.shipping_cost = null;
    u.meta.source_ad_id = this.extractSourceAdId(u.meta.source_ad_id, u.meta.source_url);
    if (u.condition) {
      const normalizedConditionScore = this.normalizeConditionScore(u.condition.score);
      if (normalizedConditionScore !== null) {
        u.condition.score = normalizedConditionScore;
      }
      if (!u.condition.grade && normalizedConditionScore !== null) {
        u.condition.grade = this.deriveConditionGrade(normalizedConditionScore);
      }
      if (!u.condition.class && normalizedConditionScore !== null) {
        u.condition.class = this.deriveConditionClass(normalizedConditionScore);
      }
    }
    u.condition.issues = Array.isArray(u.condition.issues)
      ? u.condition.issues
      : (u.condition.issues ? [String(u.condition.issues)] : []);
    u.media.gallery = Array.isArray(u.media.gallery)
      ? u.media.gallery
      : (u.media.gallery ? [u.media.gallery] : []);
    if (!u.media.main_image && u.media.gallery.length > 0) {
      u.media.main_image = u.media.gallery[0];
    }

    // Safety checks for JSON/Arrays
    const safeJson = (val) => {
      try { return JSON.stringify(val || {}); }
      catch { return '{}'; }
    };

    console.log(`\nðŸ’¾ Saving bike to database...`);
    console.log(`   Name: ${u.basic_info.name}`);
    console.log(`   Brand: ${u.basic_info.brand}`);
    console.log(`   Price: â‚¬${u.pricing.price}`);

    try {
      // Ð¢ÐžÐ§ÐÐ«Ð™ Ð¡ÐŸÐ˜Ð¡ÐžÐš Ð¡Ð¢ÐžÐ›Ð‘Ð¦ÐžÐ’ Ð˜Ð— Ð¢Ð’ÐžÐ•Ð™ Ð‘Ð”
      const stmt = this.db.prepare(`
        INSERT INTO bikes (
          name, brand, model, year, category, sub_category, 
          breadcrumb, description, language,
          
          price, original_price, discount, currency, is_negotiable,
          buyer_protection_price, fmv, fmv_confidence, market_comparison,
          days_on_market,
          
          condition_status, condition_score, condition_grade, 
          visual_rating, functional_rating, receipt_available,
          crash_history, frame_damage, issues,
          
          seller_name, seller_type, seller_rating, seller_rating_visual,
          seller_last_active, seller_trust_score, seller_verified,
          platform_reviews_count, platform_reviews_source,
          
          location, country, shipping_cost, is_pickup_available,
          international,
          
          main_image, gallery, photo_quality,
          
          ranking_score, value_score, demand_score, urgency_score,
          is_hot_offer, is_super_deal, tier,
          
          frame_size, wheel_size, frame_material, color, weight,
          suspension_type, travel_front, travel_rear,
          groupset, shifting_type, drivetrain, brakes, brakes_type,
          groupset_speeds, cassette, tires_front, tires_rear,
          handlebars_width, stem_length, seatpost_travel,
          pedals_included, fork, shock,
          
          source_platform, source_ad_id, source_url, parser_version,
          is_active, created_at, updated_at, last_checked_at,
          
          unified_data, specs_json, features_json, inspection_json,
          seller_json, logistics_json, media_json, ranking_json,
          ai_analysis_json, market_data_json, component_upgrades_json,
          
          quality_score, completeness, views
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `);

      const result = stmt.run(
        // Basic Info (9)
        u.basic_info.name,
        u.basic_info.brand,
        u.basic_info.model,
        u.basic_info.year,
        u.basic_info.category,
        u.basic_info.sub_category,
        u.basic_info.breadcrumb,
        u.basic_info.description,
        u.basic_info.language,

        // Pricing (8)
        u.pricing.price,
        u.pricing.original_price,
        u.pricing.discount,
        u.pricing.currency,
        u.pricing.is_negotiable ? 1 : 0,
        u.pricing.buyer_protection?.price || null,
        u.pricing.fmv,
        u.pricing.fmv_confidence,
        u.pricing.market_comparison,
        u.pricing.days_on_market,

        // Condition (7)
        u.condition.status,
        u.condition.score,
        u.condition.grade,
        u.condition.visual_rating,
        u.condition.functional_rating,
        u.condition.receipt_available ? 1 : 0,
        u.condition.crash_history ? 1 : 0,
        u.condition.frame_damage ? 1 : 0,
        this.safeJoin(u.condition.issues), // SAFE JOIN

        // Seller (7)
        u.seller.name,
        u.seller.type,
        u.seller.rating,
        u.seller.rating_visual,
        u.seller.last_active,
        u.seller.trust_score,
        u.seller.verified ? 1 : 0,
        u.meta.platform_trust?.reviews_count || null,
        u.meta.platform_trust?.source || null,

        // Logistics (5)
        u.logistics.location,
        u.logistics.country,
        u.logistics.shipping_cost,
        u.logistics.pickup_available ? 1 : 0,
        u.logistics.international ? 1 : 0,

        // Media (3)
        u.media.main_image,
        this.safeJoin(u.media.gallery), // SAFE JOIN
        u.media.photo_quality,

        // Ranking (7)
        u.ranking.score,
        u.ranking.value_score,
        u.ranking.demand_score,
        u.ranking.urgency_score,
        u.ranking.is_hot_offer ? 1 : 0,
        u.ranking.is_super_deal ? 1 : 0,
        u.ranking.tier,

        // Specs (23 expanded)
        u.specs.frame_size,
        u.specs.wheel_size,
        u.specs.frame_material,
        u.specs.color,
        u.specs.weight,
        u.specs.suspension_type,
        u.specs.travel_front,
        u.specs.travel_rear,
        u.specs.groupset,
        u.specs.shifting_type,
        u.specs.drivetrain,
        u.specs.brakes,
        u.specs.brakes_type,
        u.specs.groupset_speeds,
        u.specs.cassette,
        u.specs.tires_front,
        u.specs.tires_rear,
        u.specs.handlebars_width,
        u.specs.stem_length,
        u.specs.seatpost_travel,
        u.specs.pedals_included ? 1 : 0,
        u.specs.fork || null,
        u.specs.shock || null,

        // Metadata (8)
        u.meta.source_platform,
        u.meta.source_ad_id,
        u.meta.source_url,
        u.meta.parser_version,
        u.meta.is_active ? 1 : 0,
        u.meta.created_at,
        u.meta.updated_at,
        u.meta.last_checked_at,

        // JSON Fields (11)
        JSON.stringify(u),
        JSON.stringify(u.specs),
        JSON.stringify(u.features),
        JSON.stringify(u.inspection),
        JSON.stringify(u.seller),
        JSON.stringify(u.logistics),
        JSON.stringify(u.media),
        JSON.stringify(u.ranking),
        JSON.stringify(u.ai_analysis),
        JSON.stringify(u.market_data),
        JSON.stringify(u.specs.component_upgrades || []),

        // Quality (4)
        u.quality_score,
        u.completeness,
        u.ranking.views || 0
      );

      const bikeId = result.lastInsertRowid;

      // Persist key filter fields that are present in UnifiedBike but not part of the main INSERT list yet.
      // This keeps the INSERT stable while making catalog filters (discipline/shipping) reliable.
      try {
        const discipline = this.normalizeDiscipline(u.basic_info?.discipline || null);
        const subCategory = this.normalizeSubCategory(u.basic_info?.sub_category || null, discipline);
        let shippingOption = u.logistics?.shipping_option || null;
        if (u.meta?.source_platform === 'buycycle') shippingOption = 'available';
        if (!shippingOption) shippingOption = 'unknown';
        const readyToShip = u.logistics?.ready_to_ship ? 1 : 0;
        const zipCode = u.logistics?.zip_code || null;
        const shippingDays = u.logistics?.shipping_days || null;
        const normalizedSellerType = this.normalizeSellerType(u.seller?.type);
        const sourceAdId = this.extractSourceAdId(u.meta?.source_ad_id, u.meta?.source_url);
        const priceEur = String(u.pricing?.currency || '').toUpperCase() === 'EUR'
          ? (u.pricing?.price ?? null)
          : (u.pricing?.price_eur ?? null);
        const wheelDiameter = normalizedWheelSize || null;
        const frameSize = this.normalizeFrameSize(u.specs?.frame_size, u.basic_info?.category);
        const sourceUrl = u.meta?.source_url || null;
        const normalizedConditionScore = this.normalizeConditionScore(u.condition?.score);
        const conditionClass =
          u.condition?.class ||
          (normalizedConditionScore !== null ? this.deriveConditionClass(normalizedConditionScore) : null);
        const conditionConfidence =
          u.condition?.confidence === undefined || u.condition?.confidence === null || u.condition?.confidence === ''
            ? null
            : Number(u.condition.confidence);
        const conditionRationale = u.condition?.rationale || null;
        const sellerMemberSince = u.seller?.member_since || u.seller?.memberSince || null;
        const toNullableNumber = (value) => {
          if (value === undefined || value === null || value === '') return null;
          const n = Number(value);
          return Number.isFinite(n) ? n : null;
        };
        const sellerReviewsCount = toNullableNumber(u.seller?.reviews_count);
        const sellerRatingVisual = u.seller?.rating_visual || null;
        const sellerBadgesJson = (() => {
          const badges = u.seller?.badges;
          if (!badges) return null;
          try {
            return typeof badges === 'string' ? badges : JSON.stringify(badges);
          } catch {
            return null;
          }
        })();
        const descriptionRu = u.basic_info?.description_ru || null;
        const originalPrice = u.pricing?.original_price ?? null;
        const normalizedSize = frameSize || null;
        const platformReviewsCount = toNullableNumber(u.meta?.platform_trust?.reviews_count);
        const platformReviewsSource = u.meta?.platform_trust?.source || null;

        this.db.prepare(`
          UPDATE bikes
          SET discipline = ?,
              sub_category = COALESCE(?, sub_category),
              shipping_option = ?,
              ready_to_ship = ?,
              zip_code = ?,
              shipping_days = ?,
              seller_type = ?,
              source_ad_id = COALESCE(?, source_ad_id),
              price_eur = COALESCE(?, price_eur),
              wheel_diameter = COALESCE(?, wheel_diameter),
              frame_size = COALESCE(?, frame_size),
              size = COALESCE(?, size),
              condition_class = COALESCE(?, condition_class),
              condition_confidence = COALESCE(?, condition_confidence),
              condition_rationale = COALESCE(?, condition_rationale),
              seller_member_since = COALESCE(?, seller_member_since),
              seller_reviews_count = COALESCE(?, seller_reviews_count),
              seller_rating_visual = COALESCE(?, seller_rating_visual),
              seller_badges_json = COALESCE(?, seller_badges_json),
              platform_reviews_count = COALESCE(?, platform_reviews_count),
              platform_reviews_source = COALESCE(?, platform_reviews_source),
              description_ru = COALESCE(?, description_ru),
              original_price = COALESCE(?, original_price),
              original_url = COALESCE(?, original_url)
          WHERE id = ?
        `).run(
          discipline,
          subCategory,
          shippingOption,
          readyToShip,
          zipCode,
          shippingDays,
          normalizedSellerType,
          sourceAdId,
          priceEur,
          wheelDiameter,
          frameSize,
          normalizedSize,
          conditionClass,
          Number.isFinite(conditionConfidence) ? conditionConfidence : null,
          conditionRationale,
          sellerMemberSince,
          sellerReviewsCount,
          sellerRatingVisual,
          sellerBadgesJson,
          platformReviewsCount,
          platformReviewsSource,
          descriptionRu,
          originalPrice,
          sourceUrl,
          bikeId
        );
      } catch (e) {
        console.warn(`[DatabaseServiceV2] Failed to set discipline/shipping fields: ${e.message}`);
      }

      if (u.pricing.fmv && u.pricing.price) {
        const margin = Math.round(((u.pricing.fmv - u.pricing.price) / u.pricing.fmv) * 1000) / 10;
        try {
          this.db.prepare(`UPDATE bikes SET profit_margin = ? WHERE id = ?`).run(margin, bikeId);
        } catch (e) {
          console.warn(`[DatabaseServiceV2] Failed to set profit_margin: ${e.message}`);
        }
      }

      console.log(`   âœ… Bike saved successfully!`);
      console.log(`   ðŸ“Š Database ID: ${bikeId}`);
      console.log(`   ðŸ† Quality Score: ${u.quality_score}`);
      console.log(`   ðŸ“ˆ Completeness: ${Number(u.completeness || 0).toFixed(1)}%`);

      return bikeId;

    } catch (error) {
      console.error(`   âŒ Database insert failed: ${error.message}`);
      console.error(`   Full error:`, error);
      throw error;
    }
  }

  /**
   * Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ Ð¼Ð°ÑÑÐ¸Ð² Ð²ÐµÐ»Ð¾ÑÐ¸Ð¿ÐµÐ´Ð¾Ð²
   * @param {Array} bikes - ÐœÐ°ÑÑÐ¸Ð² unified bike objects
   * @param {Object} options - ÐžÐ¿Ñ†Ð¸Ð¸ 
   */
  async saveBikesToDB(bikes, options = {}) {
    const bikeList = Array.isArray(bikes) ? bikes : (bikes ? [bikes] : []);
    const storeImages = options.storeImages !== false;

    const summary = {
      total: bikeList.length,
      inserted: 0,
      duplicates: 0,
      failed: 0,
      photosDownloaded: 0,
      photosTotal: 0,
      results: []
    };

    console.log(`\nðŸ“¦ Batch saving ${bikeList.length} bikes...`);

    for (const bike of bikeList) {
      try {
        // Check existence logic
        const sourceAdId = bike.meta?.source_ad_id;
        const sourcePlatform = bike.meta?.source_platform;

        if (this.bikeExists(sourceAdId, sourcePlatform)) {
          console.log(`   âš ï¸ Skipped duplicate: ${sourceAdId}`);
          summary.duplicates++;
          summary.results.push({ success: false, reason: 'duplicate', id: sourceAdId });
          continue;
        }

        const id = this.insertBike(bike);
        summary.inserted++;
        summary.results.push({ success: true, id });

        if (storeImages) {
          const imageStats = this.insertBikeImages(id, bike);
          summary.photosTotal += imageStats.total;
          summary.photosDownloaded += imageStats.downloaded;
        }

      } catch (err) {
        console.error(`   âŒ Failed to save bike: ${err.message}`);
        summary.failed++;
        summary.results.push({ success: false, reason: err.message });
      }
    }

    return summary;
  }

  insertBikeImages(bikeId, bike) {
    const gallery = Array.isArray(bike?.media?.gallery) ? bike.media.gallery : [];
    const main = bike?.media?.main_image || gallery[0] || null;
    const urls = Array.from(new Set([...(main ? [main] : []), ...gallery].filter(Boolean)));
    if (urls.length === 0) return { total: 0, downloaded: 0 };

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO bike_images (
        bike_id, image_url, local_path, position, is_main, image_order, is_downloaded, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    urls.forEach((url, index) => {
      const isMain = main ? (url === main ? 1 : 0) : (index === 0 ? 1 : 0);
      stmt.run(bikeId, url, url, index, isMain, index, 0);
    });

    if (main) {
      try {
        this.db.prepare(`
          UPDATE bikes 
          SET main_image = ? 
          WHERE id = ? AND (main_image IS NULL OR main_image = '')
        `).run(main, bikeId);
      } catch (e) {
        console.warn(`[DatabaseServiceV2] Failed to set main_image: ${e.message}`);
      }
    }

    return { total: urls.length, downloaded: 0 };
  }

  /**
   * ÐŸÑ€Ð¾Ð²ÐµÑ€Ð¸Ñ‚ÑŒ ÑÑƒÑ‰ÐµÑÑ‚Ð²ÑƒÐµÑ‚ Ð»Ð¸ Ð²ÐµÐ»Ð¾ÑÐ¸Ð¿ÐµÐ´
   */
  bikeExists(sourceAdId, sourcePlatform) {
    const stmt = this.db.prepare(`
      SELECT id FROM bikes 
      WHERE source_ad_id = ? AND source_platform = ?
      LIMIT 1
    `);

    const result = stmt.get(sourceAdId, sourcePlatform);
    return !!result;
  }

  /**
   * ÐŸÐ¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒ Ð²ÐµÐ»Ð¾ÑÐ¸Ð¿ÐµÐ´ Ð¿Ð¾ ID
   */
  getBikeById(id) {
    const stmt = this.db.prepare('SELECT * FROM bikes WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ Ñ‚ÐµÑÑ‚Ð¾Ð²Ñ‹Ð¹ Ð²ÐµÐ»Ð¾ÑÐ¸Ð¿ÐµÐ´ (Ð´Ð»Ñ Ð¾Ñ‡Ð¸ÑÑ‚ÐºÐ¸)
   */
  deleteTestBike(sourceAdId, sourcePlatform) {
    if (!sourceAdId) return false;

    const ids = this.db.prepare(`
      SELECT id FROM bikes
      WHERE source_ad_id = ? AND source_platform = ?
    `).all(sourceAdId, sourcePlatform || null).map((row) => row.id);

    if (ids.length === 0 && sourceAdId) {
      // Fallback: try by source_ad_id only (legacy rows without source_platform)
      const fallback = this.db.prepare(`
        SELECT id FROM bikes WHERE source_ad_id = ?
      `).all(sourceAdId).map((row) => row.id);
      ids.push(...fallback);
    }

    if (ids.length === 0) return false;

    const dependentTables = [
      'bike_images',
      'bike_specs',
      'bike_condition_assessments',
      'bike_evaluations',
      'rank_diagnostics',
      'price_history',
      'bike_behavior_metrics',
      'bike_behavior_metrics_daily',
      'metric_events',
      'bike_analytics',
      'user_favorites',
      'shopping_cart',
      'shop_order_items',
      'order_items',
      'orders',
      'recent_deliveries'
    ];

    const deleteTx = this.db.transaction((bikeId) => {
      for (const table of dependentTables) {
        try {
          this.db.prepare(`DELETE FROM ${table} WHERE bike_id = ?`).run(bikeId);
        } catch (e) {
          // Ignore if table/column doesn't exist in this DB variant
        }
      }
      this.db.prepare('DELETE FROM bikes WHERE id = ?').run(bikeId);
    });

    let deleted = false;
    for (const id of ids) {
      deleteTx(id);
      deleted = true;
    }

    return deleted;
  }

  /**
   * Execute a query and return results (for SmartModelSelector compatibility)
   * @param {string} sql - SQL query with ? placeholders
   * @param {Array} params - Parameters for the query
   * @returns {Array} Query results
   */
  query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      // Determine if it's a SELECT or modifying query
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params);
      } else {
        const result = stmt.run(...params);
        return { insertId: result.lastInsertRowid, changes: result.changes };
      }
    } catch (err) {
      console.error('[DatabaseServiceV2] Query failed:', err.message);
      console.error('[DatabaseServiceV2] SQL:', sql);
      throw err;
    }
  }

  /**
   * Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ ÑÐ¾ÐµÐ´Ð¸Ð½ÐµÐ½Ð¸Ðµ
   */
  close() {
    this.db.close();
    console.log('   Database connection closed');
  }
}

module.exports = DatabaseServiceV2;
