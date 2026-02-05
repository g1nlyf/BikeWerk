const Database = require('better-sqlite3');
const { DB_PATH } = require('../config/db-path');

/**
 * DATABASE SERVICE V2 - ИСПРАВЛЕННЫЙ
 * Точный маппинг на 191 столбец БД
 */
class DatabaseServiceV2 {

  constructor(dbPath) {
    this.dbPath = dbPath || DB_PATH;
    this.db = new Database(this.dbPath);

    console.log(`✅ Database Service v2.0 initialized`);
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

  /**
   * Safe Join Helper
   */
  safeJoin(arr, delimiter = '; ') {
    if (Array.isArray(arr)) return arr.join(delimiter);
    if (typeof arr === 'string') return arr;
    return '';
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
   * Сохранить велосипед из Unified Format
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

    console.log(`\n💾 Saving bike to database...`);
    console.log(`   Name: ${u.basic_info.name}`);
    console.log(`   Brand: ${u.basic_info.brand}`);
    console.log(`   Price: €${u.pricing.price}`);

    try {
      // ТОЧНЫЙ СПИСОК СТОЛБЦОВ ИЗ ТВОЕЙ БД
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

      console.log(`   ✅ Bike saved successfully!`);
      console.log(`   📊 Database ID: ${bikeId}`);
      console.log(`   🏆 Quality Score: ${u.quality_score}`);
      console.log(`   📈 Completeness: ${u.completeness.toFixed(1)}%`);

      return bikeId;

    } catch (error) {
      console.error(`   ❌ Database insert failed: ${error.message}`);
      console.error(`   Full error:`, error);
      throw error;
    }
  }

  /**
   * Сохранить массив велосипедов
   * @param {Array} bikes - Массив unified bike objects
   * @param {Object} options - Опции 
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

    console.log(`\n📦 Batch saving ${bikeList.length} bikes...`);

    for (const bike of bikeList) {
      try {
        // Check existence logic
        const sourceAdId = bike.meta?.source_ad_id;
        const sourcePlatform = bike.meta?.source_platform;

        if (this.bikeExists(sourceAdId, sourcePlatform)) {
          console.log(`   ⚠️ Skipped duplicate: ${sourceAdId}`);
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
        console.error(`   ❌ Failed to save bike: ${err.message}`);
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
   * Проверить существует ли велосипед
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
   * Получить велосипед по ID
   */
  getBikeById(id) {
    const stmt = this.db.prepare('SELECT * FROM bikes WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Удалить тестовый велосипед (для очистки)
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
   * Закрыть соединение
   */
  close() {
    this.db.close();
    console.log('   Database connection closed');
  }
}

module.exports = DatabaseServiceV2;
