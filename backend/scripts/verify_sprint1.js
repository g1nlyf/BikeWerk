const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/eubike.db');
const db = new Database(DB_PATH);

console.log('📊 Verifying Sprint 1 Metrics...');

try {
    const row = db.prepare(`
        SELECT 
           COUNT(*) as total, 
           AVG(quality_score) as avg_quality, 
           COUNT(CASE WHEN year IS NOT NULL THEN 1 END)*100.0/COUNT(*) as year_pct, 
           COUNT(CASE WHEN category IS NOT NULL THEN 1 END)*100.0/COUNT(*) as category_pct 
         FROM market_history 
         WHERE scraped_at > datetime('now', '-1 hour')
    `).get();

    console.log('--------------------------------------------------');
    console.log(`Total New Records: ${row.total}`);
    console.log(`Avg Quality Score: ${row.avg_quality ? row.avg_quality.toFixed(1) : 0}`);
    console.log(`Year Coverage:     ${row.year_pct ? row.year_pct.toFixed(1) : 0}%`);
    console.log(`Category Coverage: ${row.category_pct ? row.category_pct.toFixed(1) : 0}%`);
    console.log('--------------------------------------------------');

    if (row.total > 0) {
        console.log('\nSample Records (Top 5 by Quality):');
        const samples = db.prepare(`
            SELECT brand, title, year, category, quality_score 
            FROM market_history 
            WHERE scraped_at > datetime('now', '-1 hour') 
            ORDER BY quality_score DESC 
            LIMIT 5
        `).all();
        console.table(samples);
    }

} catch (e) {
    console.error('Error running verification:', e.message);
}
