const { DatabaseManager } = require('./src/js/mysql-config');

async function check() {
    const db = new DatabaseManager();
    await db.initialize();
    try {
        const rows = await db.query("PRAGMA table_info(bikes)");
        console.log("Columns:", rows.map(r => r.name));
    } catch (e) {
        console.error(e);
    }
}

check();
