/**
 * Test SmartModelSelector query directly
 */
const DatabaseManager = require('../database/db-manager');

async function testQuery() {
    const db = new DatabaseManager();

    // Test 1: Simple query
    console.log('=== TEST 1: Basic COUNT ===');
    try {
        const r1 = db.getDatabase().prepare('SELECT COUNT(*) as count FROM bikes').all();
        console.log('✅ Basic count:', r1[0].count);
    } catch (e) {
        console.error('❌ Basic count failed:', e.message);
    }

    // Test 2: Query with category
    console.log('\n=== TEST 2: With category ===');
    try {
        const r2 = db.getDatabase().prepare('SELECT COUNT(*) as count FROM bikes WHERE is_active = 1 AND category = ?').all(['mtb']);
        console.log('✅ With category:', r2[0].count);
    } catch (e) {
        console.error('❌ With category failed:', e.message);
    }

    // Test 3: Query with discipline
    console.log('\n=== TEST 3: With discipline ===');
    try {
        const r3 = db.getDatabase().prepare('SELECT COUNT(*) as count FROM bikes WHERE is_active = 1 AND discipline = ?').all(['enduro']);
        console.log('✅ With discipline:', r3[0].count);
    } catch (e) {
        console.error('❌ With discipline failed:', e.message);
    }

    // Test 4: Full analyzeModelGaps query
    console.log('\n=== TEST 4: Full query with CAST ===');
    try {
        const query = `
            SELECT 
                COUNT(*) as count,
                frame_size,
                CAST(price_eur AS INTEGER) / 500 * 500 as price_bucket
            FROM bikes 
            WHERE is_active = 1
              AND brand = ?
              AND model LIKE ?
              AND category = ?
              AND discipline = ?
            GROUP BY frame_size, price_bucket
        `;
        const r4 = db.getDatabase().prepare(query).all(['YT', '%Capra%', 'mtb', 'enduro']);
        console.log('✅ Full query:', r4);
    } catch (e) {
        console.error('❌ Full query failed:', e.message);
        console.error('   Stack:', e.stack);
    }

    // Test 5: Check if price_eur exists
    console.log('\n=== TEST 5: Check price columns ===');
    try {
        const r5 = db.getDatabase().prepare('SELECT id, price, price_eur FROM bikes LIMIT 3').all();
        console.log('✅ Price columns:', r5);
    } catch (e) {
        console.error('❌ Price columns failed:', e.message);
    }

    process.exit(0);
}

testQuery().catch(console.error);
