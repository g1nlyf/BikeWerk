const Database = require('better-sqlite3');

const db = new Database('backend/database/eubike.db');

const bike =
  db.prepare('SELECT id, brand, model, unified_data FROM bikes WHERE unified_data IS NOT NULL LIMIT 1').get() ||
  db.prepare('SELECT id, brand, model, unified_data FROM bikes LIMIT 1').get();

console.log('🔍 UNIFIED SCHEMA VALIDATION');

if (!bike) {
  console.log('❌ База пуста');
  process.exit(1);
}

console.log(`Тестируем байк #${bike.id}: ${bike.brand || ''} ${bike.model || ''}`.trim());

if (!bike.unified_data) {
  console.log('❌ unified_data отсутствует');
  process.exit(1);
}

console.log('✅ unified_data присутствует');

let unified;
try {
  unified = JSON.parse(bike.unified_data);
  console.log('✅ Валидный JSON');
} catch (e) {
  console.log('❌ Ошибка парсинга JSON');
  process.exit(1);
}

const sections = [
  'meta',
  'basic_info',
  'pricing',
  'specs',
  'condition',
  'inspection',
  'seller',
  'logistics',
  'media',
  'ranking',
  'audit',
  'features',
  'quality_score'
];

console.log('✅ Секции:');
sections.forEach((key) => {
  if (key === 'quality_score') {
    const ok = unified.quality_score !== undefined && unified.quality_score !== null;
    console.log(`${ok ? '✅' : '❌'} ${key}`);
  } else {
    const ok = unified[key] !== undefined && unified[key] !== null;
    console.log(`${ok ? '✅' : '❌'} ${key}`);
  }
});

const requiredChecks = [
  {
    label: "meta.source_platform",
    ok: !!unified.meta?.source_platform,
    value: unified.meta?.source_platform
  },
  {
    label: "basic_info.brand",
    ok: !!unified.basic_info?.brand,
    value: unified.basic_info?.brand
  },
  {
    label: "basic_info.category",
    ok: !!unified.basic_info?.category,
    value: unified.basic_info?.category
  },
  {
    label: "pricing.price",
    ok: typeof unified.pricing?.price === 'number' && unified.pricing.price > 0,
    value: unified.pricing?.price
  }
];

console.log('✅ Обязательные поля:');
requiredChecks.forEach((check) => {
  const status = check.ok ? '✅' : '❌';
  console.log(`${status} ${check.label} = ${check.value ?? 'null'}`);
});

const failed = requiredChecks.filter((c) => !c.ok);
if (failed.length > 0) {
  console.log('❌ ПРОВЕРКА НЕ ПРОЙДЕНА');
  process.exit(1);
}

console.log('✅ ПРОВЕРКА ПРОЙДЕНА');
