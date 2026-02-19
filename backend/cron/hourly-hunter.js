const UnifiedHunter = require('../scripts/unified-hunter');
const DatabaseManager = require('../database/db-manager');
const HotnessPredictor = require('../ai/hotness-predictor');
const SmartPriorityManager = require('../services/smart-priority-manager');
const HotDealHunter = require('../src/services/HotDealHunter');
const HunterOpsNotifier = require('../src/services/HunterOpsNotifier');

class HourlyHunter {
  constructor() {
    this.dbManager = new DatabaseManager();
    this.hunter = new UnifiedHunter();
    this.notifier = new HunterOpsNotifier();

    this.config = {
      targetCatalogSize: 500,
      minCatalogSize: 100,
      normalBatch: 30,
      urgentBatch: 60,
      maxBikesPerHour: 60,
      cleanupOrphanImages: true,
      staleCleanupEnabled: String(process.env.ENABLE_HUNTER_STALE_CLEANUP || '0') === '1',
      staleDays: Math.max(7, Number(process.env.HUNTER_STALE_DAYS || 45) || 45),
      staleBatch: Math.max(1, Number(process.env.HUNTER_STALE_BATCH || 200) || 200)
    };

    this.coreCategoryTargets = {
      road: 40,
      gravel: 30,
      emtb: 30,
      kids: 25
    };

    this.categorySeedTargets = {
      road: { brand: 'Specialized', model: 'Roubaix', tier: 1, minPrice: 1000, category: 'road' },
      gravel: { brand: 'Specialized', model: 'Diverge', tier: 1, minPrice: 1000, category: 'gravel' },
      emtb: { brand: 'Specialized', model: 'Levo', tier: 1, minPrice: 1200, category: 'emtb' },
      kids: { brand: 'Woom', model: 'Woom', tier: 2, minPrice: 250, maxPrice: 1800, category: 'kids' }
    };
  }

  normalizeCategory(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    if (['mtb', 'mountain', 'mountainbike', 'mountainbikes', 'горный', 'горные велосипеды'].includes(raw)) return 'mtb';
    if (['road', 'шоссе', 'шоссейный'].includes(raw)) return 'road';
    if (['gravel', 'гревел', 'грэвел', 'гравийный'].includes(raw)) return 'gravel';
    if (['emtb', 'e-mountainbike', 'ebike', 'электро', 'электровелосипеды', 'электро-горный велосипед'].includes(raw)) return 'emtb';
    if (['kids', 'детские', 'детский'].includes(raw)) return 'kids';
    return raw;
  }

  calculateCoverageDeficits(coverage = {}) {
    const deficits = [];
    for (const [category, target] of Object.entries(this.coreCategoryTargets)) {
      const present = Number(coverage?.[category] || 0);
      const count = Math.max(0, Number(target || 0) - present);
      if (count > 0) deficits.push({ category, count, target, present });
    }
    return deficits.sort((a, b) => b.count - a.count);
  }

  getNextScheduledRunAt(base = new Date()) {
    const next = new Date(base);
    next.setSeconds(0, 0);
    next.setMinutes(5);
    if (base.getMinutes() >= 5) {
      next.setHours(next.getHours() + 1);
    }
    return next;
  }

  async run(context = {}) {
    const triggerReason = context.triggerReason || context.reason || 'cron_hourly';
    const runStartedAt = new Date();

    let startHealth = { total: 0, active: 0, avgMargin: 0, coverage: { mtb: 0, road: 0, gravel: 0, emtb: 0, kids: 0 } };
    try {
      startHealth = await this.checkHealth();
    } catch (_) {}

    const startCoverageDeficits = this.calculateCoverageDeficits(startHealth.coverage || {});
    const startCatalogDeficit = Math.max(0, this.config.targetCatalogSize - Number(startHealth.active || 0));

    console.log('\n' + '='.repeat(60));
    console.log('[HOURLY HUNTER] Auto run started');
    console.log('='.repeat(60));
    console.log(`Time: ${new Date().toLocaleString('de-DE')}`);
    console.log(`Trigger: ${triggerReason}\n`);

    await this.logStart({
      reason: triggerReason,
      startedAt: runStartedAt.toISOString(),
      healthAtStart: startHealth,
      catalogDeficit: startCatalogDeficit,
      coverageDeficits: startCoverageDeficits,
      config: {
        targetCatalogSize: this.config.targetCatalogSize,
        minCatalogSize: this.config.minCatalogSize,
        normalBatch: this.config.normalBatch,
        urgentBatch: this.config.urgentBatch
      }
    });

    await this.notifier.notifyRunStart({
      reason: triggerReason,
      startedAt: runStartedAt.toISOString(),
      active: startHealth.active,
      targetCatalogSize: this.config.targetCatalogSize,
      minCatalogSize: this.config.minCatalogSize,
      catalogDeficit: startCatalogDeficit,
      coverageDeficits: startCoverageDeficits
    });

    try {
      let hotStats = { found: 0, processed: 0, added: 0, duplicates: 0, errors: 0 };
      console.log('[PHASE 0] Hot deal hunt');
      try {
        hotStats = await HotDealHunter.hunt(5);
        console.log(`[PHASE 0] done, found=${hotStats.found}, added=${hotStats.added}`);
      } catch (e) {
        console.error(`[PHASE 0] failed: ${e.message}`);
      }

      let cleanupStats = { orphanImagesRemoved: 0, staleDeactivated: 0 };
      console.log('[PHASE 0.5] Catalog cleanup');
      try {
        cleanupStats = await this.cleanupCatalog();
        console.log(`[PHASE 0.5] done, orphan=${cleanupStats.orphanImagesRemoved}, stale=${cleanupStats.staleDeactivated}`);
      } catch (e) {
        console.error(`[PHASE 0.5] failed: ${e.message}`);
      }

      const health = await this.checkHealth();

      console.log('[CATALOG HEALTH]');
      console.log(`  Active bikes: ${health.active}`);
      console.log(`  Target: ${this.config.targetCatalogSize}`);
      console.log(`  Needed: ${Math.max(0, this.config.targetCatalogSize - health.active)}`);
      console.log(`  Avg margin: ${health.avgMargin.toFixed(1)}%\n`);

      let aiStats = {};
      console.log('[PHASE 6] AI hotness prediction');
      try {
        aiStats = await HotnessPredictor.predictCatalog();
        const touched = Number(aiStats.hot || 0) + Number(aiStats.warm || 0);
        console.log(`[PHASE 6] done, touched=${touched}`);
      } catch (e) {
        console.error(`[PHASE 6] failed: ${e.message}`);
        aiStats = { error: e.message };
      }

      console.log('[PHASE 7] Priority adjustment');
      try {
        await SmartPriorityManager.adjustHunterPriorities();
        await SmartPriorityManager.prioritizeRefillQueue();
        console.log('[PHASE 7] done');
      } catch (e) {
        console.error(`[PHASE 7] failed: ${e.message}`);
      }

      let bikesToAdd = 0;
      if (health.active < this.config.minCatalogSize) {
        bikesToAdd = this.config.urgentBatch;
        console.log('[MODE] urgent refill');
      } else if (health.active < this.config.targetCatalogSize) {
        bikesToAdd = this.config.normalBatch;
        console.log('[MODE] normal refill');
      } else {
        const noRefillPayload = {
          status: 'healthy_no_refill',
          reason: triggerReason,
          startedAt: runStartedAt.toISOString(),
          completedAt: new Date().toISOString(),
          duration: '0.0',
          bikesToAdd: 0,
          bikesAdded: 0,
          healthBefore: startHealth,
          healthAfter: health,
          cleanupStats,
          hotDealStats: hotStats,
          aiStats,
          hunterMode: 'none',
          maxTargets: 0,
          targetCatalogSize: this.config.targetCatalogSize,
          minCatalogSize: this.config.minCatalogSize,
          catalogDeficitAfter: Math.max(0, this.config.targetCatalogSize - Number(health.active || 0)),
          coverageDeficitsAfter: this.calculateCoverageDeficits(health.coverage || {}),
          nextRunAt: this.getNextScheduledRunAt(runStartedAt).toISOString()
        };
        await this.logRun(noRefillPayload);
        await this.notifier.notifyRunResult(noRefillPayload);
        console.log('[MODE] catalog healthy, refill skipped');
        return { ok: true, ...noRefillPayload };
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
          console.log(`[SEED] missing categories: ${missingCoreCategories.join(', ')}, limit=${seedLimit}`);

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
            console.error(`[SEED] failed: ${seedError.message}`);
          }
        }
      }

      console.log(`[REFILL] starting for ${bikesToAdd} bikes (mode=${hunterMode}, targets=${maxTargets})`);
      const refillStartedAt = Date.now();

      if (bikesToAdd > 0) {
        await UnifiedHunter.run({
          limit: bikesToAdd,
          mode: hunterMode,
          maxTargets,
          sources: ['both'],
          fillGaps: true
        });
      }

      const duration = ((Date.now() - refillStartedAt) / 1000 / 60).toFixed(1);
      const newHealth = await this.checkHealth();
      const added = newHealth.active - health.active;

      console.log('\n' + '='.repeat(60));
      console.log('[RESULTS]');
      console.log(`  Duration: ${duration} min`);
      console.log(`  Bikes added: ${added}`);
      console.log(`  Active now: ${newHealth.active}`);
      console.log(`  Success rate: ${(added / Math.max(1, bikesToAdd) * 100).toFixed(0)}%`);

      const completionPayload = {
        status: 'completed',
        reason: triggerReason,
        startedAt: runStartedAt.toISOString(),
        completedAt: new Date().toISOString(),
        bikesToAdd,
        bikesAdded: added,
        duration,
        healthBefore: health,
        healthAfter: newHealth,
        hunterMode,
        maxTargets,
        aiStats,
        cleanupStats,
        hotDealStats: hotStats,
        targetCatalogSize: this.config.targetCatalogSize,
        minCatalogSize: this.config.minCatalogSize,
        catalogDeficitAfter: Math.max(0, this.config.targetCatalogSize - Number(newHealth.active || 0)),
        coverageDeficitsAfter: this.calculateCoverageDeficits(newHealth.coverage || {}),
        nextRunAt: this.getNextScheduledRunAt(runStartedAt).toISOString()
      };

      await this.logRun(completionPayload);
      await this.notifier.notifyRunResult(completionPayload);

      console.log('[HOURLY HUNTER] run complete\n');
      return { ok: true, ...completionPayload };
    } catch (error) {
      console.error('[HOURLY HUNTER] run error:', error);
      const payload = {
        status: 'error',
        reason: triggerReason,
        message: error.message,
        stack: error.stack,
        failedAt: new Date().toISOString(),
        active: Number(startHealth.active || 0),
        targetCatalogSize: this.config.targetCatalogSize
      };
      await this.logError(payload);
      await this.notifier.notifyRunError(payload);
      return { ok: false, ...payload };
    }
  }

  async checkHealth() {
    const db = this.dbManager.getDatabase();

    const tableInfo = db.prepare('PRAGMA table_info(bikes)').all();
    const hasFmv = tableInfo.some((col) => col.name === 'fmv');

    const coverageRows = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM bikes
      WHERE is_active = 1
      GROUP BY category
    `).all();

    const coverage = { mtb: 0, road: 0, gravel: 0, emtb: 0, kids: 0 };
    for (const row of coverageRows) {
      const normalized = this.normalizeCategory(row.category);
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

  async cleanupCatalog() {
    const db = this.dbManager.getDatabase();
    const stats = {
      orphanImagesRemoved: 0,
      staleDeactivated: 0
    };

    if (this.config.cleanupOrphanImages) {
      try {
        const orphanResult = db.prepare(`
          DELETE FROM bike_images
          WHERE bike_id NOT IN (SELECT id FROM bikes)
        `).run();
        stats.orphanImagesRemoved = Number(orphanResult?.changes || 0);
      } catch (e) {
        console.warn(`[HourlyHunter] Orphan image cleanup skipped: ${e.message}`);
      }
    }

    if (this.config.staleCleanupEnabled) {
      try {
        const days = Math.max(7, Number(this.config.staleDays || 45));
        const batch = Math.max(1, Number(this.config.staleBatch || 200));
        const cutoff = `-${days} days`;
        const staleResult = db.prepare(`
          UPDATE bikes
          SET
            is_active = 0,
            deactivated_at = COALESCE(deactivated_at, datetime('now')),
            deactivation_reason = COALESCE(NULLIF(deactivation_reason, ''), 'stale_timeout'),
            updated_at = datetime('now')
          WHERE id IN (
            SELECT id
            FROM bikes
            WHERE is_active = 1
              AND datetime(COALESCE(last_checked_at, updated_at, created_at)) < datetime('now', ?)
            ORDER BY datetime(COALESCE(last_checked_at, updated_at, created_at)) ASC
            LIMIT ?
          )
        `).run(cutoff, batch);
        stats.staleDeactivated = Number(staleResult?.changes || 0);
      } catch (e) {
        console.warn(`[HourlyHunter] Stale cleanup skipped: ${e.message}`);
      }
    }

    return stats;
  }

  async logRun(data) {
    const db = this.dbManager.getDatabase();

    db.prepare(`
      INSERT INTO hunter_events (type, details, created_at)
      VALUES (?, ?, datetime('now'))
    `).run('HOURLY_RUN_COMPLETE', JSON.stringify(data || {}));
  }

  async logStart(data) {
    const db = this.dbManager.getDatabase();

    db.prepare(`
      INSERT INTO hunter_events (type, details, created_at)
      VALUES (?, ?, datetime('now'))
    `).run('HOURLY_RUN_START', JSON.stringify(data || {}));
  }

  async logError(error) {
    const db = this.dbManager.getDatabase();
    const payload = error && typeof error === 'object'
      ? error
      : { message: String(error || 'unknown_error') };

    db.prepare(`
      INSERT INTO hunter_events (type, details, created_at)
      VALUES (?, ?, datetime('now'))
    `).run('HOURLY_RUN_ERROR', JSON.stringify({
      message: payload.message || 'unknown_error',
      reason: payload.reason || null,
      failedAt: payload.failedAt || new Date().toISOString(),
      active: payload.active || null,
      targetCatalogSize: payload.targetCatalogSize || null,
      stack: payload.stack || null
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
