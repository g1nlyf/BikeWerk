const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/eubike.db');
const db = new Database(DB_PATH);

console.log('📊 Verifying Sprint 2 Metrics (AI Intelligence Layer)...');

try {
    const row = db.prepare(`
        SELECT 
           COUNT(*) as total, 
           AVG(quality_score) as avg_quality, 
           COUNT(CASE WHEN year IS NOT NULL THEN 1 END)*100.0/COUNT(*) as year_pct, 
           COUNT(CASE WHEN trim_level IS NOT NULL THEN 1 END)*100.0/COUNT(*) as trim_pct,
           COUNT(CASE WHEN frame_material IS NOT NULL THEN 1 END)*100.0/COUNT(*) as material_pct
         FROM market_history 
         WHERE scraped_at > datetime('now', '-1 hour')
    `).get();

    console.log('--------------------------------------------------');
    console.log(`Total New Records: ${row.total}`);
    console.log(`Avg Quality Score: ${row.avg_quality ? row.avg_quality.toFixed(1) : 0}`);
    console.log(`Year Coverage:     ${row.year_pct ? row.year_pct.toFixed(1) : 0}%`);
    console.log(`Trim Level Cov:    ${row.trim_pct ? row.trim_pct.toFixed(1) : 0}%`);
    console.log(`Material Cov:      ${row.material_pct ? row.material_pct.toFixed(1) : 0}%`);
    console.log('--------------------------------------------------');

    if (row.total > 0) {
        console.log('\nSample Records (Top 5 by Quality):');
        const samples = db.prepare(`
            SELECT brand, model, trim_level, year, frame_material, quality_score 
            FROM market_history 
            WHERE scraped_at > datetime('now', '-1 hour') 
            ORDER BY quality_score DESC 
            LIMIT 5
        `).all();
        console.table(samples);
        
        console.log('\nSpecialized Turbo Levo Segmentation Check:');
        const levo = db.prepare(`
            SELECT 
               model, trim_level, year, 
               COUNT(*) as cnt, 
               ROUND(AVG(price_eur)) as avg, 
               MAX(price_eur) - MIN(price_eur) as spread 
            FROM market_history 
            WHERE brand = 'Specialized' AND model LIKE '%Levo%' AND scraped_at > datetime('now', '-1 hour')
            GROUP BY model, trim_level, year
        `).all();
        console.table(levo);
    }

} catch (e) {
    console.error('Error running verification:', e.message);
}
