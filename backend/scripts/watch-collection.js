const DatabaseManager = require('../database/db-manager');
const fs = require('fs');
const path = require('path');

class CollectionWatcher {
  constructor() {
    this.dbManager = new DatabaseManager();
    this.startTime = Date.now();
  }

  async watch() {
    const db = this.dbManager.getDatabase();
    
    // Clear console
    process.stdout.write('\x1Bc');
    
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   👀 DATA COLLECTION MONITOR                        ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    const initialCount = db.prepare('SELECT COUNT(*) as count FROM market_history').get().count;
    let lastCount = initialCount;
    let startMonitorTime = Date.now();
    
    setInterval(() => {
      const currentCount = db.prepare('SELECT COUNT(*) as count FROM market_history').get().count;
      const collected = currentCount - initialCount; // collected since script start (approx) or total if fresh db
      const newSinceLastCheck = currentCount - lastCount;
      
      const elapsedHours = (Date.now() - startMonitorTime) / 1000 / 3600;
      const speed = newSinceLastCheck > 0 
        ? (newSinceLastCheck / 5 * 60 * 60) // based on last 5 sec interval, inaccurate
        : 0; // Better: calculate avg speed over longer window
      
      // Calculate speed based on total collected since monitor start
      // This is only accurate if monitor started same time as collection
      // Better: check log file for start time? 
      // Let's just show current total and recent activity.
      
      // Quality metrics
      const quality = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN year IS NOT NULL THEN 1 ELSE 0 END) as with_year,
          SUM(CASE WHEN frame_size IS NOT NULL THEN 1 ELSE 0 END) as with_size
        FROM market_history
      `).get();
      
      process.stdout.write('\x1Bc'); // Clear screen
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║   👀 DATA COLLECTION MONITOR                        ║');
      console.log('╚═══════════════════════════════════════════════════════╝\n');
      
      console.log(`Total Records:     ${currentCount}`);
      console.log(`Collected (Total): ${currentCount}`); // assuming started from 0 for fresh run
      
      console.log('\n📊 Data Quality:');
      console.log(`   With Year:      ${quality.with_year} (${(quality.with_year/quality.total*100).toFixed(1)}%)`);
      console.log(`   With Size:      ${quality.with_size} (${(quality.with_size/quality.total*100).toFixed(1)}%)`);
      
      // ETA calculation (assuming target 10000)
      const target = 10000;
      const remaining = target - currentCount;
      
      // Try to read PID/log to get start time?
      // For now just simple display
      
      console.log('\n⏱️ Status:');
      console.log(`   Progress:       ${(currentCount/target*100).toFixed(1)}%`);
      console.log(`   Remaining:      ${remaining > 0 ? remaining : 0}`);
      
      console.log('\nPress Ctrl+C to exit monitor (collection continues)');
      
      lastCount = currentCount;
    }, 5000);
  }
}

// Run watcher
if (require.main === module) {
  const watcher = new CollectionWatcher();
  watcher.watch();
}
