const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const sourcePath = path.resolve(__dirname, '../backend/database/eubike.db');
const targetPath = path.resolve(__dirname, '../backend/database/eubike_test.db');

console.log(`Source: ${sourcePath}`);
console.log(`Target: ${targetPath}`);

if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    console.log('Removed existing test DB');
}

const sourceDb = new Database(sourcePath, { readonly: true });
const targetDb = new Database(targetPath);

// Get all schema creation SQL
const tables = sourceDb.prepare("SELECT sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger') AND sql IS NOT NULL").all();

targetDb.transaction(() => {
    for (const entry of tables) {
        // Skip sqlite_sequence and internal tables if any
        if (!entry.sql.includes('sqlite_sequence')) {
            try {
                targetDb.exec(entry.sql);
            } catch (e) {
                console.error(`Error executing SQL: ${entry.sql.substring(0, 50)}...`, e.message);
            }
        }
    }
})();

console.log('✅ Test DB schema initialized from source DB');
