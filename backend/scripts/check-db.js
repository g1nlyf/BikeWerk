// Simple SQLite DB check for EUBike
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

(async () => {
  try {
    const dbPath = (() => {
      const preferred = path.resolve(__dirname, '../database/eubike.db');
      const legacy = path.resolve(__dirname, '../Databases/eubike.db');
      return require('fs').existsSync(preferred) ? preferred : legacy;
    })();
    const db = await open({ filename: dbPath, driver: sqlite3.Database });

    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const bikesCount = await db.get('SELECT COUNT(*) as cnt FROM bikes');
    const bikesSample = await db.all(`
      SELECT id, name, brand, model, price, original_price, discount, category, main_image, is_new, condition_status, description
      FROM bikes
      ORDER BY id
      LIMIT 20
    `);
    const topByAddedAt = await db.all(`
      SELECT id, name, brand, price, added_at
      FROM bikes
      ORDER BY added_at DESC
      LIMIT 12
    `);
    const placeholders = await db.all(`
      SELECT id, name, brand, price, category, added_at
      FROM bikes
      WHERE brand = 'unknown' OR name LIKE 'Bike %' OR price = 0
      ORDER BY id
      LIMIT 20
    `);
    const imagesCount = await db.get('SELECT COUNT(*) as cnt FROM bike_images');
    const sampleImages = await db.all(`
      SELECT bike_id, image_url, image_order, is_main
      FROM bike_images
      ORDER BY bike_id, image_order
      LIMIT 20
    `);
    const specsCount = await db.get('SELECT COUNT(*) as cnt FROM bike_specs');
    const sampleSpecs = await db.all(`
      SELECT bike_id, spec_label, spec_value
      FROM bike_specs
      ORDER BY bike_id
      LIMIT 20
    `);

    console.log('DB Path:', dbPath);
    console.log('Tables:', tables.map(t => t.name));
    console.log('Counts:', { bikes: bikesCount.cnt, images: imagesCount.cnt, specs: specsCount.cnt });
    console.log('Bikes sample:', bikesSample);
    console.log('Top by added_at DESC (limit 12):', topByAddedAt);
    console.log('Suspected placeholder rows (unknown/Bike %/price=0):', placeholders);
    console.log('Images sample:', sampleImages);
    console.log('Specs sample:', sampleSpecs);

    await db.close();
  } catch (err) {
    console.error('DB check error:', err);
    process.exit(1);
  }
})();
