
const CatalogGapAnalyzer = require('../../src/services/catalog-gap-analyzer.js'); 
const { DatabaseManager } = require('../../src/js/mysql-config');
const db = new DatabaseManager();

async function testSmartHunt() { 
  console.log('🧪 TESTING SMART HUNT LOGIC\n'); 
  console.log('═══════════════════════════════════════\n'); 
  
  // SCENARIO 1: Model с пробелами 
  console.log('SCENARIO 1: Canyon Spectral (Expected gaps)'); 
  const gaps1 = await CatalogGapAnalyzer.analyzeModelGaps('Canyon', 'Spectral'); 
  
  console.log(`\nResult:`); 
  console.log(`  Priority: ${gaps1.priority}`); 
  console.log(`  Size gaps: ${gaps1.gaps.sizes.length}`); 
  console.log(`  Price gaps: ${gaps1.gaps.prices.length}`); 
  console.log(`  Action: ${gaps1.priority !== 'LOW' ? 'HUNT' : 'SKIP'}`); 
  
  // SCENARIO 2: Полностью покрытая модель 
  console.log('\n\nSCENARIO 2: YT Capra (Fully covered)'); 
  
  // Искусственно добавим bikes для теста 
  await db.query(` 
    INSERT INTO bikes (name, brand, model, size, price, year, is_active, tier, created_at, category) 
    VALUES 
      ('YT Capra M', 'YT', 'Capra', 'M', 2500, 2023, 1, 1, datetime('now'), 'MTB'), 
      ('YT Capra M Pro', 'YT', 'Capra', 'M', 3000, 2024, 1, 1, datetime('now'), 'MTB'), 
      ('YT Capra L', 'YT', 'Capra', 'L', 2700, 2023, 1, 1, datetime('now'), 'MTB'), 
      ('YT Capra L Race', 'YT', 'Capra', 'L', 3200, 2024, 1, 1, datetime('now'), 'MTB'), 
      ('YT Capra S', 'YT', 'Capra', 'S', 2400, 2023, 1, 1, datetime('now'), 'MTB') 
  `); 
  
  const gaps2 = await CatalogGapAnalyzer.analyzeModelGaps('YT', 'Capra'); 
  
  console.log(`\nResult:`); 
  console.log(`  Priority: ${gaps2.priority}`); 
  console.log(`  Current bikes: ${gaps2.current.count}`); 
  console.log(`  Action: ${gaps2.priority !== 'LOW' ? 'HUNT' : 'SKIP (well-covered)'}`); 
  
  // Cleanup 
  await db.query(`DELETE FROM bikes WHERE brand = 'YT' AND model = 'Capra'`); 
  
  console.log('\n\n═══════════════════════════════════════'); 
  console.log('✅ Smart Hunt Test Complete\n'); 
} 

testSmartHunt().catch(console.error);
