const DatabaseManager = require('../database/db-manager');

async function checkBikes() {
    const db = new DatabaseManager();
    const dbHandle = db.getDatabase();

    console.log('=== TOTAL BIKES ===');
    const count = dbHandle.prepare('SELECT COUNT(*) as count FROM bikes').all();
    console.log('Count:', count[0].count);

    console.log('\n=== LATEST 5 BIKES ===');
    const latest = dbHandle.prepare('SELECT id, name, brand, model, category, discipline, created_at FROM bikes ORDER BY id DESC LIMIT 5').all();
    console.log(latest);

    console.log('\n=== CATEGORY DISTRIBUTION ===');
    const cats = dbHandle.prepare('SELECT category, COUNT(*) as count FROM bikes GROUP BY category').all();
    console.log(cats);

    process.exit(0);
}

checkBikes().catch(console.error);
