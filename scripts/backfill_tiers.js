const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new Database(DB_PATH);

console.log('Running Tier Backfill...');

try {
    const info = db.prepare(`
        UPDATE bikes 
        SET tier = CASE 
          WHEN brand IN ('YT', 'Santa Cruz', 'Specialized', 'Canyon', 'Trek', 'Evil', 'Transition', 'Pivot', 'Yeti', 'Ibis') THEN 1 
          WHEN brand IN ('Scott', 'Cube', 'Ghost', 'Focus', 'Bulls', 'Radon', 'Rose', 'Commencal', 'Nukeproof', 'Norco') THEN 2 
          ELSE 3 
        END 
        WHERE tier IS NULL;
    `).run();
    
    console.log(`Tiers backfilled: ${info.changes}`);
} catch (e) {
    console.error(`Backfill failed: ${e.message}`);
}
