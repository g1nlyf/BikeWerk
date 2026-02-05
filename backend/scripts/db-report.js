const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function runReport() {
    await db.initialize();
    
    console.log('=== CATALOG QUALITY REPORT ===');
    
    const active = await db.query("SELECT COUNT(*) as c FROM bikes WHERE is_active = 1");
    console.log(`Total Active Bikes|${active[0].c}`);
    
    console.log('By Tier:|');
    const t1 = await db.query("SELECT COUNT(*) as c FROM bikes WHERE is_active = 1 AND price >= 2000");
    console.log(`  Tier 1|${t1[0].c}`);
    const t2 = await db.query("SELECT COUNT(*) as c FROM bikes WHERE is_active = 1 AND price >= 1000 AND price < 2000");
    console.log(`  Tier 2|${t2[0].c}`);
    const t3 = await db.query("SELECT COUNT(*) as c FROM bikes WHERE is_active = 1 AND price < 1000");
    console.log(`  Tier 3|${t3[0].c}`);
    
    console.log('By Source:|');
    const kl = await db.query("SELECT COUNT(*) as c FROM bikes WHERE is_active = 1 AND source_url LIKE '%kleinanzeigen%'");
    console.log(`  Kleinanzeigen|${kl[0].c}`);
    const bc = await db.query("SELECT COUNT(*) as c FROM bikes WHERE is_active = 1 AND source_url LIKE '%buycycle%'");
    console.log(`  Buycycle|${bc[0].c}`);
    
    console.log('Quality Metrics:|');
    const qual = await db.query("SELECT AVG(CASE WHEN condition_score IS NOT NULL THEN condition_score ELSE 0 END) as avg FROM bikes WHERE is_active = 1");
    console.log(`  Avg Quality|${Math.round(qual[0].avg * 10) / 10}`);
    
    const yearCov = await db.query("SELECT COUNT(CASE WHEN year IS NOT NULL THEN 1 END)*100.0/COUNT(*) as p FROM bikes WHERE is_active = 1");
    console.log(`  Year Coverage %|${Math.round(yearCov[0].p * 10) / 10}%`);
    
    const catCov = await db.query("SELECT COUNT(CASE WHEN category IS NOT NULL THEN 1 END)*100.0/COUNT(*) as p FROM bikes WHERE is_active = 1");
    console.log(`  Category Coverage %|${Math.round(catCov[0].p * 10) / 10}%`);
    
    console.log('Market History:|');
    const histTotal = await db.query("SELECT COUNT(*) as c FROM market_history");
    console.log(`  Total Records|${histTotal[0].c}`);
    const histHour = await db.query("SELECT COUNT(*) as c FROM market_history WHERE created_at > datetime('now', '-1 hour')");
    console.log(`  Records (last hour)|${histHour[0].c}`);
}

runReport().catch(console.error);