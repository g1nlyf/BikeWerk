class UnifiedBikeMapper {
  
  /**
   * Конвертировать из unified JSON в DB row
   */
  toDatabase(unifiedBike) {
    return {
      // Meta
      // id: unifiedBike.meta.id, // Usually auto-increment on insert
      source_platform_type: unifiedBike.meta.source_platform, // Mapped to DB column
      source_platform: unifiedBike.meta.source_platform,
      source_url: unifiedBike.meta.source_url,
      source_ad_id: unifiedBike.meta.source_ad_id,
      created_at: unifiedBike.meta.created_at || new Date().toISOString(),
      updated_at: unifiedBike.meta.updated_at || new Date().toISOString(),
      last_checked: unifiedBike.meta.last_checked,
      is_active: unifiedBike.meta.is_active ? 1 : 0,
      deactivation_reason: unifiedBike.meta.deactivation_reason,
      deactivated_at: unifiedBike.meta.deactivated_at,
      
      // Basic
      name: unifiedBike.basic_info.name,
      brand: unifiedBike.basic_info.brand,
      model: unifiedBike.basic_info.model,
      year: unifiedBike.basic_info.year,
      category: unifiedBike.basic_info.category,
      sub_category: unifiedBike.basic_info.sub_category,
      discipline: unifiedBike.basic_info.discipline,
      description: unifiedBike.basic_info.description,
      
      // Pricing
      price: unifiedBike.pricing.price,
      original_price: unifiedBike.pricing.original_price,
      discount: unifiedBike.pricing.discount,
      is_negotiable: unifiedBike.pricing.is_negotiable ? 1 : 0,
      currency: unifiedBike.pricing.currency,
      fmv: unifiedBike.pricing.fmv,
      profit_margin: unifiedBike.pricing.profit_margin,
      quality_score: unifiedBike.quality_score,
      
      // Specs
      size: unifiedBike.specs.frame_size, // Mapped to 'size'
      wheel_size: unifiedBike.specs.wheel_size,
      frame_material: unifiedBike.specs.frame_material,
      color: unifiedBike.specs.color,
      weight: unifiedBike.specs.weight,
      suspension_type: unifiedBike.specs.suspension_type,
      groupset: unifiedBike.specs.groupset,
      brakes: unifiedBike.specs.brakes,
      fork: unifiedBike.specs.fork,
      shock: unifiedBike.specs.shock,
      
      // Condition
      condition_status: unifiedBike.condition.status,
      condition_score: unifiedBike.condition.score,
      condition_grade: unifiedBike.condition.grade,
      condition_class: unifiedBike.condition.class, // NEW
      condition_confidence: unifiedBike.condition.confidence, // NEW
      condition_rationale: unifiedBike.condition.rationale || unifiedBike.condition.reason, // NEW
      technical_score: unifiedBike.condition.technical_score, // NEW
      functional_rating: unifiedBike.condition.functional_rating, // NEW
      condition_penalty: unifiedBike.condition.penalty,
      condition_reason: unifiedBike.condition.reason || unifiedBike.condition.rationale,
      visual_rating: unifiedBike.condition.visual_rating,
      issues: JSON.stringify(unifiedBike.condition.issues || []),
      mechanic_notes: unifiedBike.condition.mechanic_notes,
      
      // Inspection (save as JSON)
      inspection_data: JSON.stringify(unifiedBike.inspection || {}),
      
      // Seller
      seller_name: unifiedBike.seller.name,
      location: unifiedBike.seller.location,
      seller_type: unifiedBike.seller.type,
      seller_rating: unifiedBike.seller.rating,
      seller_badges_json: JSON.stringify(unifiedBike.seller.badges || []), // Mapped to seller_badges_json
      
      // Logistics
      delivery_option: unifiedBike.logistics.delivery_option,
      shipping_cost: unifiedBike.logistics.shipping_cost,
      is_pickup_available: unifiedBike.logistics.is_pickup_available ? 1 : 0,
      
      // Media
      main_image: unifiedBike.media.main_image,
      gallery: JSON.stringify(unifiedBike.media.gallery || []),
      
      // Ranking
      rank: unifiedBike.ranking.rank,
      ranking_score: unifiedBike.ranking.ranking_score,
      hotness_score: unifiedBike.ranking.hotness_score,
      priority: unifiedBike.ranking.priority,
      is_hot_offer: unifiedBike.ranking.is_hot_offer ? 1 : 0,
      views: unifiedBike.ranking.views,
      
      // Audit
      needs_audit: unifiedBike.audit.needs_audit ? 1 : 0,
      audit_status: unifiedBike.audit.audit_status,
      audit_notes: unifiedBike.audit.audit_notes,
      
      // Features
      features_raw: JSON.stringify(unifiedBike.features.raw_specs || {}),
      badges: JSON.stringify(unifiedBike.features.badges || []),
      upgrades: JSON.stringify(unifiedBike.features.upgrades || []),
      unified_data: JSON.stringify(unifiedBike || {}),
      specs_json: JSON.stringify(unifiedBike.specs || {}),
      inspection_json: JSON.stringify(unifiedBike.inspection || {}),
      seller_json: JSON.stringify(unifiedBike.seller || {}),
      logistics_json: JSON.stringify(unifiedBike.logistics || {}),
      features_json: JSON.stringify(unifiedBike.features || {})
    };
  }
  
  /**
   * Конвертировать из DB row в unified JSON
   */
  fromDatabase(dbRow) {
    const specsJson = this.safeJsonParse(dbRow.specs_json, null);
    const inspectionJson = this.safeJsonParse(dbRow.inspection_json, null);
    const sellerJson = this.safeJsonParse(dbRow.seller_json, null);
    const logisticsJson = this.safeJsonParse(dbRow.logistics_json, null);
    const featuresJson = this.safeJsonParse(dbRow.features_json, null);
    const unifiedJson = this.safeJsonParse(dbRow.unified_data, null);

    const base = {
      meta: {
        id: dbRow.id,
        source_platform: dbRow.source_platform || dbRow.source_platform_type,
        source_url: dbRow.source_url,
        source_ad_id: dbRow.source_ad_id,
        created_at: dbRow.created_at,
        updated_at: dbRow.updated_at,
        last_checked: dbRow.last_checked,
        is_active: dbRow.is_active === 1,
        deactivation_reason: dbRow.deactivation_reason,
        deactivated_at: dbRow.deactivated_at
      },
      basic_info: {
        name: dbRow.name,
        brand: dbRow.brand,
        model: dbRow.model,
        year: dbRow.year,
        category: dbRow.category,
        description: dbRow.description
      },
      pricing: {
        price: dbRow.price,
        original_price: dbRow.original_price,
        discount: dbRow.discount,
        is_negotiable: dbRow.is_negotiable === 1,
        currency: dbRow.currency || 'EUR',
        fmv: dbRow.fmv,
        profit_margin: dbRow.profit_margin
      },
      specs: {
        frame_size: dbRow.size,
        wheel_size: dbRow.wheel_size,
        frame_material: dbRow.frame_material,
        color: dbRow.color,
        weight: dbRow.weight,
        suspension_type: dbRow.suspension_type,
        groupset: dbRow.groupset,
        brakes: dbRow.brakes,
        fork: dbRow.fork,
        shock: dbRow.shock,
        ...(specsJson || {})
      },
      condition: {
        status: dbRow.condition_status,
        score: dbRow.condition_score,
        grade: dbRow.condition_grade,
        penalty: dbRow.condition_penalty,
        reason: dbRow.condition_reason || dbRow.condition_rationale,
        visual_rating: dbRow.visual_rating,
        functional_rating: dbRow.functional_rating,
        issues: this.safeJsonParse(dbRow.issues, []),
        mechanic_notes: dbRow.mechanic_notes
      },
      inspection: inspectionJson || this.safeJsonParse(dbRow.inspection_data, {}),
      seller: {
        name: dbRow.seller_name,
        location: dbRow.location,
        country: null, // Extract from location if needed
        type: dbRow.seller_type || 'private',
        rating: dbRow.seller_rating,
        badges: this.safeJsonParse(dbRow.seller_badges_json, [])
      },
      logistics: {
        delivery_option: dbRow.delivery_option,
        shipping_cost: dbRow.shipping_cost,
        is_pickup_available: dbRow.is_pickup_available === 1
      },
      media: {
        main_image: dbRow.main_image,
        gallery: this.safeJsonParse(dbRow.gallery, [])
      },
      ranking: {
        rank: dbRow.rank,
        ranking_score: dbRow.ranking_score,
        hotness_score: dbRow.hotness_score,
        priority: dbRow.priority,
        is_hot_offer: dbRow.is_hot_offer === 1,
        views: dbRow.views
      },
      audit: {
        needs_audit: dbRow.needs_audit === 1,
        audit_status: dbRow.audit_status,
        audit_notes: dbRow.audit_notes
      },
      features: {
        raw_specs: this.safeJsonParse(dbRow.features_raw, {}),
        badges: this.safeJsonParse(dbRow.badges, []),
        upgrades: this.safeJsonParse(dbRow.upgrades, [])
      },
      quality_score: dbRow.quality_score
    };

    // Merge strategy: Start with unifiedJson (rich data), then overlay DB columns ONLY if they are populated
    // This allows DB edits to override parsed data, but prevents DB nulls from wiping parsed data.
    const merged = unifiedJson ? { ...unifiedJson } : {};
    
    // Helper to merge objects deeply or shallowly
    const mergeSection = (target, source) => {
        for (const key in source) {
            if (source[key] !== null && source[key] !== undefined && source[key] !== '') {
                target[key] = source[key];
            }
        }
    };

    mergeSection(merged.meta = merged.meta || {}, base.meta);
    mergeSection(merged.basic_info = merged.basic_info || {}, base.basic_info);
    mergeSection(merged.pricing = merged.pricing || {}, base.pricing);
    mergeSection(merged.specs = merged.specs || {}, base.specs);
    mergeSection(merged.condition = merged.condition || {}, base.condition);
    mergeSection(merged.inspection = merged.inspection || {}, base.inspection);
    mergeSection(merged.seller = merged.seller || {}, base.seller);
    mergeSection(merged.logistics = merged.logistics || {}, base.logistics);
    mergeSection(merged.media = merged.media || {}, base.media);
    mergeSection(merged.ranking = merged.ranking || {}, base.ranking);
    mergeSection(merged.audit = merged.audit || {}, base.audit);
    mergeSection(merged.features = merged.features || {}, base.features);
    
    if (base.quality_score != null) merged.quality_score = base.quality_score;

    if (sellerJson) mergeSection(merged.seller, sellerJson);
    if (logisticsJson) mergeSection(merged.logistics, logisticsJson);
    if (featuresJson) mergeSection(merged.features, featuresJson);

    return merged;
  }

  safeJsonParse(str, fallback) {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
  }
}

module.exports = new UnifiedBikeMapper();
