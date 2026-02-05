const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

// Count broken records
const broken = db.prepare(`SELECT COUNT(*) as cnt FROM bike_images WHERE local_path LIKE '%cloudfront%'`).get();
console.log('Broken cloudfront records:', broken.cnt);

// Delete them
const result = db.prepare(`DELETE FROM bike_images WHERE local_path LIKE '%cloudfront%'`).run();
console.log('Deleted:', result.changes);

// Verify remaining images
const remaining = db.prepare('SELECT COUNT(*) as cnt FROM bike_images').get();
console.log('Remaining images:', remaining.cnt);

// Check each bike
const bikes = db.prepare('SELECT id FROM bikes WHERE is_active = 1').all();
for (const b of bikes) {
    const imgCount = db.prepare('SELECT COUNT(*) as cnt FROM bike_images WHERE bike_id = ?').get(b.id);
    console.log(`  Bike ${b.id}: ${imgCount.cnt} images`);
}

db.close();
