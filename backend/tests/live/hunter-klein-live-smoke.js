const fs = require('fs');
const path = require('path');

function repoPath(p) {
  return path.resolve(__dirname, '..', '..', '..', p);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDb() {
  const src = repoPath('backend/database/eubike.db');
  const outDir = repoPath('backend/test-results');
  ensureDir(outDir);
  const dst = path.join(outDir, `hunter-klein-live-smoke-${Date.now()}.db`);
  fs.copyFileSync(src, dst);
  return dst;
}

async function main() {
  require('dotenv').config({ path: repoPath('backend/.env') });
  require('dotenv').config({ path: repoPath('telegram-bot/.env') });

  const dst = copyDb();
  process.env.DB_PATH = dst;

  const UnifiedHunter = require('../../scripts/unified-hunter');
  console.log(`[klein-live-smoke] Using DB copy: ${dst}`);

  console.log('[klein-live-smoke] Running UnifiedHunter.run({limit: 1, mode: "smart", sources:["kleinanzeigen"]})...');
  const res = await UnifiedHunter.run({ limit: 1, mode: 'smart', sources: ['kleinanzeigen'] });
  console.log('[klein-live-smoke] UnifiedHunter returned summary keys:', Object.keys(res?.summary || {}));

  const Database = require('better-sqlite3');
  const db = new Database(dst);
  const recent = db.prepare(`
    SELECT id, name, brand, model, category, discipline, sub_category, wheel_size, shipping_option, source_platform
    FROM bikes
    ORDER BY id DESC
    LIMIT 5
  `).all();
  console.log('[klein-live-smoke] Recent bikes (5):', recent.map(r => ({
    id: r.id,
    source_platform: r.source_platform,
    brand: r.brand,
    model: r.model,
    category: r.category,
    discipline: r.discipline,
    sub_category: r.sub_category,
    wheel_size: r.wheel_size,
    shipping_option: r.shipping_option,
  })));
  db.close();

  console.log('[klein-live-smoke] OK');
}

main().catch((err) => {
  console.error('[klein-live-smoke] FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});