const { DatabaseManager } = require('./backend/src/js/mysql-config.js');

async function checkTables() {
    const db = new DatabaseManager();
    try {
        await db.initialize();
        const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables in local DB:', tables.map(t => t.name).join(', '));
        
        // Check crm_orders specifically
        const crmOrders = await db.query("SELECT COUNT(*) as count FROM crm_orders");
        console.log('Orders in crm_orders:', crmOrders[0].count);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        // await db.close(); // DatabaseManager doesn't have close()? Let's check.
    }
}

checkTables();
