const fs = require('fs');
const path = require('path');

function resolveRepoPath(p) {
  return path.resolve(__dirname, '..', '..', '..', p);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDbForTest() {
  const src = resolveRepoPath('backend/database/eubike.db');
  const outDir = resolveRepoPath('backend/test-results');
  ensureDir(outDir);
  const dst = path.join(outDir, `hunter-live-smoke-${Date.now()}.db`);
  fs.copyFileSync(src, dst);
  return { src, dst };
}

async function main() {
  // Load env for GEMINI_API_KEY (gitignored; never print keys).
  require('dotenv').config({ path: resolveRepoPath('backend/.env') });
  require('dotenv').config({ path: resolveRepoPath('telegram-bot/.env') });

  const { dst } = copyDbForTest();
  process.env.DB_PATH = dst;

  const HotDealHunter = require('../../src/services/HotDealHunter');
  const UnifiedHunter = require('../../scripts/unified-hunter');

  console.log(`[live-smoke] Using DB copy: ${dst}`);

  // Scenario A: Buycycle hot deals (Puppeteer + Gemini normalization)
  console.log('[live-smoke] Running HotDealHunter.hunt(1)...');
  const hotStats = await HotDealHunter.hunt(1);
  console.log('[live-smoke] HotDealHunter stats:', hotStats);

  // Scenario B: Regular refill (smart mode)
  console.log('[live-smoke] Running UnifiedHunter.run({limit: 1, mode: "smart"})...');
  await UnifiedHunter.run({ limit: 1, mode: 'smart' });
  console.log('[live-smoke] UnifiedHunter run complete');

  // Basic DB assertions
  const Database = require('better-sqlite3');
  const db = new Database(dst);

  const summary = db.prepare(`
    SELECT
      SUM(CASE WHEN source_platform = 'buycycle' THEN 1 ELSE 0 END) AS buycycle,
      SUM(CASE WHEN source_platform = 'kleinanzeigen' THEN 1 ELSE 0 END) AS kleinanzeigen,
      COUNT(*) AS total
    FROM bikes
  `).get();

  const taxonomy = db.prepare(`
    SELECT category, discipline, sub_category, COUNT(*) AS c
    FROM bikes
    WHERE is_active = 1
    GROUP BY category, discipline, sub_category
    ORDER BY c DESC
    LIMIT 12
  `).all();

  const buycycleRecent = db.prepare(`
    SELECT id, name, brand, model, category, discipline, sub_category, wheel_size, shipping_option, source_url, updated_at
    FROM bikes
    WHERE source_platform = 'buycycle'
    ORDER BY id DESC
    LIMIT 5
  `).all();

  console.log('[live-smoke] DB summary:', summary);
  console.log('[live-smoke] Taxonomy sample (top 12):', taxonomy);
  console.log('[live-smoke] Recent buycycle (5):', buycycleRecent.map(r => ({
    id: r.id,
    brand: r.brand,
    model: r.model,
    category: r.category,
    discipline: r.discipline,
    sub_category: r.sub_category,
    wheel_size: r.wheel_size,
    shipping_option: r.shipping_option,
  })));

  db.close();
  console.log('[live-smoke] OK');
}

main().catch((err) => {
  console.error('[live-smoke] FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});