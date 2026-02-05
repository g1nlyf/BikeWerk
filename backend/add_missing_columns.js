const { DatabaseManager } = require('./src/js/mysql-config');
const path = require('path');

async function main() {
  console.log('Initializing DatabaseManager...');
  const db = new DatabaseManager();
  await db.initialize();
  
  console.log('Database path:', db.dbPath);

  // 1. Add columns to bike_behavior_metrics
  console.log('Checking bike_behavior_metrics columns...');
  const metricColumns = ['hovers', 'scroll_stops', 'gallery_swipes'];
  for (const col of metricColumns) {
    try {
      await db.db.exec(`ALTER TABLE bike_behavior_metrics ADD COLUMN ${col} INTEGER DEFAULT 0`);
      console.log(`Added column ${col} to bike_behavior_metrics`);
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log(`Column ${col} already exists in bike_behavior_metrics`);
      } else {
        console.log(`Error adding ${col}:`, e.message);
      }
    }
  }

  // 2. Add columns to bikes
  console.log('Checking bikes columns...');
  const bikeColumns = [
      { name: 'rank', type: 'REAL DEFAULT 0.5' },
      { name: 'is_hot_offer', type: 'INTEGER DEFAULT 0' },
      { name: 'ranking_score', type: 'REAL DEFAULT 0.5' }
  ];

  for (const col of bikeColumns) {
    try {
      await db.db.exec(`ALTER TABLE bikes ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added column ${col.name} to bikes`);
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log(`Column ${col.name} already exists in bikes`);
      } else {
        console.log(`Error adding ${col.name}:`, e.message);
      }
    }
  }
  
  // Persist changes to disk
  console.log('Persisting changes to disk...');
  await db.persist();
  
  await db.close();
  console.log('Done.');
}

main().catch(console.error);
