const BikesDatabase = require('./telegram-bot/bikes-database-node');
const db = new BikesDatabase();

async function check() {
    try {
        const res = await db.getQuery('SELECT count(*) as c FROM market_history');
        console.log(`Lake Count: ${res.c}`);
    } catch (e) {
        console.error(e);
    }
}

check();
