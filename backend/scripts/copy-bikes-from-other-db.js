// Copy bikes by IDs from backend/Databases/eubike.db to backend/database/eubike.db
// Usage: node scripts/copy-bikes-from-other-db.js 74 75
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();

async function copy(ids) {
  const srcPath = path.resolve(__dirname, '../Databases/eubike.db');
  const dstPath = path.resolve(__dirname, '../database/eubike.db');
  const src = await open({ filename: srcPath, driver: sqlite3.Database });
  const dst = await open({ filename: dstPath, driver: sqlite3.Database });
  try {
    await dst.exec('BEGIN');
    for (const id of ids) {
      const bike = await src.get('SELECT * FROM bikes WHERE id = ?', [id]);
      if (!bike) { console.warn(`Bike id=${id} not found in source DB`); continue; }
      // Insert bike into destination (ignore existing)
      const insertBikeSQL = `
        INSERT INTO bikes (
          id, name, category, brand, model, size, price, original_price, discount,
          main_image, rating, reviews, review_count, description, features,
          delivery_info, warranty, source, original_url, condition_status,
          year, wheel_diameter, location, is_negotiable, is_new, discipline,
          is_active, created_at, updated_at, added_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `;
      const params = [
        bike.id, bike.name, bike.category, bike.brand, bike.model, bike.size, bike.price,
        bike.original_price, bike.discount, bike.main_image, bike.rating, bike.reviews,
        bike.review_count, bike.description, bike.features, bike.delivery_info, bike.warranty,
        bike.source, bike.original_url, bike.condition_status, bike.year, bike.wheel_diameter,
        bike.location, bike.is_negotiable, bike.is_new, bike.discipline,
        1, bike.created_at, bike.updated_at, bike.added_at
      ];
      await dst.run(insertBikeSQL, params);

      const images = await src.all('SELECT image_url, image_order, is_main FROM bike_images WHERE bike_id = ? ORDER BY image_order', [id]);
      for (const img of images) {
        await dst.run(
          'INSERT INTO bike_images (bike_id, image_url, image_order, is_main) VALUES (?,?,?,?)',
          [id, img.image_url, img.image_order, img.is_main]
        );
      }

      const specs = await src.all('SELECT spec_label, spec_value, spec_order FROM bike_specs WHERE bike_id = ? ORDER BY spec_order', [id]);
      for (const s of specs) {
        await dst.run(
          'INSERT INTO bike_specs (bike_id, spec_label, spec_value, spec_order) VALUES (?,?,?,?)',
          [id, s.spec_label, s.spec_value, s.spec_order]
        );
      }
      console.log(`Copied bike id=${id} with ${images.length} images and ${specs.length} specs`);
    }
    await dst.exec('COMMIT');
  } catch (e) {
    await dst.exec('ROLLBACK');
    throw e;
  } finally {
    await src.close();
    await dst.close();
  }
}

const ids = process.argv.slice(2).map(s => parseInt(s, 10)).filter(Boolean);
if (ids.length === 0) {
  console.error('Provide at least one bike id to copy');
  process.exit(1);
}
copy(ids)
  .then(() => console.log('✅ Copy completed'))
  .catch(err => { console.error('❌ Copy failed:', err.message); process.exit(1); });