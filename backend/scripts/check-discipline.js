const DatabaseManager = require('../database/db-manager');

async function checkDiscipline() {
    const db = new DatabaseManager();
    const dbHandle = db.getDatabase();

    console.log('=== DISCIPLINE VALUES ===');
    const disciplines = dbHandle.prepare('SELECT DISTINCT discipline FROM bikes').all();
    console.log(disciplines);

    console.log('\n=== SAMPLE BIKES WITH DISCIPLINE ===');
    const sample = dbHandle.prepare('SELECT id, name, discipline, category FROM bikes LIMIT 5').all();
    console.log(sample);

    process.exit(0);
}

checkDiscipline().catch(console.error);
