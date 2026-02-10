const BikesDatabase = require('./telegram-bot/bikes-database-node');

async function check() {
    const db = new BikesDatabase();
    await db.ensureInitialized();
    const rows = await db.allQuery('SELECT title, model, model_name FROM market_history WHERE brand = "Specialized" LIMIT 10');
    console.log('Specialized Samples:', rows);
}

check();
