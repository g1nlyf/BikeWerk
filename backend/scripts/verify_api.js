const { DatabaseManager } = require('../src/js/mysql-config');

const requiredBikeColumns = [
  'id',
  'name',
  'brand',
  'model',
  'year',
  'category',
  'price',
  'original_price',
  'discount',
  'currency',
  'condition_score',
  'condition_grade',
  'condition_status',
  'quality_score',
  'ranking_score',
  'hotness_score',
  'main_image',
  'source_url',
  'source_platform',
  'source_ad_id',
  'is_active',
  'created_at',
  'updated_at',
  'unified_data',
  'specs_json',
  'inspection_json',
  'seller_json',
  'logistics_json',
  'features_json'
];

const requiredImageColumns = [
  'id',
  'bike_id',
  'image_url',
  'local_path',
  'image_type',
  'position',
  'is_main',
  'image_order',
  'is_downloaded',
  'width',
  'height',
  'created_at'
];

async function getColumns(db, table) {
  const rows = await db.query(`PRAGMA table_info(${table})`);
  return rows.map(r => r.name);
}

async function main() {
  const db = new DatabaseManager();
  await db.initialize();
  const bikeCols = await getColumns(db, 'bikes');
  const imageCols = await getColumns(db, 'bike_images');

  const missingBikes = requiredBikeColumns.filter(c => !bikeCols.includes(c));
  const missingImages = requiredImageColumns.filter(c => !imageCols.includes(c));

  if (missingBikes.length || missingImages.length) {
    if (missingBikes.length) {
      console.error(`Missing bikes columns: ${missingBikes.join(', ')}`);
    }
    if (missingImages.length) {
      console.error(`Missing bike_images columns: ${missingImages.join(', ')}`);
    }
    process.exit(1);
  }

  console.log('Unified schema verified');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

