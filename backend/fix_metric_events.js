const { DatabaseManager } = require('./src/js/mysql-config');
const path = require('path');

async function main() {
  console.log('Initializing DatabaseManager...');
  const db = new DatabaseManager();
  await db.initialize();
  
  console.log('Database path:', db.dbPath);

  console.log('Checking metric_events table...');
  
  try {
      // Check if column exists by trying to select it
      await db.db.get('SELECT created_at FROM metric_events LIMIT 1');
      console.log('Column created_at already exists in metric_events');
  } catch (e) {
      console.log('Column created_at missing, adding it...');
      try {
          // Add column without default value to avoid SQLite limitation
          await db.db.exec('ALTER TABLE metric_events ADD COLUMN created_at TEXT');
          console.log('Successfully added created_at to metric_events');
      } catch (alterError) {
          console.error('Failed to add column:', alterError);
      }
  }

  await db.close();
  console.log('Done.');
}

main().catch(console.error);
