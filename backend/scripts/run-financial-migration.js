const fs = require('fs');
const path = require('path');
const { DatabaseManager } = require('../src/js/mysql-config.js');

const MIGRATION_PATH = path.resolve(__dirname, '../migrations/add_telegram_sessions.sql');

async function runMigration() {
    console.log('Initializing DatabaseManager...');
    console.log('Migration Path:', MIGRATION_PATH);
    
    const dbManager = new DatabaseManager();

    try {
        await dbManager.initialize();
        console.log('Database initialized.');

        const migration = fs.readFileSync(MIGRATION_PATH, 'utf8');
        console.log('Migration Content:', migration);
        
        const statements = migration.split(';').filter(stmt => stmt.trim() !== '');

        for (const stmt of statements) {
            if (stmt.trim()) {
                try {
                    await dbManager.db.exec(stmt);
                    console.log('Executed:', stmt.substring(0, 50).replace(/\n/g, ' ') + '...');
                } catch (err) {
                    if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
                         console.log('Skipping existing column/table:', stmt.substring(0, 30) + '...');
                    } else {
                        console.error('Error executing statement:', err);
                    }
                }
            }
        }
        
        console.log('Migration completed.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

runMigration();
