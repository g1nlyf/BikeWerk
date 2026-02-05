const { DatabaseManager } = require('../js/mysql-config');
const db = new DatabaseManager();
const BuycycleCollector = require('../../scrapers/buycycle-collector');
// const KleinanzeigenCollector = require('../../telegram-bot/unified-hunter'); // Assuming this exposes logic or we reuse parts
// Correct path for unified-hunter if it exists
// Looking at previous tools output, it might be in backend/telegram-bot or similar.
// Actually, let's just assume we might not need to import it if we mock the response for now, 
// OR fix the path. 
// In server.js, we see: const UnifiedHunter = require('../telegram-bot/unified-hunter.js'); (relative to server.js in backend root)
// So from backend/src/services, it should be ../../telegram-bot/unified-hunter.js
// But maybe the file is not there or named differently.
// Let's use a mock for KleinanzeigenCollector to pass the test if file missing, or try to find it.
// The error says MODULE_NOT_FOUND.
// Let's check where it is.
// Using LS earlier: c:\Users\hacke\CascadeProjects\Finals1\eubike\backend\telegram-bot DOES NOT EXIST in the tree shown?
// Ah, server.js says require('../telegram-bot/unified-hunter.js')
// server.js is in backend/
// So telegram-bot is a sibling of backend? No, ../ means parent of backend?
// Wait. server.js is in backend/. require('../telegram-bot') means c:\Users\hacke\CascadeProjects\Finals1\eubike\telegram-bot
// So from backend/src/services, we need to go up: ../../ (to backend) -> ../ (to eubike) -> telegram-bot
// So ../../../telegram-bot/unified-hunter.js

const KleinanzeigenCollector = require('../../scrapers/kleinanzeigen-collector');

class DeepCatalogBuilder {
  
  async buildDeepCatalogForModel(brand, model) {
    console.log(`\n🎯 Building deep catalog: ${brand} ${model}`);
    
    // 1. Get FMV Stats
    const fmvData = await this.getFMVStats(brand, model);
    console.log(`FMV Stats: Median €${fmvData.median_price}, Range €${fmvData.min_price}-€${fmvData.max_price}`);

    // 2. Define Price Brackets
    const brackets = this.definePriceBrackets(fmvData);
    console.log(`Price brackets: ${JSON.stringify(brackets)}`);
    
    const catalog = [];
    
    // 3. Collect for each bracket
    for (const bracket of brackets) {
      console.log(`\n📊 Bracket: ${bracket.name.toUpperCase()} (€${bracket.min}-${bracket.max})`);
      
      const targets = {
        kleinanzeigen: 2, // 2 cheapest
        buycycle: 1,      // 1 verified
        bikeflip: 1       // 1 premium (optional)
      };
      
      for (const [source, count] of Object.entries(targets)) {
        if (count === 0) continue;

        try {
            const found = await this.collectFromSource(
              source, brand, model, bracket.min, bracket.max, count
            );
            
            if (found && found.length > 0) {
                console.log(`   ✅ Found ${found.length} bikes from ${source}`);
                catalog.push(...found);
            } else {
                console.log(`   ⚠️ No bikes found from ${source}`);
            }
        } catch (e) {
            console.error(`   ❌ Error collecting from ${source}: ${e.message}`);
        }
        
        // Rate limit between sources/brackets
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    console.log(`\n✅ Deep catalog for ${brand} ${model}: ${catalog.length} bikes collected`);
    return catalog;
  }
  
  definePriceBrackets(fmvData) {
    const median = fmvData.median_price || 2000;
    
    return [
      { name: 'budget', min: Math.round(median * 0.5), max: Math.round(median * 0.7) },
      { name: 'mid', min: Math.round(median * 0.7), max: Math.round(median * 0.9) },
      { name: 'fair', min: Math.round(median * 0.9), max: Math.round(median * 1.1) },
      { name: 'premium', min: Math.round(median * 1.1), max: Math.round(median * 1.3) }
    ];
  }
  
  async collectFromSource(source, brand, model, minPrice, maxPrice, count) {
    // Filter logic helper
    const matchesPrice = (price) => price >= minPrice && price <= maxPrice;

    switch(source) {
      case 'kleinanzeigen':
        try {
            // Use standardized collector
            // We search for "Brand Model" to get best results
            const term = `${brand} ${model}`;
            const results = await KleinanzeigenCollector.searchBikes(term, {
                limit: 20, // Fetch more to filter down
                minPrice: minPrice,
                maxPrice: maxPrice
            });
            
            // Filter by Model (Fuzzy match) to ensure accuracy
            const modelKeywords = model.toLowerCase().split(' ');
            const filtered = results.filter(item => {
                const t = item.title.toLowerCase();
                return modelKeywords.every(kw => t.includes(kw));
            });
            
            console.log(`   ✅ Kleinanzeigen: Found ${results.length} total, ${filtered.length} matching "${model}"`);
            
            return filtered.slice(0, count);
            
        } catch (e) {
            console.error(`   ❌ Kleinanzeigen Error: ${e.message}`);
            return [];
        }

      case 'buycycle':
        // Smart Hunt with Filters
        const buycycleItems = await BuycycleCollector.collectForTarget({ 
            brand, 
            model,
            minPrice, 
            maxPrice,
            limit: count // Fetch exactly what we need
        });
        return buycycleItems;

      case 'bikeflip':
        // Placeholder for Bikeflip
        return [];
    }
    return [];
  }
  
  async getFMVStats(brand, model) {
    try {
        const stats = await db.query(`
          SELECT 
            AVG(price_eur) as median_price, 
            MIN(price_eur) as min_price, 
            MAX(price_eur) as max_price, 
            COUNT(*) as sample_size 
          FROM market_history 
          WHERE brand = ? AND model LIKE ? 
          AND quality_score >= 70 
        `, [brand, `%${model}%`]);
        
        if (stats && stats[0] && stats[0].sample_size > 0) {
            return stats[0];
        }
    } catch (e) {
        console.error('Error getting FMV stats:', e.message);
    }
    
    return { median_price: 2000, min_price: 1000, max_price: 4000 };
  }
}

module.exports = new DeepCatalogBuilder();
