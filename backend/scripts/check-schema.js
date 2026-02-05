const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function checkSchema() {
    await db.initialize();
    try {
        const result = await db.query("SELECT * FROM pragma_table_info('bikes')");
        console.log('Columns in bikes table:');
        result.forEach(col => console.log(`- ${col.name} (${col.type})`));
        
        const hasOriginalUrl = result.some(col => col.name === 'original_url');
        console.log(`original_url exists: ${hasOriginalUrl}`);
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
