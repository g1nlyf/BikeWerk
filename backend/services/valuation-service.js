const DatabaseManager = require('../database/db-manager');

class ValuationService {
  constructor() {
    this.dbManager = new DatabaseManager();
  }

  async calculateFMV(brand, model, year, trim_level) {
    // Support legacy object call
    let listingPrice = null;
    let frameSize = null;
    let frameMaterial = null;
    if (typeof brand === "object") {
        const bike = brand;
        brand = bike.brand;
        model = bike.model;
        year = bike.year;
        trim_level = bike.trim_level;
        listingPrice = bike.price;
        frameSize = bike.frame_size || bike.size || null;
        frameMaterial = bike.frame_material || bike.material || null;
    }

    try {
      console.log(`[VALUATION] Calculating FMV for ${brand} ${model} (${year || "?"})...`);

      if (!brand || !model) return null;

      const db = this.dbManager.getDatabase();
      const patterns = this.buildModelPatterns(model);
      let params = [brand];
      let whereModel = "";
      if (patterns.length > 0) {
        whereModel = " AND (" + patterns.map(() => "(LOWER(model) LIKE LOWER(?) OR LOWER(title) LIKE LOWER(?))").join(" OR " ) + ")";
        patterns.forEach(p => params.push(p, p));
      }

      let query = `
        SELECT price_eur as price, year, title, frame_size, frame_material, trim_level
        FROM market_history
        WHERE LOWER(brand) = LOWER(?)
          AND price_eur > 0
      ` + whereModel;

      if (trim_level) {
        query += " AND trim_level = ?";
        params.push(trim_level);
      }

      query += " ORDER BY price_eur";

      let rows = db.prepare(query).all(...params);

      if (rows.length < 5) {
        // fallback to brand-only if model match is too sparse
        rows = db.prepare(`
          SELECT price_eur as price, year, title, frame_size, frame_material, trim_level
          FROM market_history
          WHERE LOWER(brand) = LOWER(?) AND price_eur > 0
          ORDER BY price_eur
        `).all(brand);
      }

      if (rows.length < 5) return null;

      // Filter by frame size/material if we have enough data
      if (frameSize) {
        const sizeFiltered = rows.filter(r => r.frame_size && r.frame_size.toLowerCase() === String(frameSize).toLowerCase());
        if (sizeFiltered.length >= 3) rows = sizeFiltered;
      }
      if (frameMaterial) {
        const matFiltered = rows.filter(r => r.frame_material && r.frame_material.toLowerCase().includes(String(frameMaterial).toLowerCase()));
        if (matFiltered.length >= 3) rows = matFiltered;
      }

      const withYears = rows.map(r => ({ ...r, year: r.year || this.extractYearFromTitle(r.title) }));
      const yearFiltered = this.selectBestYearSubset(withYears, year);
      const adjusted = yearFiltered.map(r => ({ ...r, price_adjusted: this.adjustPriceForYear(r.price, r.year, year) }));

      const prices = adjusted.map(r => r.price_adjusted || r.price).filter(p => Number.isFinite(p));
      const filteredPrices = this.filterOutliers(prices);
      if (filteredPrices.length < 3) return null;

      const median = this.calculateMedian(filteredPrices);
      let fmv = Math.round(median);

      if (listingPrice && Number.isFinite(listingPrice) && listingPrice > 0) {
        const floor = Math.round(listingPrice * 0.8);
        if (fmv < floor) fmv = floor;
      }

      const confidence = this.calculateConfidence(filteredPrices.length);

      return {
        fmv,
        finalPrice: fmv,
        confidence,
        sample_size: filteredPrices.length,
        method: "market_history"
      };
    } catch (error) {
      console.error('[VALUATION] Error during calculation:', error.message);
      return null;
    }
  }

  calculateConfidence(sampleSize, year) {
      if (sampleSize >= 20) return 'HIGH';
      if (sampleSize >= 10) return 'MEDIUM';
      return 'LOW';
  }

  normalizeText(value) {
    if (!value) return '';
    return String(value)
      .toLowerCase()
      .replace(/[\u2019']/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  sanitizeModel(model) {
    if (!model) return '';
    let cleaned = this.normalizeText(model);
    cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, ' ');
    cleaned = cleaned.replace(/\b(cf|al|sl|slx|s-works|expert|comp|pro|race|rc|factory|team|ultimate|select|r|rs|gx|sx|nx)\b/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  }

  buildModelPatterns(model) {
    const cleaned = this.sanitizeModel(model);
    if (!cleaned) return [];
    const tokens = cleaned.split(' ').filter(Boolean);
    const patterns = new Set();
    if (tokens.length >= 2) patterns.add(tokens.slice(0, 2).join(' '));
    if (tokens.length >= 1) patterns.add(tokens[0]);
    patterns.add(cleaned);
    return Array.from(patterns)
      .filter((p) => p.length >= 2)
      .map((p) => `%${p}%`);
  }

  extractYearFromTitle(title) {
    if (!title) return null;
    const match = String(title).match(/\b(19|20)\d{2}\b/);
    if (!match) return null;
    const year = Number(match[0]);
    if (!Number.isFinite(year)) return null;
    const current = new Date().getFullYear();
    if (year < 1990 || year > current + 1) return null;
    return year;
  }

  adjustPriceForYear(price, rowYear, targetYear) {
    if (!price || !targetYear || !rowYear) return price;
    const diff = Math.max(-6, Math.min(6, targetYear - rowYear));
    if (diff === 0) return price;
    const annualDep = 0.12;
    const factor = Math.pow(1 - annualDep, -diff);
    return price * factor;
  }

  selectBestYearSubset(rows, targetYear) {
    if (!targetYear) return rows;
    const exact = rows.filter(r => r.year === targetYear);
    if (exact.length >= 3) return exact;
    const near1 = rows.filter(r => r.year && Math.abs(r.year - targetYear) <= 1);
    if (near1.length >= 5) return near1;
    const near2 = rows.filter(r => r.year && Math.abs(r.year - targetYear) <= 2);
    if (near2.length >= 5) return near2;
    return rows;
  }

  filterOutliers(prices) {
    if (!prices || prices.length < 4) return prices || [];
    const sorted = [...prices].sort((a, b) => a - b);
    const q1Idx = Math.floor(sorted.length * 0.25);
    const q3Idx = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Idx];
    const q3 = sorted[q3Idx];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return sorted.filter(p => p >= lower && p <= upper);
  }

  calculateMedian(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
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






