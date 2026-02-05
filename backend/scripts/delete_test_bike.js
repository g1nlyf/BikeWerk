const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

const adId = '26483';
const platform = 'buycycle';

const info = db.prepare('DELETE FROM bikes WHERE source_ad_id = ? AND source_platform = ?').run(adId, platform);
console.log(`Deleted ${info.changes} rows.`);
