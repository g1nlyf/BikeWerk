const DatabaseManager = require('../database/db-manager');

async function verify() {
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    
    console.log('🔍 Verifying "bikes" table schema...');
    try {
        const bike = db.prepare(`
            SELECT brand, model, year, category, discipline, is_new, seller_type, delivery_option, guaranteed_pickup, quality_score
            FROM bikes 
            ORDER BY id DESC 
            LIMIT 1
        `).get();
        console.log('✅ "bikes" table query successful!');
        console.log('Latest bike record:', bike);
    } catch (err) {
        console.error('❌ "bikes" table query failed:', err.message);
    }

    console.log('\n🔍 Verifying "market_history" table schema...');
    try {
        const columns = db.pragma('table_info(market_history)');
        const columnNames = columns.map(c => c.name);
        console.log('Columns in market_history:', columnNames.join(', '));
        
        const expected = ['price_eur', 'source_url', 'category', 'year', 'frame_size', 'condition_score'];
        const missing = expected.filter(c => !columnNames.includes(c));
        
        if (missing.length === 0) {
            console.log('✅ "market_history" schema is correct (contains all expected fields).');
        } else {
            console.log('❌ "market_history" is missing columns:', missing);
        }
    } catch (err) {
        console.error('❌ "market_history" verification failed:', err.message);
    }
}

verify();
