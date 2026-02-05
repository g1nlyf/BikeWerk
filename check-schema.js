const { DatabaseManager } = require('./backend/src/js/mysql-config.js');

async function checkSchema() {
    const db = new DatabaseManager();
    try {
        await db.initialize();
        const tables = ['payments', 'shipments', 'tasks', 'documents', 'order_status_events', 'crm_orders'];
        for (const table of tables) {
            const schema = await db.query(`SELECT sql FROM sqlite_master WHERE name='${table}'`);
            if (schema && schema[0]) {
                console.log(`${table} schema:`, schema[0].sql);
            } else {
                console.log(`${table} schema: NOT FOUND`);
            }
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

checkSchema();
