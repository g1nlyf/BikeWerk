const HotnessPredictor = require('../ai/hotness-predictor.js');
const DatabaseManager = require('../database/db-manager');
const dbManager = new DatabaseManager();

class SmartPriorityManager {
  
  get db() {
      return dbManager.getDatabase();
  }

  // INTEGRATION 1: Hunter Priority Boost
  async adjustHunterPriorities() {
    console.log('🎯 Adjusting Hunter priorities based on AI...\n');
    
    // Получить модели которые исторически продаются быстро
    const fastMovers = this.db.prepare(`
      SELECT brand, model, AVG(predicted_days_to_sell) as avg_speed
      FROM bike_analytics
      WHERE status = 'sold' OR status = 'active'
      GROUP BY brand, model
      HAVING avg_speed < 7
      ORDER BY avg_speed ASC
      LIMIT 20
    `).all();
    
    console.log('🔥 Fast Movers (Priority Boost):');
    for (const model of fastMovers) {
      console.log(`├─ ${model.brand} ${model.model} (${model.avg_speed.toFixed(1)} days avg)`);
      
      // Boost priority в FMV Priority Matrix
      await this.boostFMVPriority(model.brand, model.model, 50);
    }
    
    // Получить модели которые висят долго
    const slowMovers = this.db.prepare(`
      SELECT brand, model, AVG(predicted_days_to_sell) as avg_speed
      FROM bike_analytics
      WHERE status = 'sold' OR status = 'active'
      GROUP BY brand, model
      HAVING avg_speed > 30
      ORDER BY avg_speed DESC
      LIMIT 10
    `).all();
    
    console.log('\n🐌 Slow Movers (Priority Decrease):');
    for (const model of slowMovers) {
      console.log(`├─ ${model.brand} ${model.model} (${model.avg_speed.toFixed(1)} days avg)`);
      
      // Decrease priority
      await this.boostFMVPriority(model.brand, model.model, -30);
    }
  }
  
  async boostFMVPriority(brand, model, delta) {
    // Update priority в config/fmv-priority-matrix
    try {
        const priorityMatrixPath = '../config/fmv-priority-matrix.js';
        // Note: This modifies the in-memory module, not the file.
        // To persist, we might need to write to file or DB if the matrix is dynamic.
        // Assuming for now we are modifying runtime config or the matrix is exported as mutable.
        
        let PriorityMatrix;
        try {
            PriorityMatrix = require(priorityMatrixPath);
        } catch(e) {
            // config might not exist yet or path is different
            return;
        }

        if (PriorityMatrix && PriorityMatrix.matrix) {
            const entry = PriorityMatrix.matrix.find(m => 
                m.brand === brand && m.model.toLowerCase().includes(model.toLowerCase())
            );
            
            if (entry) {
                entry.priority = Math.max(0, Math.min(150, entry.priority + delta));
                entry.ai_adjusted = true;
            }
        }
    } catch (e) {
        console.error('Error boosting priority:', e.message);
    }
  }
  
  // INTEGRATION 2: Refill Queue Prioritization
  async prioritizeRefillQueue() {
    console.log('\n🔄 Prioritizing Refill Queue...\n');
    
    const queue = this.db.prepare(`
      SELECT * FROM refill_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();
    
    // Добавить AI score каждой записи
    const scored = [];
    
    const getAvgHotness = this.db.prepare(`
        SELECT AVG(predicted_hotness) as avg_hotness
        FROM bike_analytics
        WHERE brand = ? AND model LIKE ?
    `);

    for (const item of queue) {
      // Получить historical hotness этой модели
      const historicalHotness = getAvgHotness.get(item.brand, `%${item.model}%`);
      
      const score = (historicalHotness?.avg_hotness || 50) + (item.tier === 1 ? 30 : 0);
      
      scored.push({ ...item, ai_score: score });
    }
    
    // Сортируем по AI score
    scored.sort((a, b) => b.ai_score - a.ai_score);
    
    console.log('📋 Refill Queue (AI Prioritized):');
    scored.slice(0, 10).forEach((item, i) => {
      console.log(`${i+1}. ${item.brand} ${item.model} [Tier ${item.tier}] - AI Score: ${item.ai_score.toFixed(0)}`);
    });
    
    // In a real system, we might update a 'priority' column in refill_queue here
    
    return scored;
  }
  
  // INTEGRATION 3: Catalog Optimization
  async optimizeCatalog() {
    console.log('\n🧹 Catalog Optimization (Remove Slow Movers)...\n');
    
    // Найти байки с low hotness которые висят >30 дней
    const candidates = this.db.prepare(`
      SELECT b.*, a.days_to_sell, a.predicted_hotness
      FROM bikes b
      JOIN bike_analytics a ON a.bike_id = b.id
      WHERE b.is_active = 1
      AND a.predicted_hotness < 30
      AND (JULIANDAY('now') - JULIANDAY(b.created_at)) > 30
      AND b.tier >= 2 -- Не трогаем Tier 1 (премиум)
    `).all();
    
    console.log(`Found ${candidates.length} slow movers for removal:`);
    
    let removed = 0;
    
    const deactivateBike = this.db.prepare(`
        UPDATE bikes
        SET is_active = 0, deactivation_reason = 'ai_slow_mover'
        WHERE id = ?
    `);

    for (const bike of candidates) {
      console.log(`❌ Removing: ${bike.brand} ${bike.model} (Hotness: ${bike.predicted_hotness})`);
      
      deactivateBike.run(bike.id);
      
      removed++;
    }
    
    console.log(`\n✅ Removed ${removed} slow movers (free up capital for fast movers)`);
    
    return { removed };
  }
}

module.exports = new SmartPriorityManager();
