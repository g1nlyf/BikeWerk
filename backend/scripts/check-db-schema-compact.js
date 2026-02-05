const Database = require('better-sqlite3');
const path = require('path');

/**
 * ПРОВЕРКА СХЕМЫ БД (COMPACT VERSION)
 */

const dbPath = path.join(__dirname, '../database/eubike.db');

console.log('='.repeat(60));
console.log('DATABASE SCHEMA (COMPACT)');
console.log('='.repeat(60));

try {
  const db = new Database(dbPath, { readonly: true });
  
  // 1. Table Info
  const columns = db.prepare('PRAGMA table_info(bikes)').all();
  
  console.log(`\n📋 TABLE: bikes (${columns.length} columns)\n`);
  
  // Group columns by type/purpose
  const coreCols = columns.filter(c => ['id', 'name', 'brand', 'model', 'year', 'price', 'currency', 'category'].includes(c.name));
  const jsonCols = columns.filter(c => c.name.endsWith('_json') || c.name === 'unified_data');
  const metaCols = columns.filter(c => ['source_platform', 'source_ad_id', 'source_url', 'created_at', 'is_active'].includes(c.name));
  const scoreCols = columns.filter(c => c.name.includes('score') || c.name.includes('rating'));
  
  // Helper to print rows
  const printCols = (cols) => {
      cols.forEach(c => {
          const type = c.type || 'NULL';
          console.log(`   - ${c.name.padEnd(25)} ${type.padEnd(10)} ${c.notnull ? '*' : ''}`);
      });
  };

  console.log('🔹 CORE FIELDS:');
  printCols(coreCols);

  console.log('\n🔹 JSON DATA CONTAINERS:');
  printCols(jsonCols);

  console.log('\n🔹 METADATA & SOURCE:');
  printCols(metaCols);

  console.log('\n🔹 SCORES & RATINGS:');
  printCols(scoreCols);

  // Other interesting columns (first 5 that are not in groups above)
  const groupedNames = new Set([...coreCols, ...jsonCols, ...metaCols, ...scoreCols].map(c => c.name));
  const otherCols = columns.filter(c => !groupedNames.has(c.name)).slice(0, 10);
  
  if (otherCols.length > 0) {
      console.log('\n🔹 OTHER NOTABLE FIELDS (Sample):');
      printCols(otherCols);
      console.log(`   ... and ${columns.length - groupedNames.size - otherCols.length} more`);
  }

  // 2. Indexes
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='bikes'").all();
  console.log(`\n🔍 INDEXES (${indexes.length}):`);
  console.log(indexes.map(i => `   - ${i.name}`).join('\n'));

  // 3. Sample JSON Structure
  console.log('\n📄 SAMPLE UNIFIED DATA (Structure Keys):');
  const row = db.prepare('SELECT unified_data FROM bikes WHERE unified_data IS NOT NULL LIMIT 1').get();
  if (row && row.unified_data) {
      try {
          const data = JSON.parse(row.unified_data);
          console.log(JSON.stringify(Object.keys(data).reduce((acc, k) => {
              acc[k] = typeof data[k] === 'object' ? '{...}' : typeof data[k];
              return acc;
          }, {}), null, 2));
      } catch (e) {
          console.log('   (Invalid JSON)');
      }
  } else {
      console.log('   (No data found)');
  }

  db.close();
  console.log('\n' + '='.repeat(60));

} catch (error) {
  console.error('❌ Error:', error.message);
}
