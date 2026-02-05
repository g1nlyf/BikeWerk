const db = require('better-sqlite3')('./backend/database/eubike.db');

// Fix null strings
const fix = db.prepare(`UPDATE bikes SET size = NULL WHERE size = 'null'`).run();
console.log('Fixed', fix.changes, 'rows with null string');

// Show distribution
const dist = db.prepare(`SELECT size, COUNT(*) as cnt FROM bikes WHERE size IS NOT NULL GROUP BY size ORDER BY cnt DESC`).all();
console.log('\nSize distribution:');
dist.forEach(d => console.log(`  '${d.size}': ${d.cnt}`));

db.close();
