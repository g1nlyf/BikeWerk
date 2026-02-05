const BikesDatabase = require('./telegram-bot/bikes-database-node');

async function check() {
    const db = new BikesDatabase();
    await db.ensureInitialized();
    const brands = await db.allQuery('SELECT brand, COUNT(*) as c FROM market_history GROUP BY brand ORDER BY c DESC LIMIT 20');
    console.log('Top Brands:', brands);
}

check();
