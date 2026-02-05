/**
 * Recompute FMV (Fair Market Value) for bikes using FMVAnalyzer.
 *
 * Usage:
 *   node backend/scripts/fill-fmv-all.js            # only bikes with NULL/0 fmv
 *   node backend/scripts/fill-fmv-all.js --force    # all active bikes
 */

const path = require('path');
const Database = require('better-sqlite3');
const FMVAnalyzer = require('../src/services/FMVAnalyzer');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

const adapter = {
  query: async (sql, params = []) => db.prepare(sql).all(...params)
};

const analyzer = new FMVAnalyzer(adapter);

const forceAll = process.argv.includes('--force') || process.argv.includes('--all');
const recentDays = Number(process.env.FMV_RECENT_DAYS || 365);

console.log('='.repeat(60));
console.log('FMV Recompute (FMVAnalyzer)');
console.log('='.repeat(60));
console.log(`Database: ${dbPath}`);
console.log(`Mode: ${forceAll ? 'force all active bikes' : 'only missing fmv'}`);

const bikes = db.prepare(`
  SELECT id, brand, model, year, price, frame_material, frame_size, fmv
  FROM bikes
  WHERE is_active = 1
  ${forceAll ? '' : 'AND (fmv IS NULL OR fmv = 0)'}
`).all();

console.log(`\nFound ${bikes.length} bikes to process\n`);

const updateStmt = db.prepare(`
  UPDATE bikes
  SET fmv = ?, fmv_confidence = ?, market_comparison = ?, profit_margin = ?
  WHERE id = ?
`);

(async () => {
  let updated = 0;
  let skipped = 0;

  for (const bike of bikes) {
    const { id, brand, model, year, price, frame_material, frame_size } = bike;
    if (!brand || !model || !year) {
      skipped += 1;
      continue;
    }

    try {
      const fmvData = await analyzer.getFairMarketValue(brand, model, year, {
        frameSize: frame_size,
        frameMaterial: frame_material,
        listingPrice: price,
        recentDays
      });

      if (!fmvData || !fmvData.fmv) {
        skipped += 1;
        continue;
      }

      const comparison = analyzer.getMarketComparison(price, fmvData.fmv);
      const margin = price && fmvData.fmv ? Math.round(((fmvData.fmv - price) / fmvData.fmv) * 1000) / 10 : null;
      updateStmt.run(fmvData.fmv, fmvData.confidence, comparison, margin, id);
      updated += 1;
    } catch (e) {
      skipped += 1;
      console.warn(`FMV failed for bike ${id}: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log('='.repeat(60));

  db.close();
})();
