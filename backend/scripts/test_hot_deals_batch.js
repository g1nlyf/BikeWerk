const HotDealHunter = require('../scrapers/HotDealHunter');
const { DatabaseManager } = require('../src/js/mysql-config');
const fs = require('fs');
const path = require('path');

async function runTest() {
    console.log('🚀 Starting Hot Deal Batch Test...');
    
    // 1. Initialize Hunter
    const hunter = new HotDealHunter({ limit: 5 });
    
    // 2. Run Hunt
    const results = await hunter.hunt();
    
    console.log(`\n📊 Test completed. Processed ${results.length} bikes.`);
    
    // 3. Verify Data in DB
    const db = new DatabaseManager();
    const dbResults = await db.query(`
        SELECT id, brand, model, condition_score, condition_class, quality_score, is_hot_offer, gallery, source_url 
        FROM bikes 
        WHERE is_hot_offer = 1 
        ORDER BY updated_at DESC 
        LIMIT 10
    `);

    console.log('\n🔍 DB Verification (Latest Hot Offers):');
    console.table(dbResults.map(b => ({
        id: b.id,
        brand: b.brand,
        model: b.model,
        cond_score: b.condition_score,
        cond_class: b.condition_class,
        quality: b.quality_score,
        hot: b.is_hot_offer,
        gallery_len: b.gallery ? JSON.parse(b.gallery).length : 0
    })));

    // 4. Export JSON for audit
    const exportPath = path.join(__dirname, '../../logs/hot_deals_audit.json');
    fs.writeFileSync(exportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        processed: results,
        db_verification: dbResults
    }, null, 2));
    
    console.log(`\n💾 Audit log saved to: ${exportPath}`);
    process.exit(0);
}

runTest().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
