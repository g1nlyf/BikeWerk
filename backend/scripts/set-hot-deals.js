const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function setHotDeals() {
    console.log('🔥 Setting fake Hot Deals for testing...');
    
    // 1. Reset all
    await db.query('UPDATE bikes SET is_hot_offer = 0');
    
    // 2. Set top 5 ranking bikes as hot
    await db.query(`
        UPDATE bikes 
        SET is_hot_offer = 1, ranking_score = 0.95 
        WHERE id IN (
            SELECT id FROM bikes 
            WHERE is_active = 1 
            ORDER BY price ASC 
            LIMIT 5
        )
    `);
    
    const hotBikes = await db.query('SELECT id, brand, model, is_hot_offer, ranking_score FROM bikes WHERE is_hot_offer = 1');
    console.log('✅ Hot Deals Set:', hotBikes);
    process.exit(0);
}

setHotDeals();
