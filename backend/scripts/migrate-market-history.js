const DatabaseManager = require('../database/db-manager');

(async () => {
  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();
  
  console.log('🔧 Migrating market_history schema...\n');
  
  try {
    db.exec(`
      ALTER TABLE market_history ADD COLUMN year INTEGER;
    `);
    console.log('✅ Added column: year');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('⏭️  Column "year" already exists');
    } else {
      console.error('Error adding year:', e.message);
    }
  }
  
  try {
    db.exec(`
      ALTER TABLE market_history ADD COLUMN frame_size TEXT;
    `);
    console.log('✅ Added column: frame_size');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('⏭️  Column "frame_size" already exists');
    } else {
        console.error('Error adding frame_size:', e.message);
    }
  }
  
  try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_market_year_size 
        ON market_history(brand, model, year, frame_size);
      `);
      console.log('✅ Created index: idx_market_year_size\n');
  } catch (e) {
      console.error('Error creating index:', e.message);
  }
  
  console.log('🏁 Migration complete!\n');
})();
