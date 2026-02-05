const { DatabaseManager } = require('../src/js/mysql-config');

async function run() {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    try {
        console.log('Adding is_hot column to bikes table...');
        await dbManager.db.exec(`ALTER TABLE bikes ADD COLUMN is_hot INTEGER DEFAULT 0`);
        console.log('Success: is_hot column added.');
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('Column is_hot already exists.');
        } else {
            console.error('Error adding column:', err);
        }
    }
}

run();
