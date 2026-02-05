const DatabaseManager = require('../database/db-manager');
const dbManager = new DatabaseManager();

class FeatureExtractor {
  
  get db() {
      return dbManager.getDatabase();
  }

  extractFeatures(bike) {
    // Собираем все факторы которые влияют на hotness
    
    return {
      // 1. BRAND POWER (tier proxy)
      brand_tier: this.getBrandTier(bike.brand),
      brand_popularity: this.getBrandPopularity(bike.brand),
      
      // 2. PRICE POSITIONING
      price: bike.price,
      fmv: bike.fmv || bike.price, // Fallback if fmv is missing
      discount_pct: bike.fmv ? ((bike.fmv - bike.price) / bike.fmv) * 100 : 0,
      price_vs_category_median: this.getPriceRatio(bike),
      
      // 3. BIKE CHARACTERISTICS
      year: bike.year,
      age_years: new Date().getFullYear() - (bike.year || 2020),
      is_recent: bike.year >= 2022 ? 1 : 0,
      
      // 4. SIZE DEMAND
      frame_size: bike.size,
      is_popular_size: ['M', 'L', '54', '56'].includes(bike.size) ? 1 : 0, // Expanded popular sizes
      
      // 5. MARKET TIMING
      month: new Date().getMonth() + 1,
      is_high_season: this.isHighSeason(), // Апрель-Июль = пик
      days_since_listing: this.getDaysSinceListing(bike),
      
      // 6. HISTORICAL MODEL PERFORMANCE
      model_avg_days_to_sell: this.getModelHistoricalSpeed(bike.brand, bike.model),
      model_total_sales: this.getModelTotalSales(bike.brand, bike.model),
      model_avg_views: this.getModelAvgViews(bike.brand, bike.model),
      
      // 7. COMPETITION
      similar_bikes_in_catalog: this.countSimilarBikes(bike),
      price_rank_among_similar: this.getPriceRank(bike), // 1 = cheapest
      
      // 8. QUALITY SIGNALS
      has_professional_photos: (bike.images && bike.images.length >= 5) ? 1 : 0,
      condition_score: this.mapConditionToScore(bike.condition_status),
      data_completeness: (bike.quality_score || 100) / 100
    };
  }
  
  getBrandTier(brand) {
    try {
        const brandsConfig = require('../config/brands-config.json');
        if (brandsConfig.tier1.find(b => b.name === brand)) return 1;
        if (brandsConfig.tier2.find(b => b.name === brand)) return 2;
        if (brandsConfig.tier3.find(b => b.name === brand)) return 3;
    } catch (e) {
        // Fallback or config missing
    }
    return 4; // Unknown
  }
  
  getBrandPopularity(brand) {
    // На основе исторических данных
    const stats = this.db.prepare(`
      SELECT COUNT(*) as sales
      FROM bike_analytics
      WHERE brand = ? AND status = 'sold'
    `).get(brand);
    
    return stats?.sales || 0;
  }
  
  getPriceRatio(bike) {
    // Насколько дороже/дешевле чем median в категории
    // Using AVG as proxy for median for simplicity in SQLite
    const median = this.db.prepare(`
      SELECT AVG(price) as med
      FROM bikes
      WHERE tier = ? AND is_active = 1
    `).get(bike.tier || 4);
    
    return median?.med ? bike.price / median.med : 1.0;
  }
  
  isHighSeason() {
    const month = new Date().getMonth() + 1;
    return month >= 4 && month <= 8 ? 1 : 0; // Апрель-Август
  }
  
  getDaysSinceListing(bike) {
    return (Date.now() - new Date(bike.created_at || Date.now())) / 86400000;
  }
  
  getModelHistoricalSpeed(brand, model) {
    // Средняя скорость продажи этой модели в прошлом
    const stats = this.db.prepare(`
      SELECT AVG(days_to_sell) as avg_speed
      FROM bike_analytics
      WHERE brand = ? AND model LIKE ?
      AND status = 'sold'
      AND days_to_sell IS NOT NULL
    `).get(brand, `%${model}%`);
    
    return stats?.avg_speed || 15; // Default: 15 дней
  }
  
  getModelTotalSales(brand, model) {
    const stats = this.db.prepare(`
      SELECT COUNT(*) as cnt
      FROM bike_analytics
      WHERE brand = ? AND model LIKE ?
      AND status = 'sold'
    `).get(brand, `%${model}%`);
    
    return stats?.cnt || 0;
  }
  
  getModelAvgViews(brand, model) {
    const stats = this.db.prepare(`
      SELECT AVG(views) as avg_views
      FROM bike_analytics
      WHERE brand = ? AND model LIKE ?
      AND status = 'sold'
    `).get(brand, `%${model}%`);
    
    return stats?.avg_views || 10;
  }
  
  countSimilarBikes(bike) {
    const count = this.db.prepare(`
      SELECT COUNT(*) as cnt
      FROM bikes
      WHERE brand = ? AND model LIKE ?
      AND is_active = 1
      AND id != ?
    `).get(bike.brand, `%${bike.model}%`, bike.id || -1);
    
    return count?.cnt || 0;
  }
  
  getPriceRank(bike) {
    // 1 = самый дешевый среди похожих
    const rank = this.db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM bikes
      WHERE brand = ? AND model LIKE ?
      AND is_active = 1
      AND price < ?
    `).get(bike.brand, `%${bike.model}%`, bike.price);
    
    return rank?.rank || 1;
  }
  
  mapConditionToScore(condition) {
    const map = {
      'new': 100,
      'like_new': 95,
      'excellent': 90,
      'very_good': 85,
      'good': 70,
      'fair': 50,
      'poor': 30,
      'used': 70 // default for general used
    };
    return map[condition] || 70;
  }
}

module.exports = new FeatureExtractor();
