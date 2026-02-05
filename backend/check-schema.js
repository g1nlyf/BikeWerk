const { DatabaseManager } = require('./src/js/mysql-config');
const db = new DatabaseManager();

(async () => {
    try {
        const schema = await db.query("PRAGMA table_info(market_history)");
        console.log(schema);
    } catch (e) {
        console.error(e);
    }
})();