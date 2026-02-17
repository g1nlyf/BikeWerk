/*
  Read-only helper for inspecting how bikes are stored in SQLite.
  Safe to run locally: `node tools/inspect-catalog-db.js`
*/

const Database = require('better-sqlite3');

const db = new Database('database/eubike.db', { readonly: true });

function qAll(sql, params = []) {
  return db.prepare(sql).all(params);
}

function qGet(sql, params = []) {
  return db.prepare(sql).get(params);
}

function print(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
}

print('Bikes is_active counts', qAll('SELECT is_active, COUNT(1) c FROM bikes GROUP BY is_active ORDER BY is_active DESC'));
print('Bikes by category', qAll('SELECT category, COUNT(1) c FROM bikes GROUP BY category ORDER BY c DESC'));
print('Active bikes missing core fields', qGet(
  "SELECT COUNT(1) total, " +
    "SUM(CASE WHEN year IS NULL OR year=0 THEN 1 ELSE 0 END) missing_year, " +
    "SUM(CASE WHEN size IS NULL OR TRIM(size)='' THEN 1 ELSE 0 END) missing_size, " +
    "SUM(CASE WHEN wheel_diameter IS NULL OR TRIM(wheel_diameter)='' THEN 1 ELSE 0 END) missing_wheel, " +
    "SUM(CASE WHEN (size IS NULL OR TRIM(size)='') AND (frame_size IS NULL OR TRIM(frame_size)='') THEN 1 ELSE 0 END) missing_any_size, " +
    "SUM(CASE WHEN (wheel_diameter IS NULL OR TRIM(wheel_diameter)='') AND (wheel_size IS NULL OR TRIM(wheel_size)='') THEN 1 ELSE 0 END) missing_any_wheel, " +
    "SUM(CASE WHEN frame_material IS NULL OR TRIM(frame_material)='' THEN 1 ELSE 0 END) missing_frame_material, " +
    "SUM(CASE WHEN brakes_type IS NULL OR TRIM(brakes_type)='' THEN 1 ELSE 0 END) missing_brakes_type, " +
    "SUM(CASE WHEN seller_type IS NULL OR TRIM(seller_type)='' THEN 1 ELSE 0 END) missing_seller_type, " +
    "SUM(CASE WHEN shipping_option IS NULL OR TRIM(shipping_option)='' THEN 1 ELSE 0 END) missing_shipping_option " +
    "FROM bikes WHERE is_active=1"
));

print('Active bikes: sub_category top', qAll(
  "SELECT sub_category, COUNT(1) c FROM bikes WHERE is_active=1 AND sub_category IS NOT NULL AND TRIM(sub_category)!='' GROUP BY sub_category ORDER BY c DESC LIMIT 25"
));

print('Active bikes: discipline top', qAll(
  "SELECT discipline, COUNT(1) c FROM bikes WHERE is_active=1 AND discipline IS NOT NULL AND TRIM(discipline)!='' GROUP BY discipline ORDER BY c DESC LIMIT 25"
));

print('Active bikes: brands top', qAll(
  "SELECT brand, COUNT(1) c FROM bikes WHERE is_active=1 AND brand IS NOT NULL AND TRIM(brand)!='' GROUP BY brand ORDER BY c DESC LIMIT 30"
));

print('Active bikes: sizes top', qAll(
  "SELECT size, COUNT(1) c FROM bikes WHERE is_active=1 AND size IS NOT NULL AND TRIM(size)!='' GROUP BY size ORDER BY c DESC LIMIT 30"
));

print('Active bikes: wheel_diameter top', qAll(
  "SELECT wheel_diameter, COUNT(1) c FROM bikes WHERE is_active=1 AND wheel_diameter IS NOT NULL AND TRIM(wheel_diameter)!='' GROUP BY wheel_diameter ORDER BY c DESC LIMIT 30"
));

print('Active bikes: frame_material top', qAll(
  "SELECT frame_material, COUNT(1) c FROM bikes WHERE is_active=1 AND frame_material IS NOT NULL AND TRIM(frame_material)!='' GROUP BY frame_material ORDER BY c DESC LIMIT 30"
));

print('Active bikes: brakes_type top', qAll(
  "SELECT brakes_type, COUNT(1) c FROM bikes WHERE is_active=1 AND brakes_type IS NOT NULL AND TRIM(brakes_type)!='' GROUP BY brakes_type ORDER BY c DESC LIMIT 30"
));

print('Active bikes: seller_type top', qAll(
  "SELECT seller_type, COUNT(1) c FROM bikes WHERE is_active=1 AND seller_type IS NOT NULL AND TRIM(seller_type)!='' GROUP BY seller_type ORDER BY c DESC LIMIT 30"
));

print('Active bikes: shipping_option top', qAll(
  "SELECT shipping_option, COUNT(1) c FROM bikes WHERE is_active=1 AND shipping_option IS NOT NULL AND TRIM(shipping_option)!='' GROUP BY shipping_option ORDER BY c DESC LIMIT 30"
));

print('Active bikes missing images', qGet(
  "SELECT COUNT(1) total, " +
    "SUM(CASE WHEN main_image IS NULL OR TRIM(main_image)='' THEN 1 ELSE 0 END) missing_main_image, " +
    "SUM(CASE WHEN images IS NULL OR TRIM(images)='' THEN 1 ELSE 0 END) missing_images, " +
    "SUM(CASE WHEN (main_image IS NULL OR TRIM(main_image)='') AND (images IS NULL OR TRIM(images)='') THEN 1 ELSE 0 END) missing_any " +
    "FROM bikes WHERE is_active=1"
));

try {
  print('bike_images stats', qGet(
    "SELECT COUNT(1) total, " +
      "SUM(CASE WHEN image_url IS NULL OR TRIM(image_url)='' THEN 1 ELSE 0 END) missing_url, " +
      "SUM(CASE WHEN local_path IS NULL OR TRIM(local_path)='' THEN 1 ELSE 0 END) missing_local_path " +
      "FROM bike_images"
  ));
} catch (e) {
  console.log('\\n=== bike_images stats ===');
  console.log('ERR', String(e && e.message || e));
}

print('Active bikes sample (latest 10)', qAll(
  "SELECT id, name, brand, category, sub_category, discipline, is_new, price, original_price, year, size, wheel_diameter, frame_material, brakes_type, seller_type, shipping_option, created_at " +
    "FROM bikes WHERE is_active=1 ORDER BY datetime(created_at) DESC LIMIT 10"
));

print('bike_specs: top labels', qAll(
  "SELECT spec_label, COUNT(1) c FROM bike_specs GROUP BY spec_label ORDER BY c DESC LIMIT 25"
));

console.log('\nOK');
