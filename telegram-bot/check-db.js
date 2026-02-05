const BikesDatabase = require('./bikes-database-node');

async function checkTables() {
    const db = new BikesDatabase();
    await db.ensureInitialized();
    
    try {
        const tables = await db.allQuery("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables:', tables.map(t => t.name));
        
        // Check orders schema if it exists
        if (tables.some(t => t.name === 'orders')) {
            const schema = await db.allQuery("PRAGMA table_info(orders)");
            console.log('Orders Schema:', schema);
        } else {
            console.log('❌ Table "orders" does not exist.');
        }
    } catch (e) {
        console.error(e);
    }
}

checkTables();