const Database = require('better-sqlite3');
const path = require('path');

/**
 * ПРОВЕРКА СХЕМЫ БД
 * Выводит все столбцы таблицы bikes
 */

// Путь к БД (обычно в корне проекта)
const dbPath = path.join(__dirname, '../database/eubike.db');

console.log('='.repeat(80));
console.log('DATABASE SCHEMA CHECKER');
console.log('='.repeat(80));
console.log(`\nDatabase path: ${dbPath}\n`);

try {
  // Подключаемся к БД
  const db = new Database(dbPath, { readonly: true });
  
  console.log('✅ Connected to database\n');
  
  // Проверяем существует ли таблица bikes
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='bikes'
  `).get();
  
  if (!tableExists) {
    console.log('❌ Table "bikes" does not exist!\n');
    console.log('Available tables:');
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();
    tables.forEach(t => console.log(`   - ${t.name}`));
    process.exit(1);
  }
  
  console.log('📋 TABLE: bikes\n');
  console.log('-'.repeat(80));
  
  // Получаем структуру таблицы
  const columns = db.prepare('PRAGMA table_info(bikes)').all();
  
  console.log(`Total columns: ${columns.length}\n`);
  
  // Выводим в красивом виде
  console.log('CID | NAME                          | TYPE          | NOT NULL | DEFAULT      | PK');
  console.log('-'.repeat(80));
  
  columns.forEach(col => {
    const cid = String(col.cid).padEnd(3);
    const name = String(col.name).padEnd(29);
    const type = String(col.type).padEnd(13);
    const notNull = col.notnull ? 'YES' : 'NO ';
    const dfltValue = col.dflt_value !== null ? String(col.dflt_value).substring(0, 12) : 'NULL';
    const pk = col.pk ? 'YES' : 'NO ';
    
    console.log(`${cid} | ${name} | ${type} | ${notNull.padEnd(8)} | ${dfltValue.padEnd(12)} | ${pk}`);
  });
  
  console.log('-'.repeat(80));
  
  // Статистика по типам
  console.log('\n📊 Column Types Summary:\n');
  const typeCount = {};
  columns.forEach(col => {
    const type = col.type || 'NULL';
    typeCount[type] = (typeCount[type] || 0) + 1;
  });
  
  Object.entries(typeCount).forEach(([type, count]) => {
    console.log(`   ${type.padEnd(15)} : ${count}`);
  });
  
  // Список всех имен столбцов (для копирования)
  console.log('\n📝 Column Names (comma-separated):\n');
  console.log(columns.map(c => c.name).join(', '));
  
  // JSON формат
  console.log('\n\n📄 JSON Format:\n');
  console.log(JSON.stringify(columns, null, 2));
  
  // Проверяем индексы
  console.log('\n\n🔍 INDEXES:\n');
  const indexes = db.prepare(`
    SELECT name, sql FROM sqlite_master 
    WHERE type='index' AND tbl_name='bikes'
  `).all();
  
  if (indexes.length > 0) {
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}`);
      if (idx.sql) console.log(`     ${idx.sql}\n`);
    });
  } else {
    console.log('   No indexes found\n');
  }
  
  // Проверяем связанные таблицы
  console.log('\n🔗 RELATED TABLES:\n');
  const relatedTables = ['bike_images', 'price_history'];
  
  relatedTables.forEach(tableName => {
    const exists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(tableName);
    
    if (exists) {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
      console.log(`   ✅ ${tableName} (${cols.length} columns)`);
    } else {
      console.log(`   ❌ ${tableName} (not exists)`);
    }
  });
  
  db.close();
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Schema check complete!\n');
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('\nTrying alternative database paths...\n');
  
  // Пробуем альтернативные пути
  const alternativePaths = [
    path.join(__dirname, '../database/eubike.db'),
    path.join(__dirname, '../../database/eubike.db'),
    path.join(process.cwd(), 'backend/database/eubike.db')
  ];
  
  console.log('Checking paths:');
  alternativePaths.forEach(p => {
    const fs = require('fs');
    const exists = fs.existsSync(p);
    console.log(`   ${exists ? '✅' : '❌'} ${p}`);
  });
  
  process.exit(1);
}
