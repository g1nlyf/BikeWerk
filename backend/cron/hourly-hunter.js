const UnifiedHunter = require('../scripts/unified-hunter');
const DatabaseManager = require('../database/db-manager');
const HotnessPredictor = require('../ai/hotness-predictor');
const SmartPriorityManager = require('../services/smart-priority-manager');
const HotDealHunter = require('../scrapers/HotDealHunter');

class HourlyHunter {
  constructor() {
    this.dbManager = new DatabaseManager();
    this.hunter = new UnifiedHunter();

    this.config = {
      targetCatalogSize: 500,      // Цель
      minCatalogSize: 100,         // Минимум перед срочным пополнением
      normalBatch: 20,             // Обычно добавляем (Requested by user)
      urgentBatch: 20,             // Если каталог почти пустой
      maxBikesPerHour: 20          // Защита от перегрузки
    };
  }

  async run() {
    console.log('\n' + '═'.repeat(60));
    console.log('⏰ HOURLY HUNTER - Auto Run');
    console.log('═'.repeat(60));
    console.log(`Time: ${new Date().toLocaleString('de-DE')}\n`);

    try {
      // PHASE 0: SPRINT 1 HOT DEAL HUNT
      // Run unconditionally every hour to ensure freshness of "Best Offers"
      console.log('🔥 PHASE 0: HOT DEAL HUNT (Sprint 1)');
      try {
        const hotStats = await HotDealHunter.hunt(5); // Limit 5 per hour to keep it exclusive
        console.log(`✅ Hot Deals: Found ${hotStats.found}, Added ${hotStats.added}\n`);
      } catch (e) {
        console.error('❌ Hot Deal Hunt failed:', e.message);
      }

      // Проверка здоровья каталога
      const health = await this.checkHealth();

      console.log('📊 Catalog Health:\n');
      console.log(`  Active bikes:     ${health.active}`);
      console.log(`  Target:           ${this.config.targetCatalogSize}`);
      console.log(`  Needed:           ${Math.max(0, this.config.targetCatalogSize - health.active)}`);
      console.log(`  Avg margin:       ${health.avgMargin.toFixed(1)}%\n`);

      // NEW PHASE 6: AI Hotness Prediction
      console.log('🤖 PHASE 6: AI Hotness Prediction');
      let aiStats = {};
      try {
        aiStats = await HotnessPredictor.predictCatalog();
        console.log(`✅ AI: Updated ${aiStats.hot + aiStats.warm} hot bikes\n`);
      } catch (e) {
        console.error('❌ AI Prediction failed:', e.message);
        aiStats = { error: e.message };
      }

      // NEW PHASE 7: Smart Priority Adjustment
      console.log('🎯 PHASE 7: Priority Adjustment');
      try {
        await SmartPriorityManager.adjustHunterPriorities();
        await SmartPriorityManager.prioritizeRefillQueue();
        console.log(`✅ Priorities adjusted\n`);
      } catch (e) {
        console.error('❌ Priority adjustment failed:', e.message);
      }

      // Решение о количестве
      let bikesToAdd = 0;

      if (health.active < this.config.minCatalogSize) {
        // Срочное пополнение
        bikesToAdd = this.config.urgentBatch;
        console.log('🚨 URGENT: Catalog critically low!\n');
      } else if (health.active < this.config.targetCatalogSize) {
        // Обычное пополнение
        bikesToAdd = this.config.normalBatch;
        console.log('✅ NORMAL: Regular refill\n');
      } else {
        console.log('✅ HEALTHY: No action needed\n');
        return;
      }

      // Запуск Hunter
      console.log(`🚀 Starting hunt for ${bikesToAdd} bikes...\n`);

      const startTime = Date.now();

      await this.hunter.startHunt({
        totalBikes: bikesToAdd,
        smartMode: true
      });

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

      // Проверка результата
      const newHealth = await this.checkHealth();
      const added = newHealth.active - health.active;

      console.log('\n' + '═'.repeat(60));
      console.log('📊 RESULTS:\n');
      console.log(`  Duration:         ${duration} minutes`);
      console.log(`  Bikes added:      ${added}`);
      console.log(`  Active now:       ${newHealth.active}`);
      console.log(`  Success rate:     ${(added / bikesToAdd * 100).toFixed(0)}%\n`);

      // Логирование
      await this.logRun({
        bikesToAdd,
        bikesAdded: added,
        duration,
        healthBefore: health,
        healthAfter: newHealth,
        aiStats: aiStats // Add AI stats to logs
      });

      console.log('✅ Hourly run complete\n');

    } catch (error) {
      console.error('❌ Error in hourly run:', error);
      await this.logError(error);
    }
  }

  async checkHealth() {
    const db = this.dbManager.getDatabase();

    // Check if fmv column exists first
    const tableInfo = db.prepare('PRAGMA table_info(bikes)').all();
    const hasFmv = tableInfo.some(col => col.name === 'fmv');

    if (hasFmv) {
      const stats = db.prepare(`
          SELECT 
            COUNT(*) as total, 
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active, 
            AVG(CASE WHEN is_active = 1 AND fmv > 0 
              THEN (fmv - price) / price * 100 
              ELSE NULL END) as avgMargin 
          FROM bikes
        `).get();

      return {
        total: stats.total || 0,
        active: stats.active || 0,
        avgMargin: stats.avgMargin || 0
      };
    } else {
      // Fallback if fmv column doesn't exist yet
      const stats = db.prepare(`
          SELECT 
            COUNT(*) as total, 
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
          FROM bikes
        `).get();

      return {
        total: stats.total || 0,
        active: stats.active || 0,
        avgMargin: 0
      };
    }
  }

  async logRun(data) {
    const db = this.dbManager.getDatabase();

    db.prepare(`
      INSERT INTO hunter_events (type, details, created_at) 
      VALUES (?, ?, datetime('now'))
    `).run('HOURLY_RUN_COMPLETE', JSON.stringify(data));
  }

  async logError(error) {
    const db = this.dbManager.getDatabase();

    db.prepare(`
      INSERT INTO hunter_events (type, details, created_at) 
      VALUES (?, ?, datetime('now'))
    `).run('HOURLY_RUN_ERROR', JSON.stringify({
      message: error.message,
      stack: error.stack
    }));
  }
}

// Запуск если вызван напрямую
if (require.main === module) {
  const hourlyHunter = new HourlyHunter();
  hourlyHunter.run()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = HourlyHunter;
