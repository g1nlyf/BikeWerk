const PriorityMatrix = require('../../config/fmv-priority-matrix');
const ValuationServiceClass = require('./ValuationService');
const ValuationService = new ValuationServiceClass();

class GraduatedHunter {
  
  // STAGE 1: Whitelist Check 
  async stage1_whitelist(bike) { 
    const matrix = PriorityMatrix.matrix; 
    const entry = matrix.find(m => 
      m.brand.toLowerCase() === bike.brand.toLowerCase() && 
      bike.model.toLowerCase().includes(m.model.toLowerCase()) 
    ); 
    
    if (!entry) { 
      return { pass: false, reason: 'Brand/model not in whitelist' }; 
    } 
    
    bike.tier = entry.tier; 
    bike.priority = entry.priority; 
    bike.min_price = entry.min_price; 
    
    return { pass: true, tier: entry.tier }; 
  } 
  
  // STAGE 2: Price Filter (tier-dependent) 
  async stage2_price(bike) { 
    if (bike.price < bike.min_price) { 
      return { pass: false, reason: `Price too low (min: €${bike.min_price})` }; 
    } 
    
    // Tier 1: нет верхнего лимита (премиум) 
    // Tier 2/3: upper limit (иначе это new bike, не used) 
    const maxPrice = { 
      1: 15000, 
      2: 6000, 
      3: 4000 
    }[bike.tier]; 
    
    if (bike.price > maxPrice) { 
      return { pass: false, reason: 'Price suspiciously high (likely new)' }; 
    } 
    
    return { pass: true }; 
  } 
  
  // STAGE 3: FMV Confidence Check 
  async stage3_fmv(bike) { 
    const valuation = await ValuationService.calculateFMVWithDepreciation( 
      bike.brand, bike.model, bike.year 
    ); 
    
    if (!valuation) { 
      // Если Tier 1 - отправляем на ручную проверку (джекпот) 
      if (bike.tier === 1) { 
        return { pass: 'manual', reason: 'Tier 1 без FMV → Manual review' }; 
      } 
      return { pass: false, reason: 'No FMV data' }; 
    } 
    
    bike.fmv = valuation.fmv; 
    bike.fmv_confidence = valuation.confidence; 
    bike.discount_pct = ((valuation.fmv - bike.price) / valuation.fmv) * 100; 
    
    // Tier-specific thresholds 
    const minDiscount = { 
      1: 15, // Tier 1: даже 15% скидка - окей (премиум) 
      2: 20, 
      3: 25  // Tier 3: нужна большая скидка (низкая маржа) 
    }[bike.tier]; 
    
    if (bike.discount_pct < minDiscount) { 
      return { pass: false, reason: `Discount too low (${bike.discount_pct.toFixed(0)}% < ${minDiscount}%)` }; 
    } 
    
    return { pass: true, discount: bike.discount_pct }; 
  } 
  
  // STAGE 4: Profit Margin Check 
  async stage4_margin(bike) { 
    const costs = this.calculateCosts(bike); 
    const selling_price = bike.fmv * 0.95; // Продаем чуть ниже FMV 
    const profit = selling_price - bike.price - costs.total; 
    
    bike.estimated_profit = profit; 
    
    // Tier-specific minimum profit 
    const minProfit = { 
      1: 300, // Tier 1: не берем если < €300 profit 
      2: 200, 
      3: 150 
    }[bike.tier]; 
    
    if (profit < minProfit) { 
      return { pass: false, reason: `Profit too low (€${profit} < €${minProfit})` }; 
    } 
    
    return { pass: true, profit: profit }; 
  } 
  
  // STAGE 5: Final Quality Gate 
  async stage5_quality(bike) { 
    // TechDecoder quality score 
    if (bike.quality_score < 70) { 
      return { pass: false, reason: 'Low data quality' }; 
    } 
    
    // Check for red flags 
    const redFlags = [ 
      (bike.description || '').toLowerCase().includes('defekt'), 
      (bike.description || '').toLowerCase().includes('unfall'), 
      (bike.description || '').toLowerCase().includes('riss'), 
      !bike.year || bike.year < 2018, // Слишком старый 
    ]; 
    
    if (redFlags.some(flag => flag)) { 
      return { pass: false, reason: 'Red flag detected' }; 
    } 
    
    return { pass: true }; 
  } 
  
  // RUN ALL STAGES 
  async evaluateBike(bike) { 
    const stages = [ 
      { name: 'Whitelist', fn: this.stage1_whitelist.bind(this) }, 
      { name: 'Price Filter', fn: this.stage2_price.bind(this) }, 
      { name: 'FMV Check', fn: this.stage3_fmv.bind(this) }, 
      { name: 'Margin Check', fn: this.stage4_margin.bind(this) }, 
      { name: 'Quality Gate', fn: this.stage5_quality.bind(this) } 
    ]; 
    
    for (const stage of stages) { 
      const result = await stage.fn(bike); 
      
      console.log(`[STAGE ${stage.name}] ${result.pass ? '✅' : '❌'} ${result.reason || ''}`); 
      
      if (result.pass === false) { 
        bike.rejection_stage = stage.name; 
        bike.rejection_reason = result.reason; 
        return { approved: false, stage: stage.name }; 
      } 
      
      if (result.pass === 'manual') { 
        bike.status = 'manual_review'; 
        return { approved: 'manual', stage: stage.name }; 
      } 
    } 
    
    // Passed all stages! 
    bike.status = 'approved'; 
    bike.is_active = 1; 
    
    return { approved: true, profit: bike.estimated_profit }; 
  } 
  
  calculateCosts(bike) { 
    return { 
      shipping: 50, 
      inspection: 20, 
      service_fee: 30, 
      total: 100 
    }; 
  } 
} 

module.exports = new GraduatedHunter(); 
