const ProfitMaximizer = require('../src/services/profit-maximizer');
const CatalogManager = require('../src/services/catalog-manager');
const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function test() {
    console.log('🧪 Testing Sprint 3: Profit Maximizer & Catalog Manager');

    // 1. Test ProfitMaximizer
    const bike = {
        brand: 'Specialized',
        model: 'Stumpjumper',
        tier: 1,
        condition: 'excellent',
        fmv: 3000,
        price: 2000 // Purchase price
    };

    console.log('\n💎 Testing Profit Maximizer...');
    const pricing = await ProfitMaximizer.calculateOptimalPrice(bike);
    console.log('Bike:', bike.brand, bike.model, 'FMV:', bike.fmv, 'Cost:', bike.price);
    console.log('Optimal Pricing:', JSON.stringify(pricing, null, 2));
    
    // Verify psychological pricing
    // e.g. 2990.
    if (String(pricing.optimal_price).endsWith('90')) {
        console.log('✅ Psychological pricing applied correctly (ends with 90).');
    } else {
        console.log('⚠️ Psychological pricing check warning:', pricing.optimal_price);
    }

    // 2. Test CatalogManager
    console.log('\n📚 Testing Catalog Manager...');
    
    const composition = await CatalogManager.getCatalogComposition();
    console.log('Current Composition:', composition);
    
    // Run rebalance (might not prune if not over limit)
    await CatalogManager.rebalanceCatalog();
    
    // Test Pruning Logic explicitly
    console.log('Inserting old Tier 3 bike for pruning test...');
    const res = await db.query(`
        INSERT INTO bikes (name, brand, model, price, tier, is_active, created_at, views)
        VALUES ('Test Bike', 'TestBrand', 'TestModel', 500, 3, 1, datetime('now', '-40 days'), 5)
    `);
    
    // Force prune
    await CatalogManager.pruneOldTier3();
    
    // Verify it is inactive
    const check = await db.query(`SELECT is_active FROM bikes WHERE brand='TestBrand' AND model='TestModel'`);
    if (check.length > 0 && check[0].is_active === 0) {
        console.log('✅ Pruning successful.');
    } else {
        console.log('❌ Pruning failed.', check);
    }
    
    // Cleanup
    await db.query(`DELETE FROM bikes WHERE brand='TestBrand'`);
    
    process.exit(0);
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});
