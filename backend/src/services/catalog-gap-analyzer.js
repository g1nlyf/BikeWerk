
const { DatabaseManager } = require('../js/mysql-config');
const db = new DatabaseManager();

class CatalogGapAnalyzer {
  
  /** 
   * Анализ пробелов в каталоге для конкретной модели 
   * @param {string} brand - "Canyon" 
   * @param {string} model - "Spectral" 
   * @returns {Object} - что НЕ хватает 
   */ 
  async analyzeModelGaps(brand, model) { 
    console.log(`🔍 [GAP ANALYZER] Analyzing: ${brand} ${model}`); 
    
    // 1. Текущее состояние каталога 
    // Using simple LIKE for model matching
    const currentBikes = await db.query(` 
      SELECT 
        size as frame_size, price, year, hotness_score, 
        created_at, views as views_count 
      FROM bikes 
      WHERE brand = ? AND (model LIKE ? OR name LIKE ?)
      AND is_active = 1 
    `, [brand, `%${model}%`, `%${model}%`]); 
    // Note: Schema might use 'size' or 'frame_size'. Checking schema...
    // In bikes table, it is usually 'size'. The user code used 'frame_size'.
    // I aliased 'size as frame_size' to match user logic.
    
    console.log(`   Current catalog: ${currentBikes.length} bikes`); 
    
    // 2. TARGET COMPOSITION (идеальный микс) 
    const tier = await this.getTier(brand); 
    const targetComposition = this.getTargetComposition(tier); 
    
    console.log(`   Target: ${JSON.stringify(targetComposition)}`); 
    
    // 3. SIZE GAPS 
    const sizeGaps = this.analyzeSizeGaps(currentBikes, targetComposition.sizes); 
    
    // 4. PRICE GAPS 
    const priceGaps = this.analyzePriceGaps(currentBikes, targetComposition.priceRanges); 
    
    // 5. FRESHNESS GAPS 
    const freshnessGaps = this.analyzeFreshnessGaps(currentBikes); 
    
    // 6. VELOCITY GAPS (быстро продающиеся варианты) 
    const velocityGaps = await this.analyzeVelocityGaps(brand, model); 
    
    return { 
      brand, 
      model, 
      tier, 
      current: { 
        count: currentBikes.length, 
        sizes: this.extractSizes(currentBikes), 
        priceRange: this.extractPriceRange(currentBikes), 
        avgAge: this.calculateAvgAge(currentBikes) 
      }, 
      gaps: { 
        sizes: sizeGaps, 
        prices: priceGaps, 
        freshness: freshnessGaps, 
        velocity: velocityGaps 
      }, 
      priority: this.calculatePriority(sizeGaps, priceGaps, freshnessGaps, velocityGaps) 
    }; 
  } 
  
  /** 
   * TARGET COMPOSITION (зависит от Tier) 
   */ 
  getTargetComposition(tier) { 
    if (tier === 1) { 
      return { 
        totalBikes: 15, // Tier 1 = 15 вариантов на модель 
        sizes: { 
          'S': 2,   // 13% 
          'M': 5,   // 33% 
          'L': 5,   // 33% 
          'XL': 3   // 20% 
        }, 
        priceRanges: [ 
          { min: 1500, max: 2500, target: 5 }, // Entry premium 
          { min: 2500, max: 4000, target: 7 }, // Sweet spot 
          { min: 4000, max: 6000, target: 3 }  // High-end 
        ], 
        maxAge: 3 // Max 3 года (2023+) 
      }; 
    } else if (tier === 2) { 
      return { 
        totalBikes: 10, 
        sizes: { 
          'M': 4, 
          'L': 4, 
          'S': 1, 
          'XL': 1 
        }, 
        priceRanges: [ 
          { min: 800, max: 1500, target: 4 }, 
          { min: 1500, max: 2500, target: 4 }, 
          { min: 2500, max: 3500, target: 2 } 
        ], 
        maxAge: 5 
      }; 
    } else { 
      return { 
        totalBikes: 8, 
        sizes: { 'M': 3, 'L': 3, 'S': 1, 'XL': 1 }, 
        priceRanges: [ 
          { min: 400, max: 1000, target: 4 }, 
          { min: 1000, max: 1800, target: 3 }, 
          { min: 1800, max: 2500, target: 1 } 
        ], 
        maxAge: 6 
      }; 
    } 
  }


/** 
   * SIZE GAPS: каких размеров не хватает? 
   */ 
  analyzeSizeGaps(currentBikes, targetSizes) { 
    const currentSizes = {}; 
    currentBikes.forEach(b => { 
      const size = (b.frame_size || 'Unknown').toUpperCase(); 
      currentSizes[size] = (currentSizes[size] || 0) + 1; 
    }); 
    
    const gaps = []; 
    for (const [size, targetCount] of Object.entries(targetSizes)) { 
      const current = currentSizes[size] || 0; 
      if (current < targetCount) { 
        gaps.push({ 
          size, 
          current, 
          target: targetCount, 
          deficit: targetCount - current 
        }); 
      } 
    } 
    
    console.log(`   Size gaps: ${JSON.stringify(gaps)}`); 
    return gaps; 
  } 
  
  /** 
   * PRICE GAPS: каких ценовых сегментов не хватает? 
   */ 
  analyzePriceGaps(currentBikes, targetRanges) { 
    const gaps = []; 
    
    for (const range of targetRanges) { 
      const bikesInRange = currentBikes.filter(b => 
        b.price >= range.min && b.price <= range.max 
      ); 
      
      if (bikesInRange.length < range.target) { 
        gaps.push({ 
          priceRange: `€${range.min}-${range.max}`, 
          current: bikesInRange.length, 
          target: range.target, 
          deficit: range.target - bikesInRange.length 
        }); 
      } 
    } 
    
    console.log(`   Price gaps: ${JSON.stringify(gaps)}`); 
    return gaps; 
  } 
  
  /** 
   * FRESHNESS GAPS: много старых bikes? 
   */ 
  analyzeFreshnessGaps(currentBikes) { 
    const currentYear = new Date().getFullYear(); 
    const oldBikes = currentBikes.filter(b => 
      b.year && (currentYear - b.year) > 4 
    ); 
    
    const gap = { 
      oldBikesCount: oldBikes.length, 
      needFreshBikes: oldBikes.length > currentBikes.length * 0.3, // >30% старых 
      minYear: currentYear - 3 // Нужны bikes 2023+ 
    }; 
    
    console.log(`   Freshness gap: ${gap.needFreshBikes ? 'YES (need 2023+)' : 'OK'}`); 
    return gap; 
  } 
  
  /** 
   * VELOCITY GAPS: какие варианты продаются быстро? 
   */ 
  async analyzeVelocityGaps(brand, model) { 
    // Проверяем sold bikes этой модели 
    // Using deactivated_at as proxy for sold_at since sold_at column is missing in bikes table
    try {
        const soldBikes = await db.query(` 
        SELECT size as frame_size, price, 
                (julianday(deactivated_at) - julianday(created_at)) as days_to_sell 
        FROM bikes 
        WHERE brand = ? AND (model LIKE ? OR name LIKE ?) 
        AND is_active = 0 AND deactivated_at IS NOT NULL 
        ORDER BY days_to_sell ASC 
        LIMIT 10 
        `, [brand, `%${model}%`, `%${model}%`]); 
        
        if (soldBikes.length === 0) { 
            console.log(`   Velocity: No historical data`); 
            return { fastMovers: [] }; 
        } 
        
        // Fast movers = bikes sold in <7 days 
        const fastMovers = soldBikes.filter(b => b.days_to_sell < 7); 
        
        const patterns = {}; 
        fastMovers.forEach(b => { 
            const key = `${b.frame_size}_${Math.floor(b.price / 500) * 500}`; 
            patterns[key] = (patterns[key] || 0) + 1; 
        }); 
        
        console.log(`   Velocity patterns: ${JSON.stringify(patterns)}`); 
        
        return { 
            fastMovers: Object.entries(patterns).map(([key, count]) => ({ 
            pattern: key, 
            soldCount: count, 
            priority: count >= 3 ? 'HIGH' : 'MEDIUM' 
            })) 
        }; 
    } catch (e) {
        console.warn('Velocity Gap Error:', e.message);
        return { fastMovers: [] };
    }
  } 
  
  /** 
   * PRIORITY CALCULATION: какой пробел самый критичный? 
   */ 
  calculatePriority(sizeGaps, priceGaps, freshnessGaps, velocityGaps) { 
    let score = 0; 
    
    // Size gaps = +10 per missing size 
    score += sizeGaps.reduce((sum, g) => sum + g.deficit * 10, 0); 
    
    // Price gaps = +15 per missing price point 
    score += priceGaps.reduce((sum, g) => sum + g.deficit * 15, 0); 
    
    // Freshness = +20 if old bikes >30% 
    if (freshnessGaps.needFreshBikes) score += 20; 
    
    // Velocity = +25 if fast movers missing 
    score += velocityGaps.fastMovers.filter(f => f.priority === 'HIGH').length * 25; 
    
    if (score > 100) return 'URGENT'; 
    if (score > 50) return 'HIGH'; 
    if (score > 20) return 'MEDIUM'; 
    return 'LOW'; 
  } 
  
  // Helper methods 
  async getTier(brand) { 
    try {
        const brandsConfig = require('../../config/brands-config.json'); 
        if (brandsConfig.tier1.find(b => b.name === brand)) return 1; 
        if (brandsConfig.tier2.find(b => b.name === brand)) return 2; 
    } catch (e) {
        // Fallback or relative path issue
    }
    return 3; 
  } 
  
  extractSizes(bikes) { 
    const sizes = {}; 
    bikes.forEach(b => { 
      const s = (b.frame_size || 'Unknown').toUpperCase(); 
      sizes[s] = (sizes[s] || 0) + 1; 
    }); 
    return sizes; 
  } 
  
  extractPriceRange(bikes) { 
    const prices = bikes.map(b => b.price).filter(p => p); 
    return prices.length > 0 
      ? { min: Math.min(...prices), max: Math.max(...prices) } 
      : { min: 0, max: 0 }; 
  } 
  
  calculateAvgAge(bikes) { 
    const currentYear = new Date().getFullYear(); 
    const ages = bikes.map(b => b.year ? currentYear - b.year : null).filter(a => a !== null); 
    return ages.length > 0 
      ? (ages.reduce((sum, a) => sum + a, 0) / ages.length).toFixed(1) 
      : 'N/A'; 
  } 
} 

module.exports = new CatalogGapAnalyzer();
