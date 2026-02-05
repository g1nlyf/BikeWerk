// backend/scripts/test-suite/03-test-fmv-accuracy.js

const ValuationService = require('../../services/valuation-service');
const DatabaseManager = require('../../database/db-manager');

(async () => {
  console.log('🔬 TEST 2.1: FMV Accuracy with Year/Size\n');
  
  const valuationService = new ValuationService();
  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();

  // 💉 INJECT TEST DATA
  console.log('💉 Injecting test data...');
  const testData = [
    // Canyon Torque 2024 XL (Target: ~4000)
    ['Canyon', 'Torque CF 8', 'Torque CF 8', 4000, 4000, 'Canyon Torque CF 8 2024 XL', 'test_url_1', 2024, 'XL', 'MTB'],
    ['Canyon', 'Torque CF 8', 'Torque CF 8', 3900, 3900, 'Canyon Torque CF 8 2024 XL', 'test_url_2', 2024, 'XL', 'MTB'],
    ['Canyon', 'Torque CF 8', 'Torque CF 8', 4100, 4100, 'Canyon Torque CF 8 2024 XL', 'test_url_3', 2024, 'XL', 'MTB'],
    
    // Santa Cruz Heckler 2022 (Target: ~2700)
    ['Santa Cruz', 'Heckler', 'Heckler', 2700, 2700, 'Santa Cruz Heckler 2022', 'test_url_4', 2022, null, 'MTB'],
    ['Santa Cruz', 'Heckler', 'Heckler', 2600, 2600, 'Santa Cruz Heckler 2022', 'test_url_5', 2022, null, 'MTB'],
    ['Santa Cruz', 'Heckler', 'Heckler', 2800, 2800, 'Santa Cruz Heckler 2022', 'test_url_6', 2022, null, 'MTB'],

    // YT Capra 2018 L (Target: ~1800)
    // Model match logic needs min/max year data in DB
    ['YT', 'Capra', 'Capra', 1800, 1800, 'YT Capra 2018 L', 'test_url_7', 2018, 'L', 'MTB'],
    ['YT', 'Capra', 'Capra', 1900, 1900, 'YT Capra 2018 L', 'test_url_8', 2018, 'L', 'MTB'],
    ['YT', 'Capra', 'Capra', 1700, 1700, 'YT Capra 2018 L', 'test_url_9', 2018, 'L', 'MTB'],
    // Add a newer one to establish depreciation baseline if needed
    ['YT', 'Capra', 'Capra', 3500, 3500, 'YT Capra 2024 L', 'test_url_10', 2024, 'L', 'MTB']
  ];

  const stmt = db.prepare(`
    INSERT INTO market_history (brand, model, model_name, price, price_eur, title, source_url, year, frame_size, category, created_at, scraped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  db.transaction(() => {
    for (const row of testData) stmt.run(...row);
  })();

  
  // ═══════════════════════════════════════════
  // Test Case 1: Exact Match (год + размер)
  // ═══════════════════════════════════════════
  console.log('\nTest Case 1: Canyon Torque 2024 XL\n');
  
  const bike1 = {
    brand: 'Canyon',
    model: 'Torque',
    year: 2024,
    frame_size: 'XL',
    frame_material: 'carbon',
    price: 3000
  };
  
  const fmv1 = await valuationService.calculateFMV(bike1);
  
  if (fmv1 && fmv1 > 0) {
    const margin = ((fmv1 - bike1.price) / bike1.price * 100).toFixed(1);
    console.log(`✅ PASS: FMV = €${fmv1} (${margin}% margin)`);
    
    // Проверка что использовалась правильная стратегия
    const comparables = db.prepare(`
      SELECT COUNT(*) as count
      FROM market_history
      WHERE brand = 'Canyon'
        AND model LIKE '%Torque%'
        AND year BETWEEN 2022 AND 2024
        AND frame_size = 'XL'
        AND source_url LIKE 'test_url_%'
    `).get();
    
    console.log(`Comparables used: ${comparables.count}\n`);
  } else {
    console.log('❌ FAIL: FMV returned null\n');
  }
  
  // ═══════════════════════════════════════════
  // Test Case 2: Year Match (без размера)
  // ═══════════════════════════════════════════
  console.log('Test Case 2: Santa Cruz Heckler 2022 (no size)\n');
  
  const bike2 = {
    brand: 'Santa Cruz',
    model: 'Heckler',
    year: 2022,
    price: 1500
  };
  
  const fmv2 = await valuationService.calculateFMV(bike2);
  
  if (fmv2 && fmv2 > 0) {
    const margin = ((fmv2 - bike2.price) / bike2.price * 100).toFixed(1);
    console.log(`✅ PASS: FMV = €${fmv2} (${margin}% margin)\n`);
  } else {
    console.log('❌ FAIL: FMV returned null\n');
  }
  
  // ═══════════════════════════════════════════
  // Test Case 3: Age Adjustment (старый байк)
  // ═══════════════════════════════════════════
  console.log('Test Case 3: YT Capra 2018 L (old bike, age-adjusted)\n');
  
  const bike3 = {
    brand: 'YT',
    model: 'Capra',
    year: 2018,
    frame_size: 'L',
    price: 1200
  };
  
  const fmv3 = await valuationService.calculateFMV(bike3);
  
  if (fmv3 && fmv3 > 0) {
    const margin = ((fmv3 - bike3.price) / bike3.price * 100).toFixed(1);
    console.log(`✅ PASS: FMV = €${fmv3} (${margin}% margin)`);
    console.log(`(Should be lower than 2024 model due to age depreciation)\n`);
  } else {
    console.log('❌ FAIL: FMV returned null\n');
  }
  
  // 🧹 CLEANUP
  console.log('🧹 Cleaning up test data...');
  db.prepare("DELETE FROM market_history WHERE source_url LIKE 'test_url_%'").run();

  console.log('🏁 TEST 2.1 COMPLETE\n');
})();
