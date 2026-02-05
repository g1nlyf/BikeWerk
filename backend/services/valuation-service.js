const DatabaseManager = require('../database/db-manager');

class ValuationService {
  constructor() {
    this.dbManager = new DatabaseManager();
  }

  async calculateFMV(brand, model, year, trim_level) {
    // Support legacy object call
    if (typeof brand === 'object') {
        const bike = brand;
        return this.calculateFMV(bike.brand, bike.model, bike.year, bike.trim_level);
    }

    try {
      console.log(`[VALUATION] Calculating FMV for ${brand} ${model} (${year || '?'})...`);
      
      if (!brand) return null;
      
      const db = this.dbManager.getDatabase();
      
      // Get all prices for IQR filtering
      // Using year range ±1 if year is provided, otherwise broader or just model
      let query = `
        SELECT price_eur 
        FROM market_history 
        WHERE brand = ? 
          AND (model LIKE ? OR title LIKE ?)
          AND price_eur > 0
          AND quality_score >= 70
      `;
      const params = [brand, `%${model}%`, `%${model}%`];

      if (year) {
          query += ` AND year BETWEEN ? AND ?`;
          params.push(year - 1, year + 1);
      }

      if (trim_level) {
          query += ` AND trim_level = ?`;
          params.push(trim_level);
      }

      query += ` ORDER BY price_eur`;

      const rows = db.prepare(query).all(...params);
      
      if (rows.length < 5) return null; // Not enough data for IQR
      
      // IQR filtering
      const prices = rows.map(r => r.price_eur);
      const q1_idx = Math.floor(prices.length * 0.25);
      const q3_idx = Math.floor(prices.length * 0.75);
      const iqr_prices = prices.slice(q1_idx, q3_idx + 1);
      
      if (iqr_prices.length === 0) return null;

      const sum = iqr_prices.reduce((a, b) => a + b, 0);
      const fmv = sum / iqr_prices.length;
      
      const confidence = this.calculateConfidence(iqr_prices.length, year);
      
      return { 
        fmv: Math.round(fmv), 
        finalPrice: Math.round(fmv), // For legacy compatibility
        confidence, 
        sample_size: iqr_prices.length 
      };
      
    } catch (error) {
      console.error('[VALUATION] ❌ Error during calculation:', error.message);
      return null;
    }
  }

  calculateConfidence(sampleSize, year) {
      if (sampleSize >= 20) return 'HIGH';
      if (sampleSize >= 10) return 'MEDIUM';
      return 'LOW';
  }

  async calculateFMVWithDepreciation(brand, model, target_year, trim_level) {
      if (!target_year) return this.calculateFMV(brand, model, null, trim_level);

      const ANNUAL_DEPRECIATION = 0.12; // 12% per year
      // Get data for neighboring years (±3 years)
      const yearData = [];
      for (let y = target_year - 3; y <= target_year + 3; y++) {
          const fmv = await this.calculateFMV(brand, model, y, trim_level);
          if (fmv && fmv.sample_size >= 3) {
              yearData.push({ year: y, fmv: fmv.fmv, count: fmv.sample_size });
          }
      }
      
      if (yearData.length === 0) {
        if (!brand) return null;
        const ceiling = this.getBrandPriceCeiling(brand);
        if (!ceiling) return null;
        const currentYear = new Date().getFullYear();
        const age = target_year ? Math.max(0, currentYear - target_year) : 0;
        const estimated = Math.round(ceiling * Math.pow(1 - ANNUAL_DEPRECIATION, age));
        return {
          fmv: estimated,
          finalPrice: estimated,
          confidence: 'LOW',
          method: 'brand_ceiling_estimate',
          years_used: []
        };
      }
      
      // Weighted average with depreciation adjustment
      let weighted_sum = 0;
      let weight_total = 0;
      
      for (const data of yearData) {
          const age_diff = target_year - data.year;
          // If we want 2022 value, but have 2024 data (diff = -2) -> we depreciate it (make it cheaper? No, older bike is cheaper)
          // Wait, if I have 2024 data (newer) and want 2022 (older), the 2022 bike should be cheaper.
          // Formula: Value(t) = Value(t0) * (1 - dep)^diff
          // If diff is positive (target > data year): We are predicting newer bike from older data. Should be more expensive.
          // If diff is negative (target < data year): We are predicting older bike from newer data. Should be cheaper.
          
          // User formula: data.fmv * Math.pow(1 - ANNUAL_DEPRECIATION, -age_diff);
          // If age_diff = 2022 - 2024 = -2.
          // pow(0.88, 2) = 0.7744. 
          // So older bike value = Newer Value * 0.77. Correct.
          
          // If age_diff = 2024 - 2022 = 2.
          // pow(0.88, -2) = 1 / 0.77 = 1.29.
          // Newer bike value = Older Value * 1.29. Correct.
          
          const adjusted_fmv = data.fmv * Math.pow(1 - ANNUAL_DEPRECIATION, -age_diff);
          const weight = data.count;
          
          weighted_sum += adjusted_fmv * weight;
          weight_total += weight;
      }
      
      const fmvValue = Math.round(weighted_sum / weight_total);

      return { 
          fmv: fmvValue,
          finalPrice: fmvValue, // Legacy compat
          confidence: 'MEDIUM', 
          method: 'depreciation_adjusted', 
          years_used: yearData.map(d => d.year) 
      };
  }
  
  getBrandPriceCeiling(brand) {
    const ceilings = {
      'Santa Cruz': 8000,
      'YT': 6000,
      'Pivot': 9000,
      'Specialized': 10000,
      'Canyon': 5000,
      'Trek': 7000,
      'Giant': 4000,
      'Scott': 6000,
      'Cube': 3500,
      'Propain': 5500,
      'Rose': 4500
    };
    
    return ceilings[brand] || 5000;
  }
}

module.exports = ValuationService;






