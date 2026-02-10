const BikesDatabase = require('./telegram-bot/bikes-database-node');

async function check() {
    const db = new BikesDatabase();
    await db.ensureInitialized();
    const count = await db.getQuery('SELECT COUNT(*) as c FROM market_history');
    console.log('Market History Count:', count.c);
    
    if (count.c > 0) {
        const sample = await db.allQuery('SELECT * FROM market_history LIMIT 5');
        console.log('Sample:', sample);
    }
}

check();
