const BikesDatabase = require('./bikes-database-node');

async function checkSchema() {
    const db = new BikesDatabase();
    await db.ensureInitialized();
    const info = await db.allQuery('PRAGMA table_info(bikes)');
    console.log('Columns in bikes table:');
    info.forEach(c => console.log(`- ${c.name} (${c.type})`));
}

checkSchema();
