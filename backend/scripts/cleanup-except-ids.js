// Cleanup DB leaving only specific bike IDs (default: 74, 75)
// Usage: node scripts/cleanup-except-ids.js [keepId1 keepId2 ...]
require('dotenv').config();
const { DatabaseManager } = require('../src/apis/js/mysql-config.js');

async function cleanup(keepIds) {
  const db = new DatabaseManager();
  try {
    console.log('DB Path:', db.dbPath);
    await db.initialize();
    const idsStr = keepIds.map(id => parseInt(id, 10)).filter(Boolean).join(',');
    if (!idsStr) throw new Error('No valid keep IDs provided');

    const before = await db.getCounts?.() // optional if exists
    const bikesBefore = await db.query('SELECT COUNT(*) as cnt FROM bikes');
    console.log('Bikes before:', bikesBefore[0]?.cnt);

    // Delete related rows not in keepIds
    const queries = [
      { sql: `DELETE FROM bike_images WHERE bike_id NOT IN (${idsStr})`, params: [] },
      { sql: `DELETE FROM bike_specs WHERE bike_id NOT IN (${idsStr})`, params: [] },
      { sql: `DELETE FROM user_favorites WHERE bike_id NOT IN (${idsStr})`, params: [] },
      { sql: `DELETE FROM shopping_cart WHERE bike_id NOT IN (${idsStr})`, params: [] },
      { sql: `DELETE FROM order_items WHERE bike_id NOT IN (${idsStr})`, params: [] },
      { sql: `DELETE FROM bikes WHERE id NOT IN (${idsStr})`, params: [] },
    ];

    await db.transaction(queries);

    // Optional: remove orders that have no items left
    try {
      await db.query(`DELETE FROM orders WHERE id NOT IN (SELECT DISTINCT order_id FROM order_items)`);
    } catch {}

    const afterCount = await db.query('SELECT COUNT(*) as cnt FROM bikes');
    const remaining = await db.query('SELECT id,name,brand,price FROM bikes ORDER BY id');
    console.log('Bikes after:', afterCount[0]?.cnt);
    console.log('Remaining bikes:', remaining);

    // Rebuild the database file to reclaim space
    try { await db.query('VACUUM'); } catch {}

    await db.close();
    console.log('✅ Cleanup completed');
  } catch (err) {
    console.error('❌ Cleanup error:', err.message);
    process.exit(1);
  }
}

const keepIds = process.argv.slice(2).length ? process.argv.slice(2) : ['74', '75'];
cleanup(keepIds);