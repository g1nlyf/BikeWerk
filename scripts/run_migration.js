
const BikesDatabase = require('../telegram-bot/bikes-database-node');
const db = new BikesDatabase();

async function migrate() {
    console.log('🔄 Running Migrations...');
    await db.ensureInitialized();
    console.log('✅ Migrations Completed.');
}

migrate();
