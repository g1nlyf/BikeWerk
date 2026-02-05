const path = require('path');
const BikesDatabase = require('../../telegram-bot/bikes-database-node');
const ValuationService = require('../services/valuation-service');

(async () => {
  console.log('🔍 FMV DIAGNOSTIC TOOL\n');
  
  // ═══════════════════════════════════════════
  // SETUP
  // ═══════════════════════════════════════════
  const db = new BikesDatabase();
  await db.ensureInitialized();
  const valuationService = new ValuationService(db);

  // ═══════════════════════════════════════════
  // TEST 1: Проверка market_history
  // ═══════════════════════════════════════════
  console.log('TEST 1: Checking market_history table...');
  
  const totalRecords = await db.getQuery(`
    SELECT COUNT(*) as count FROM market_history
  `);
  
  console.log(`   Total records: ${totalRecords.count}`);
  
  if (totalRecords.count === 0) {
    console.log('   ❌ PROBLEM: market_history is EMPTY!');
    console.log('   → Silent Collector не сохраняет данные\n');
  } else {
    console.log('   ✅ market_history has data\n');
  }
  
  // ═══════════════════════════════════════════
  // TEST 4: Проверка структуры таблицы (Moved up)
  // ═══════════════════════════════════════════
  console.log('TEST 4: Checking table schema...');
  
  const schema = await db.allQuery(`
    PRAGMA table_info(market_history)
  `);
  
  console.log('   Columns:');
  schema.forEach(col => {
    console.log(`     - ${col.name} (${col.type})`);
  });
  
  const hasRequiredColumns = 
    schema.some(c => c.name === 'brand') && 
    schema.some(c => c.name === 'model') && 
    schema.some(c => c.name === 'price_eur') && 
    schema.some(c => c.name === 'year');
  
  if (!hasRequiredColumns) {
    console.log('   ❌ Missing required columns for ValuationService!');
    const missing = [];
    if (!schema.some(c => c.name === 'brand')) missing.push('brand');
    if (!schema.some(c => c.name === 'model')) missing.push('model');
    if (!schema.some(c => c.name === 'price_eur')) missing.push('price_eur');
    if (!schema.some(c => c.name === 'year')) missing.push('year');
    console.log(`   Missing: ${missing.join(', ')}`);
  } else {
    console.log('   ✅ All required columns present');
  }
  console.log('');

  // ═══════════════════════════════════════════
  // TEST 2: Проверка Santa Cruz данных
  // ═══════════════════════════════════════════
  console.log('TEST 2: Checking Santa Cruz listings...');
  
  const santaCruzCount = await db.getQuery(`
    SELECT COUNT(*) as count 
    FROM market_history 
    WHERE brand = 'Santa Cruz'
  `);
  
  console.log(`   Santa Cruz listings: ${santaCruzCount.count}`);
  
  if (santaCruzCount.count === 0) {
    console.log('   ⚠️ No Santa Cruz data for comparables\n');
  } else {
    // Показать примеры 
    const samples = await db.allQuery(`
      SELECT *
      FROM market_history 
      WHERE brand = 'Santa Cruz' 
      LIMIT 5 
    `);
    
    console.log('   Sample listings:');
    samples.forEach(s => {
      // Use model or model_name depending on what exists
      const model = s.model || s.model_name || 'unknown';
      console.log(`     - ${s.brand} ${model} (${s.year || 'no year'}) - €${s.price_eur}`);
    });
    console.log('');
  }
  
  // ═══════════════════════════════════════════
  // TEST 3: Прямой вызов ValuationService
  // ═══════════════════════════════════════════
  console.log('TEST 3: Direct ValuationService call...');
  
  const testBike = {
    brand: 'Santa Cruz',
    model: 'Heckler 6',
    year: 2012, // Approximate year for Heckler 6
    category: 'MTB',
    condition_grade: 'B',
    price: 550,
    frame_material: 'Aluminium'
  };
  
  console.log('   Input:', JSON.stringify(testBike, null, 2));
  
  try {
      const fmv = await valuationService.calculateFMV(testBike);
      
      console.log(`   Result: ${JSON.stringify(fmv)}`);
      
      if (!fmv || fmv === null) {
        console.log('   ❌ FMV calculation FAILED\n');
      } else {
        console.log(`   ✅ FMV: €${fmv.finalPrice || fmv}\n`);
      }
  } catch (e) {
      console.log(`   ❌ Error during calculation: ${e.message}`);
  }
  
  console.log('\n════════════════════════════════════════');
  console.log('DIAGNOSIS COMPLETE');
  console.log('════════════════════════════════════════\n');
})();
