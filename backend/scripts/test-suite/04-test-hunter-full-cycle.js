// backend/scripts/test-suite/04-test-hunter-full-cycle.js

const UnifiedHunter = require('../../../telegram-bot/unified-hunter');
const DatabaseManager = require('../../database/db-manager');

(async () => {
  console.log('🔬 TEST 3.1: Hunter Full Cycle (16 Stages)\n');
  console.log('═'.repeat(60) + '\n');
  
  const hunter = new UnifiedHunter();
  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();
  
  // Запомнить текущее количество байков
  // Ensure bikes table exists (it should)
  const beforeCount = db.prepare('SELECT COUNT(*) as count FROM bikes').get().count;
  
  console.log(`Bikes in catalog before: ${beforeCount}\n`);
  
  // Запустить один цикл
  console.log('🚀 Starting hunt cycle...\n');
  
  try {
    // Note: startHunt might not exist if UnifiedHunter wasn't updated to have it, 
    // or it might be named 'hunt'. Checking previous memories, it was 'hunt'.
    // User says 'startHunt'. I will check if it exists, if not try 'hunt'.
    if (typeof hunter.startHunt === 'function') {
        await hunter.startHunt({
            maxListings: 5,
            categories: ['MTB']
        });
    } else if (typeof hunter.hunt === 'function') {
        console.log('⚠️ startHunt not found, using hunt() instead...');
        await hunter.hunt({
            maxListings: 5,
            categories: ['MTB']
        });
    } else {
        throw new Error('Hunter has no startHunt or hunt method');
    }
    
    // Проверить результат
    const afterCount = db.prepare('SELECT COUNT(*) as count FROM bikes').get().count;
    const newBikes = afterCount - beforeCount;
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTS:\n');
    console.log(`Bikes before: ${beforeCount}`);
    console.log(`Bikes after:  ${afterCount}`);
    console.log(`New bikes:    ${newBikes}\n`);
    
    if (newBikes > 0) {
      console.log('✅ PASS: Hunter successfully added bikes\n');
      
      // Показать добавленные байки
      const newListings = db.prepare(`
        SELECT id, brand, model, price, fmv, is_active, priority
        FROM bikes
        ORDER BY created_at DESC
        LIMIT ${newBikes}
      `).all();
      
      console.log('🆕 New bikes added:\n');
      console.table(newListings);
      
      // Проверить качество данных
      const withFMV = newListings.filter(b => b.fmv > 0).length;
      const published = newListings.filter(b => b.is_active === 1).length;
      
      console.log(`\n📈 Quality metrics:`);
      console.log(`  FMV calculated: ${withFMV}/${newBikes} (${(withFMV/newBikes*100).toFixed(0)}%)`);
      console.log(`  Published:      ${published}/${newBikes} (${(published/newBikes*100).toFixed(0)}%)\n`);
      
      if (withFMV / newBikes >= 0.8) {
        console.log('✅ PASS: FMV coverage > 80%\n');
      } else {
        console.log('⚠️  WARNING: FMV coverage < 80%\n');
      }
      
    } else {
      console.log('⚠️  WARNING: No new bikes added (might be all duplicates or no profitable deals found)\n');
    }
    
  } catch (error) {
    console.log('❌ FAIL: Hunter crashed\n');
    console.error(error);
  }
  
  console.log('🏁 TEST 3.1 COMPLETE\n');
})();
