const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * МИГРАЦИЯ БД: Добавление полей из парсера
 * Добавляет ТОЛЬКО то, что реально дает парсер
 */

const dbPath = path.join(__dirname, '../database/eubike.db');
const backupPath = path.join(__dirname, '../database/eubike.backup.' + Date.now() + '.db');

console.log('='.repeat(80));
console.log('DATABASE MIGRATION: ADD PARSER FIELDS');
console.log('='.repeat(80));
console.log(`\nDatabase: ${dbPath}`);
console.log(`Backup: ${backupPath}\n`);

// Создаем резервную копию
console.log('📦 Creating backup...');
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log('   ✅ Backup created\n');
} catch (error) {
  console.error('   ❌ Backup failed:', error.message);
  process.exit(1);
}

// Подключаемся к БД
const db = new Database(dbPath);

console.log('🔧 Starting migration...\n');

/**
 * Безопасное добавление столбца
 */
function addColumnSafe(tableName, columnName, columnType, defaultValue = null) {
  try {
    // Проверяем существует ли столбец
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some(col => col.name === columnName);
    
    if (exists) {
      console.log(`   ⏭️  ${columnName.padEnd(30)} - already exists`);
      return false;
    }
    
    // Добавляем
    const defaultClause = defaultValue !== null ? ` DEFAULT ${defaultValue}` : '';
    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}${defaultClause}`;
    db.prepare(sql).run();
    
    console.log(`   ✅ ${columnName.padEnd(30)} - added (${columnType})`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ ${columnName.padEnd(30)} - ERROR: ${error.message}`);
    return false;
  }
}

let added = 0;
let skipped = 0;

// ============================================
// ДОБАВЛЯЕМ ПОЛЯ ИЗ PARSER
// ============================================

console.log('📋 BUYCYCLE PARSER FIELDS:\n');

// 1. Breadcrumb (навигация)
added += addColumnSafe('bikes', 'breadcrumb', 'TEXT', 'NULL') ? 1 : 0;

// 2-3. Platform Trust (доверие к платформе)
added += addColumnSafe('bikes', 'platform_reviews_count', 'INTEGER', 'NULL') ? 1 : 0;
added += addColumnSafe('bikes', 'platform_reviews_source', 'TEXT', 'NULL') ? 1 : 0;

// 4. Buyer Protection (цена с защитой)
added += addColumnSafe('bikes', 'buyer_protection_price', 'REAL', 'NULL') ? 1 : 0;

// 5-6. Seller Activity (активность продавца)
added += addColumnSafe('bikes', 'seller_last_active', 'TEXT', 'NULL') ? 1 : 0;
added += addColumnSafe('bikes', 'seller_rating_visual', 'TEXT', 'NULL') ? 1 : 0;

// 7. Shifting Type (механика/электроника)
added += addColumnSafe('bikes', 'shifting_type', 'TEXT', 'NULL') ? 1 : 0;

// 8. Receipt (наличие чека)
added += addColumnSafe('bikes', 'receipt_available', 'INTEGER', '0') ? 1 : 0;

// 9. Component Upgrades (замененные части с badges)
added += addColumnSafe('bikes', 'component_upgrades_json', 'TEXT', 'NULL') ? 1 : 0;

console.log('\n📋 GEMINI AI FIELDS:\n');

// 10. Sub Category (для MTB: xc, trail, enduro, downhill)
added += addColumnSafe('bikes', 'sub_category', 'TEXT', 'NULL') ? 1 : 0;

skipped = 10 - added;

// ============================================
// СОЗДАЕМ ИНДЕКСЫ
// ============================================
console.log('\n🔍 CREATING INDEXES:\n');

const indexes = [
  { 
    name: 'idx_bikes_breadcrumb', 
    sql: 'CREATE INDEX IF NOT EXISTS idx_bikes_breadcrumb ON bikes(breadcrumb)' 
  },
  { 
    name: 'idx_bikes_sub_category', 
    sql: 'CREATE INDEX IF NOT EXISTS idx_bikes_sub_category ON bikes(sub_category)' 
  },
  { 
    name: 'idx_bikes_receipt', 
    sql: 'CREATE INDEX IF NOT EXISTS idx_bikes_receipt ON bikes(receipt_available)' 
  },
  { 
    name: 'idx_bikes_buyer_protection', 
    sql: 'CREATE INDEX IF NOT EXISTS idx_bikes_buyer_protection ON bikes(buyer_protection_price)' 
  }
];

let indexesCreated = 0;
indexes.forEach(idx => {
  try {
    db.prepare(idx.sql).run();
    console.log(`   ✅ ${idx.name}`);
    indexesCreated++;
  } catch (error) {
    console.log(`   ⏭️  ${idx.name.padEnd(35)} - already exists`);
  }
});

// ============================================
// ИТОГИ
// ============================================
console.log('\n' + '='.repeat(80));
console.log('📊 MIGRATION SUMMARY');
console.log('='.repeat(80));
console.log(`\n   Columns added:    ${added}`);
console.log(`   Columns skipped:  ${skipped}`);
console.log(`   Indexes created:  ${indexesCreated}`);
console.log(`\n   Backup saved:     ${backupPath}`);
console.log('\n' + '='.repeat(80));
console.log('✅ Migration completed!\n');

db.close();
