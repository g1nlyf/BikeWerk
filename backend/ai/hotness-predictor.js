const FeatureExtractor = require('./feature-extractor.js');
const DatabaseManager = require('../database/db-manager');
const dbManager = new DatabaseManager();

class HotnessPredictor {
  
  constructor() {
    // Веса подобраны эмпирически (можно fine-tune позже)
    this.weights = {
      // Сильнейшие факторы (20-30 points each)
      discount_pct: 2.0,              // Большая скидка = быстрая продажа
      brand_tier: -10,                 // Tier 1 = +30, Tier 3 = +10 (logic inverted in code below)
      model_avg_days_to_sell: -1.5,   // Исторически быстрая модель
      
      // Средние факторы (10-15 points)
      is_popular_size: 15,
      is_high_season: 12,
      is_recent: 10,
      price_rank_among_similar: -5,   // Cheaper = better
      
      // Слабые факторы (5-10 points)
      has_professional_photos: 8,
      model_total_sales: 0.5,         // Proven model
      condition_score: 0.1,
      
      // Негативные факторы
      similar_bikes_in_catalog: -3,   // Конкуренция
      age_years: -2,                  // Старый байк
      days_since_listing: -1          // Долго висит
    };
    
    this.baseline = 50; // Neutral hotness
  }
  
  get db() {
      return dbManager.getDatabase();
  }

  predict(bike) {
    const features = FeatureExtractor.extractFeatures(bike);
    
    let score = this.baseline;
    
    // Weighted sum
    for (const [feature, value] of Object.entries(features)) {
      const weight = this.weights[feature];
      if (weight !== undefined) {
        score += value * weight;
      }
    }
    
    // Brand tier adjustment (exponential)
    // Tier 1 (1) -> score += 30
    // Tier 2 (2) -> score += 15
    // Tier 3 (3) -> score += 5
    // Note: brand_tier weight is -10 in weights, so tier 1 contributes -10, tier 4 contributes -40.
    // The manual adjustment below seems to be intended to override or boost this.
    // Let's keep the manual adjustment as requested.
    
    if (features.brand_tier === 1) score += 30;
    else if (features.brand_tier === 2) score += 15;
    else if (features.brand_tier === 3) score += 5;
    
    // Discount bonus (non-linear)
    if (features.discount_pct > 30) score += 25; // Huge discount
    else if (features.discount_pct > 20) score += 15;
    
    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));
    
    // Predict days to sell (inverse relationship)
    const predicted_days = this.scoreToDays(score);
    
    return {
      hotness_score: Math.round(score),
      predicted_days_to_sell: predicted_days,
      confidence: this.calculateConfidence(features),
      top_factors: this.getTopFactors(features)
    };
  }
  
  scoreToDays(score) {
    // Hotness 100 = 1 день, Hotness 0 = 60 дней
    // Exponential curve
    return Math.round(60 * Math.pow((100 - score) / 100, 2) + 1);
  }
  
  calculateConfidence(features) {
    // Confidence = насколько много данных у нас о модели
    if (features.model_total_sales >= 10) return 'HIGH';
    if (features.model_total_sales >= 3) return 'MEDIUM';
    return 'LOW';
  }
  
  getTopFactors(features) {
    // Какие факторы больше всего влияют на этот конкретный score
    const contributions = [];
    
    for (const [feature, value] of Object.entries(features)) {
      const weight = this.weights[feature];
      if (weight !== undefined) {
        contributions.push({
          feature,
          contribution: Math.abs(value * weight),
          positive: (value * weight) > 0
        });
      }
    }
    
    return contributions
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3); // Top 3
  }
  
  // BATCH PREDICTION для всего каталога
  async predictCatalog(options = {}) {
    console.log(`🤖 Running AI Hotness Prediction${options.legacyOnly ? ' (Legacy Mode)' : ''}...\n`);
    
    let query = `SELECT * FROM bikes WHERE is_active = 1`;
    if (options.legacyOnly) {
        query += ` AND (hotness_score IS NULL OR hotness_score = 0)`;
    }
    
    const bikes = this.db.prepare(query).all();
    console.log(`Processing ${bikes.length} bikes...`);
    
    let updated = 0;
    
    const updateBike = this.db.prepare(`
        UPDATE bikes
        SET hotness_score = ?, updated_at = datetime('now')
        WHERE id = ?
    `);
    
    const updateAnalytics = this.db.prepare(`
        UPDATE bike_analytics
        SET
          predicted_hotness = ?,
          predicted_days_to_sell = ?
        WHERE bike_id = ?
    `);

    // We should ensure bike_analytics record exists
    const checkAnalytics = this.db.prepare('SELECT id FROM bike_analytics WHERE bike_id = ?');
    const insertAnalytics = this.db.prepare(`
        INSERT INTO bike_analytics (bike_id, brand, model, year, tier, price, predicted_hotness, predicted_days_to_sell, listed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    const tx = this.db.transaction((bikesList) => {
        for (const bike of bikesList) {
            const prediction = this.predict(bike);
            
            // Update bike
            updateBike.run(prediction.hotness_score, bike.id);
            
            // Check if analytics exists
            const analytics = checkAnalytics.get(bike.id);
            if (analytics) {
                // Update analytics
                updateAnalytics.run(prediction.hotness_score, prediction.predicted_days_to_sell, bike.id);
            } else {
                // Insert if missing (e.g. old data before migration)
                insertAnalytics.run(
                    bike.id, 
                    bike.brand, 
                    bike.model, 
                    bike.year, 
                    bike.tier, 
                    bike.price, 
                    prediction.hotness_score, 
                    prediction.predicted_days_to_sell
                );
            }
            updated++;
        }
    });

    try {
        tx(bikes);
        console.log(`✅ Updated ${updated} bikes with AI predictions\n`);
    } catch (e) {
        console.error('Batch prediction failed:', e);
    }
    
    // Summary stats
    const stats = await this.getPredictionStats();
    console.log('📊 Hotness Distribution:');
    console.log(`├─ HOT (80-100): ${stats.hot} bikes`);
    console.log(`├─ WARM (60-79): ${stats.warm} bikes`);
    console.log(`├─ COOL (40-59): ${stats.cool} bikes`);
    console.log(`└─ COLD (0-39): ${stats.cold} bikes`);
    
    return stats;
  }
  
  async getPredictionStats() {
    const stats = this.db.prepare(`
      SELECT
        COUNT(CASE WHEN hotness_score >= 80 THEN 1 END) as hot,
        COUNT(CASE WHEN hotness_score >= 60 AND hotness_score < 80 THEN 1 END) as warm,
        COUNT(CASE WHEN hotness_score >= 40 AND hotness_score < 60 THEN 1 END) as cool,
        COUNT(CASE WHEN hotness_score < 40 THEN 1 END) as cold,
        AVG(hotness_score) as avg_hotness
      FROM bikes WHERE is_active = 1
    `).get();
    
    return stats;
  }
}

module.exports = new HotnessPredictor();

// CLI Execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const legacyOnly = args.includes('--legacy-only');
    
    (async () => {
        try {
            await new HotnessPredictor().predictCatalog({ legacyOnly });
        } catch (e) {
            console.error(e);
        }
    })();
}
