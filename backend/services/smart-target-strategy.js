class SmartTargetStrategy {
  constructor() {
    // Модели по категориям
    this.modelDatabase = {
      'DH': {
        'Specialized': ['Demo 8', 'Demo 9', 'Demo Race'],
        'Santa Cruz': ['V10'],
        'YT': ['Tues'],
        'Canyon': ['Sender'],
        'Trek': ['Session'],
        'Giant': ['Glory'],
        'Commencal': ['Supreme DH']
      },
      'Enduro': {
        'Specialized': ['Enduro', 'S-Works Enduro', 'Status', 'Kenevo'],
        'Santa Cruz': ['Megatower', 'Nomad', 'Bullit'],
        'YT': ['Capra', 'Decoy'],
        'Canyon': ['Torque', 'Strive', 'Spectral:ON'],
        'Trek': ['Slash', 'Rail'],
        'Pivot': ['Firebird', 'Mach 6'],
        'Transition': ['Patrol', 'Spire', 'Sentinel'],
        'Commencal': ['Meta AM', 'Meta SX', 'Clash'],
        'Propain': ['Tyee', 'Spindrift'],
        'Nukeproof': ['Mega', 'Giga'],
        'Orbea': ['Rallon']
      },
      'Trail': {
        'Specialized': ['Stumpjumper', 'Stumpjumper Evo', 'Levo', 'Levo SL'],
        'Santa Cruz': ['Bronson', 'Hightower', 'Tallboy', '5010'],
        'YT': ['Jeffsy', 'Izzo'],
        'Canyon': ['Spectral', 'Neuron', 'Stoic'],
        'Trek': ['Fuel EX', 'Remedy', 'Roscoe'],
        'Giant': ['Trance', 'Reign'],
        'Scott': ['Genius', 'Ransom'],
        'Orbea': ['Occam', 'Laufey'],
        'Cube': ['Stereo 120', 'Stereo 140', 'Stereo 150'],
        'Norco': ['Optic', 'Fluid']
      },
      'XC': {
        'Specialized': ['Epic', 'Epic Evo'],
        'Santa Cruz': ['Blur'],
        'Canyon': ['Lux'],
        'Scott': ['Spark'],
        'Trek': ['Top Fuel']
      }
    };
    
    // Целевое распределение по ценовым диапазонам
    this.priceDistribution = {
      'budget': { min: 500, max: 1200, target_percentage: 15 },
      'mid': { min: 1200, max: 2500, target_percentage: 35 },
      'premium': { min: 2500, max: 4000, target_percentage: 30 },
      'high_end': { min: 4000, max: 8000, target_percentage: 20 }
    };
  }
  
  /**
   * Генерирует список целей для Hunter с балансировкой
   */
  async generateTargets(totalBikes = 100) {
    const targets = [];
    
    // Рассчитать нужное количество по ценовым диапазонам
    const priceTargets = {};
    for (const [tier, config] of Object.entries(this.priceDistribution)) {
      priceTargets[tier] = Math.round(totalBikes * config.target_percentage / 100);
    }
    
    console.log('🎯 Target distribution:');
    console.log(`  Budget (€500-1200):      ${priceTargets.budget} bikes`);
    console.log(`  Mid-range (€1200-2500):  ${priceTargets.mid} bikes`);
    console.log(`  Premium (€2500-4000):    ${priceTargets.premium} bikes`);
    console.log(`  High-end (€4000-8000):   ${priceTargets.high_end} bikes\n`);
    
    // Для каждого ценового диапазона
    for (const [tier, targetCount] of Object.entries(priceTargets)) {
      const tierConfig = this.priceDistribution[tier];
      
      // Распределить по категориям
      const categoriesForTier = this.getCategoriesForPriceTier(tier);
      const bikesPerCategory = Math.ceil(targetCount / categoriesForTier.length);
      
      for (const category of categoriesForTier) {
        const brands = Object.keys(this.modelDatabase[category] || {});
        
        for (const brand of brands) {
          const models = this.modelDatabase[category][brand];
          
          for (const model of models) {
            targets.push({
              brand,
              model,
              category,
              minPrice: tierConfig.min,
              maxPrice: tierConfig.max,
              tier,
              priority: this.calculatePriority(tier, category)
            });
            
            // Ограничение: не больше нужного для этого tier
            if (targets.filter(t => t.tier === tier).length >= targetCount) {
              break;
            }
          }
          
          if (targets.filter(t => t.tier === tier).length >= targetCount) {
            break;
          }
        }
      }
    }
    
    return targets;
  }
  
  getCategoriesForPriceTier(tier) {
    const mapping = {
      'budget': ['XC', 'Trail'],
      'mid': ['Trail', 'Enduro'],
      'premium': ['Enduro', 'Trail'],
      'high_end': ['Enduro', 'DH']
    };
    
    return mapping[tier] || ['Trail'];
  }
  
  calculatePriority(tier, category) {
    // High-end DH = самый высокий приоритет (большая маржа)
    if (tier === 'high_end' && category === 'DH') return 10;
    if (tier === 'premium' && category === 'Enduro') return 9;
    if (tier === 'mid' && category === 'Trail') return 7;
    return 5;
  }
}

module.exports = SmartTargetStrategy;
