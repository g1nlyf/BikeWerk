const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function dumpBike() {
    try {
        const rows = await db.query('SELECT unified_data FROM bikes WHERE unified_data IS NOT NULL LIMIT 1');
        if (rows.length > 0) {
            console.log(rows[0].unified_data);
        } else {
            console.log('No bikes with unified_data found.');
        }
    } catch (e) {
        console.error(e);
    }
}

dumpBike();
