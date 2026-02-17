const UnifiedHunter = require('../scripts/unified-hunter');
const DatabaseManager = require('../database/db-manager');
const HotnessPredictor = require('../ai/hotness-predictor');
const SmartPriorityManager = require('../services/smart-priority-manager');
const HotDealHunter = require('../src/services/HotDealHunter');

class HourlyHunter {
  constructor() {
    this.dbManager = new DatabaseManager();
    this.hunter = new UnifiedHunter();

    this.config = {
      targetCatalogSize: 500,
      minCatalogSize: 100,
      normalBatch: 30,
      urgentBatch: 60,
      maxBikesPerHour: 60
    };

    this.categorySeedTargets = {
      road: { brand: 'Specialized', model: 'Roubaix', tier: 1, minPrice: 1000, category: 'road' },
      gravel: { brand: 'Specialized', model: 'Diverge', tier: 1, minPrice: 1000, category: 'gravel' },
      emtb: { brand: 'Specialized', model: 'Levo', tier: 1, minPrice: 1200, category: 'emtb' },
      kids: { brand: 'Woom', model: 'Woom', tier: 2, minPrice: 250, maxPrice: 1800, category: 'kids' }
    };
  }

  async run() {
    console.log('\n' + '═'.repeat(60));
    console.log('⏰ HOURLY HUNTER - Auto Run');
    console.log('═'.repeat(60));
    console.log(`Time: ${new Date().toLocaleString('de-DE')}\n`);

    try {
      // PHASE 0: Hot deals are always refreshed.
      console.log('🔥 PHASE 0: HOT DEAL HUNT (Sprint 1)');
      try {
        const hotStats = await HotDealHunter.hunt(5);
        console.log(`✅ Hot Deals: Found ${hotStats.found}, Added ${hotStats.added}\n`);
      } catch (e) {
        console.error('❌ Hot Deal Hunt failed:', e.message);
      }

      const health = await this.checkHealth();

      console.log('📊 Catalog Health:\n');
      console.log(`  Active bikes:     ${health.active}`);
      console.log(`  Target:           ${this.config.targetCatalogSize}`);
      console.log(`  Needed:           ${Math.max(0, this.config.targetCatalogSize - health.active)}`);
      console.log(`  Avg margin:       ${health.avgMargin.toFixed(1)}%\n`);

      // PHASE 6: AI hotness prediction.
      console.log('🤖 PHASE 6: AI Hotness Prediction');
      let aiStats = {};
      try {
        aiStats = await HotnessPredictor.predictCatalog();
        const touched = Number(aiStats.hot || 0) + Number(aiStats.warm || 0);
        console.log(`✅ AI: Updated ${touched} hot bikes\n`);
      } catch (e) {
        console.error('❌ AI Prediction failed:', e.message);
        aiStats = { error: e.message };
      }

      // PHASE 7: priority refresh.
      console.log('🎯 PHASE 7: Priority Adjustment');
      try {
        await SmartPriorityManager.adjustHunterPriorities();
        await SmartPriorityManager.prioritizeRefillQueue();
        console.log('✅ Priorities adjusted\n');
      } catch (e) {
        console.error('❌ Priority adjustment failed:', e.message);
      }

      let bikesToAdd = 0;
      if (health.active < this.config.minCatalogSize) {
        bikesToAdd = this.config.urgentBatch;
        console.log('🚨 URGENT: Catalog critically low!\n');
      } else if (health.active < this.config.targetCatalogSize) {
        bikesToAdd = this.config.normalBatch;
        console.log('✅ NORMAL: Regular refill\n');
      } else {
        console.log('✅ HEALTHY: No action needed\n');
        return;
      }

      bikesToAdd = Math.max(0, Math.min(bikesToAdd, this.config.maxBikesPerHour));
      const hunterMode = health.active < this.config.minCatalogSize ? 'full' : 'smart';
      const maxTargets = health.active < this.config.minCatalogSize ? 20 : 12;

      const missingCoreCategories = ['road', 'gravel', 'emtb', 'kids']
        .filter((cat) => Number(health.coverage?.[cat] || 0) === 0);

      if (missingCoreCategories.length > 0 && bikesToAdd > 0) {
        const seedTargets = missingCoreCategories
          .map((cat) => this.categorySeedTargets[cat])
          .filter(Boolean);

        if (seedTargets.length > 0) {
          const seedLimit = Math.min(seedTargets.length, bikesToAdd);
          console.log(`🧩 Coverage refill: missing categories = ${missingCoreCategories.join(', ')}`);
          console.log(`🚀 Seed hunt for ${seedLimit} bikes to restore category coverage...\n`);

          try {
            await UnifiedHunter.run({
              mode: 'smart',
              limit: seedLimit,
              targets: seedTargets,
              sources: ['both'],
              fillGaps: true
            });
            bikesToAdd = Math.max(0, bikesToAdd - seedLimit);
          } catch (seedError) {
            console.error('❌ Seed category refill failed:', seedError.message);
          }
        }
      }

      console.log(`🚀 Starting hunt for ${bikesToAdd} bikes (${hunterMode}, targets=${maxTargets})...\n`);

      const startTime = Date.now();

      if (bikesToAdd > 0) {
        await UnifiedHunter.run({
          limit: bikesToAdd,
          mode: hunterMode,
          maxTargets,
          sources: ['both'],
          fillGaps: true
        });
      }

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

      const newHealth = await this.checkHealth();
      const added = newHealth.active - health.active;

      console.log('\n' + '═'.repeat(60));
      console.log('📊 RESULTS:\n');
      console.log(`  Duration:         ${duration} minutes`);
      console.log(`  Bikes added:      ${added}`);
      console.log(`  Active now:       ${newHealth.active}`);
      console.log(`  Success rate:     ${(added / Math.max(1, bikesToAdd) * 100).toFixed(0)}%\n`);

      await this.logRun({
        bikesToAdd,
        bikesAdded: added,
        duration,
        healthBefore: health,
        healthAfter: newHealth,
        hunterMode,
        maxTargets,
        aiStats
      });

      console.log('✅ Hourly run complete\n');
    } catch (error) {
      console.error('❌ Error in hourly run:', error);
      await this.logError(error);
    }
  }

  async checkHealth() {
    const db = this.dbManager.getDatabase();

    const tableInfo = db.prepare('PRAGMA table_info(bikes)').all();
    const hasFmv = tableInfo.some((col) => col.name === 'fmv');

    const normalizeCategory = (value) => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return '';
      if (['mtb', 'mountain', 'mountainbike', 'mountainbikes', 'горный', 'горные велосипеды'].includes(raw)) return 'mtb';
      if (['road', 'шоссе', 'шоссейный'].includes(raw)) return 'road';
      if (['gravel', 'гревел', 'грэвел', 'гравийный'].includes(raw)) return 'gravel';
      if (['emtb', 'e-mountainbike', 'ebike', 'электро', 'электровелосипеды', 'электро-горный велосипед'].includes(raw)) return 'emtb';
      if (['kids', 'детские', 'детский'].includes(raw)) return 'kids';
      return raw;
    };

    const coverageRows = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM bikes
      WHERE is_active = 1
      GROUP BY category
    `).all();

    const coverage = { mtb: 0, road: 0, gravel: 0, emtb: 0, kids: 0 };
    for (const row of coverageRows) {
      const normalized = normalizeCategory(row.category);
      if (Object.prototype.hasOwnProperty.call(coverage, normalized)) {
        coverage[normalized] += Number(row.count || 0);
      }
    }

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
        avgMargin: stats.avgMargin || 0,
        coverage
      };
    }

    const stats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
        FROM bikes
      `).get();

    return {
      total: stats.total || 0,
      active: stats.active || 0,
      avgMargin: 0,
      coverage
    };
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

if (require.main === module) {
  const hourlyHunter = new HourlyHunter();
  hourlyHunter.run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = HourlyHunter;
