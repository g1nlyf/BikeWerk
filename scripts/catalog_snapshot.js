const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');

function runSnapshot() {
    const timestamp = Math.floor(Date.now() / 1000);
    console.log(`=== CATALOG SNAPSHOT: ${timestamp} ===`);

    const db = new Database(DB_PATH);

    // Total
    const total = db.prepare('SELECT COUNT(*) as c FROM bikes WHERE is_active = 1').get().c;
    console.log(`Total Active Bikes: ${total}`);
    console.log('');

    // By Tier
    console.log('By Tier:');
    const tiers = db.prepare('SELECT tier, COUNT(*) as cnt FROM bikes WHERE is_active = 1 GROUP BY tier').all();
    tiers.forEach(r => console.log(`${r.tier}|${r.cnt}`));
    console.log('');

    // By Source
    console.log('By Source:');
    const sources = db.prepare('SELECT source, COUNT(*) as cnt FROM bikes WHERE is_active = 1 GROUP BY source').all();
    sources.forEach(r => console.log(`${r.source || 'unknown'}|${r.cnt}`));
    console.log('');

    // Hotness
    console.log('Hotness Distribution:');
    const hotness = db.prepare(`
        SELECT 
          CASE 
            WHEN hotness_score >= 80 THEN 'Hot (80-100)' 
            WHEN hotness_score >= 60 THEN 'Warm (60-79)' 
            WHEN hotness_score >= 40 THEN 'Cool (40-59)' 
            ELSE 'Cold (0-39)' 
          END as category, 
          COUNT(*) as cnt 
        FROM bikes WHERE is_active = 1 
        GROUP BY category
    `).all();
    hotness.forEach(r => console.log(`${r.category}|${r.cnt}`));
    console.log('');

    // Data Quality
    console.log('Data Quality:');
    // Check if quality_score column exists
    let avgQualityColumn = 'quality_score';
    try {
        db.prepare('SELECT quality_score FROM market_history LIMIT 1').get();
        // But we want avg from BIKES table?
        // Bikes table usually has condition_score.
        // Let's check bikes columns
        const cols = db.prepare('PRAGMA table_info(bikes)').all().map(c => c.name);
        if (cols.includes('quality_score')) {
            avgQualityColumn = 'quality_score';
        } else if (cols.includes('condition_score')) {
            avgQualityColumn = 'condition_score';
        } else if (cols.includes('technical_score')) {
            avgQualityColumn = 'technical_score';
        } else {
            console.log('⚠️ No quality/condition score column found');
            avgQualityColumn = '0'; // fallback
        }
    } catch(e) {}

    const quality = db.prepare(`
        SELECT 
          ROUND(AVG(${avgQualityColumn}), 1) as avg_quality, 
          ROUND(COUNT(CASE WHEN year IS NOT NULL THEN 1 END)*100.0/COUNT(*), 1) as year_coverage, 
          ROUND(COUNT(CASE WHEN category IS NOT NULL THEN 1 END)*100.0/COUNT(*), 1) as category_coverage 
        FROM bikes WHERE is_active = 1
    `).get();
    if (quality) {
        console.log(`avg_quality: ${quality.avg_quality}`);
        console.log(`year_coverage: ${quality.year_coverage}%`);
        console.log(`category_coverage: ${quality.category_coverage}%`);
    }
    console.log('');

    // Top Models
    console.log('Top 5 Models:');
    const top = db.prepare(`
        SELECT brand, model, COUNT(*) as cnt 
        FROM bikes WHERE is_active = 1 
        GROUP BY brand, model 
        ORDER BY cnt DESC 
        LIMIT 5
    `).all();
    top.forEach(r => console.log(`${r.brand}|${r.model}|${r.cnt}`));

    console.log('');
    console.log('=== END SNAPSHOT ===');
}

runSnapshot();
