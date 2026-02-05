const DatabaseManager = require('../database/db-manager');

async function checkSchema() {
    const db = new DatabaseManager();
    const dbHandle = db.getDatabase();

    console.log('=== BIKES TABLE SCHEMA ===');
    const tableInfo = dbHandle.prepare('PRAGMA table_info(bikes)').all();
    tableInfo.forEach(col => {
        console.log(`${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });

    console.log('\n=== SAMPLE DATA ===');
    const sample = dbHandle.prepare('SELECT * FROM bikes LIMIT 1').all();
    if (sample.length > 0) {
        console.log(Object.keys(sample[0]));
    }

    process.exit(0);
}

checkSchema().catch(console.error);
