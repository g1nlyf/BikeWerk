const DatabaseManager = require('../database/db-manager');

(async () => {
  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();
  
  console.log('🔍 CRON STATUS CHECK\n');
  
  // Последние 5 запусков
  const runs = db.prepare(`
    SELECT 
      type, 
      details, 
      created_at 
    FROM hunter_events 
    WHERE type LIKE 'HOURLY_%' 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all();
  
  if (runs.length === 0) {
    console.log('⚠️  No hourly runs found yet\n');
  } else {
    console.log('📊 Last 5 hourly runs:\n');
    runs.forEach(run => {
      const details = JSON.parse(run.details);
      console.log(`[${run.created_at}] ${run.type}`);
      if (details.bikesAdded !== undefined) {
        console.log(`  → Added: ${details.bikesAdded} bikes`);
        console.log(`  → Duration: ${details.duration} min\n`);
      }
    });
  }
  
  // Статистика последних 24 часов
  const stats = db.prepare(`
    SELECT COUNT(*) as count 
    FROM hunter_events 
    WHERE type = 'HOURLY_RUN_COMPLETE' 
      AND created_at > datetime('now', '-24 hours')
  `).get();
  
  console.log(`Runs in last 24h: ${stats.count}`);
  console.log(`Expected: ~24 (one per hour)\n`);
  
  if (stats.count === 0) {
    console.log('❌ Cron NOT running!\n');
  } else if (stats.count < 12) {
    console.log('⚠️  Cron running but inconsistent\n');
  } else {
    console.log('✅ Cron working normally\n');
  }
})();
