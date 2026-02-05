/**
 * Backfill bike_images table from bikes.gallery / bikes.main_image
 * Also normalize category values in bikes table.
 */
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('════════════════════════════════════════════════════════════');
console.log('🧩 Backfill bike_images + normalize categories');
console.log('════════════════════════════════════════════════════════════');

const normalizeCategory = (value) => {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes('mountain') || v.includes('mtb')) return 'mtb';
  if (v.includes('road') || v.includes('rennrad')) return 'road';
  if (v.includes('gravel')) return 'gravel';
  if (v.includes('e-bike') || v.includes('ebike') || v.includes('pedelec') || v.includes('emtb')) return 'emtb';
  if (v.includes('kid') || v.includes('child') || v.includes('kinder') || v.includes('youth')) return 'kids';
  return 'other';
};

const parseGallery = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const str = String(raw).trim();
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    if (str.includes('http')) {
      return str.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }
};

const bikes = db.prepare(`
  SELECT id, category, main_image, gallery
  FROM bikes
  WHERE is_active = 1
`).all();

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO bike_images (
    bike_id, image_url, local_path, position, is_main, image_order, is_downloaded, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

const updateMainStmt = db.prepare(`
  UPDATE bikes 
  SET main_image = ? 
  WHERE id = ? AND (main_image IS NULL OR main_image = '')
`);

const updateCategoryStmt = db.prepare(`
  UPDATE bikes
  SET category = ?
  WHERE id = ?
`);

let inserted = 0;
let touched = 0;
let categoriesUpdated = 0;

for (const bike of bikes) {
  const normalized = normalizeCategory(bike.category);
  if (normalized && normalized !== bike.category) {
    updateCategoryStmt.run(normalized, bike.id);
    categoriesUpdated++;
  }

  const gallery = parseGallery(bike.gallery);
  const main = bike.main_image || gallery[0] || null;
  const urls = Array.from(new Set([...(main ? [main] : []), ...gallery].filter(Boolean)));
  if (urls.length === 0) continue;

  urls.forEach((url, index) => {
    const isMain = main ? (url === main ? 1 : 0) : (index === 0 ? 1 : 0);
    const res = insertStmt.run(bike.id, url, url, index, isMain, index, 0);
    inserted += res.changes || 0;
  });

  if (main) {
    updateMainStmt.run(main, bike.id);
  }

  touched++;
}

console.log(`✅ Bikes scanned: ${bikes.length}`);
console.log(`✅ Bikes touched (images): ${touched}`);
console.log(`✅ Image rows inserted: ${inserted}`);
console.log(`✅ Categories normalized: ${categoriesUpdated}`);
console.log('Done.');
