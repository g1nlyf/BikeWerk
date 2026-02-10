const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function main() {
  const dbPath = path.resolve(__dirname, 'database/eubike.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  console.log('Creating analytics tables...');
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bike_id INTEGER,
      event_type TEXT,
      value INTEGER DEFAULT 1,
      metadata TEXT,
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bike_behavior_metrics (
      bike_id INTEGER PRIMARY KEY,
      impressions INTEGER DEFAULT 0,
      detail_clicks INTEGER DEFAULT 0,
      hovers INTEGER DEFAULT 0,
      scroll_stops INTEGER DEFAULT 0,
      gallery_swipes INTEGER DEFAULT 0,
      favorites INTEGER DEFAULT 0,
      add_to_cart INTEGER DEFAULT 0,
      orders INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      bounces INTEGER DEFAULT 0,
      dwell_ms_sum INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_analytics_events_bike ON analytics_events(bike_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
  `);
  
  console.log('Tables created.');
  await db.close();
}

main().catch(console.error);

