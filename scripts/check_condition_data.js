const BikesDatabase = require('../telegram-bot/bikes-database-node');
const db = new BikesDatabase();

async function check() {
    await db.ensureInitialized();
    const bike = await db.getQuery('SELECT * FROM bikes ORDER BY id DESC LIMIT 1');
    console.log('Latest Bike ID:', bike.id);
    console.log('Name:', bike.name);
    console.log('Condition Score:', bike.condition_score);
    console.log('Condition Grade:', bike.condition_grade);
    console.log('Condition Penalty:', bike.condition_penalty);
    console.log('Condition Reason:', bike.condition_reason);
    console.log('Initial Quality Class:', bike.initial_quality_class);
    console.log('Condition Report (JSON):', bike.condition_report);
}

check();
