/**
 * run-migration.js
 * Запуск SQL миграций для БД
 */

const fs = require('fs');
const path = require('path');
const DatabaseManager = require('../database/db-manager');

async function runMigration(migrationFile) {
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    
    try {
        console.log(`📦 Running migration: ${migrationFile}`);
        
        const sqlPath = path.join(__dirname, '../migrations', migrationFile);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Разбиваем на отдельные statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
            try {
                db.prepare(statement).run();
                console.log(`✅ Executed: ${statement.substring(0, 60)}...`);
            } catch (err) {
                // Ignore "duplicate column" errors if we are running safely
                if (err.message.includes('duplicate column name')) {
                    console.log(`⚠️ Skipped (already exists): ${statement.substring(0, 60)}...`);
                } else {
                    throw err;
                }
            }
        }
        
        console.log(`🎉 Migration ${migrationFile} completed successfully!`);
    } catch (error) {
        console.error(`❌ Migration failed: ${error.message}`);
        process.exit(1);
    }
}

// Запуск
(async () => {
    const migrationFile = process.argv[2] || '003_enhanced_fmv_schema.sql';
    await runMigration(migrationFile);
    process.exit(0);
})();
