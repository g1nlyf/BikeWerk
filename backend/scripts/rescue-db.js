const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const corruptDbPath = path.resolve(__dirname, '../database/eubike.db');
const newDbPath = path.resolve(__dirname, '../database/eubike.db.new');

if (fs.existsSync(newDbPath)) {
    fs.unlinkSync(newDbPath);
}

const dbOld = new sqlite3.Database(corruptDbPath, sqlite3.OPEN_READONLY);
const dbNew = new sqlite3.Database(newDbPath);

function runQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getAll(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function run() {
    console.log('🚑 Starting Database Rescue (Async Fixed)...');

    // Get all tables
    dbOld.all("SELECT name, sql FROM sqlite_master WHERE type='table'", async (err, tables) => {
        if (err) {
            console.error('Critical: Cannot read sqlite_master:', err);
            return;
        }

        // We use a sequential approach to avoid locking issues
        for (const table of tables) {
            if (table.name === 'sqlite_sequence') continue;
            
            console.log(`\n📦 Rescuing table: ${table.name}`);
            
            // 1. Create table in new DB
            try {
                await runQuery(dbNew, table.sql);
                console.log(`   ✅ Schema created`);
            } catch (e) {
                console.error(`   ❌ Failed to create schema: ${e.message}`);
                continue;
            }

            // 2. Copy data
            try {
                const rows = await getAll(dbOld, `SELECT * FROM "${table.name}"`);
                console.log(`   📖 Found ${rows.length} rows`);
                
                if (rows.length > 0) {
                    const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(',');
                    const placeholders = Object.keys(rows[0]).map(() => '?').join(',');
                    
                    await runQuery(dbNew, 'BEGIN TRANSACTION');
                    
                    const stmt = dbNew.prepare(`INSERT INTO "${table.name}" (${cols}) VALUES (${placeholders})`);
                    
                    let inserted = 0;
                    let errors = 0;
                    
                    for (const row of rows) {
                        try {
                            await new Promise((resolve, reject) => {
                                stmt.run(Object.values(row), (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            });
                            inserted++;
                        } catch (e) {
                            errors++;
                        }
                    }
                    
                    stmt.finalize();
                    await runQuery(dbNew, 'COMMIT');
                    console.log(`   ✅ Copied ${inserted} rows (${errors} failed)`);
                }
            } catch (e) {
                console.error(`   ❌ Failed to read data (skipping table): ${e.message}`);
            }
        }
        
        // Recreate indexes
        dbOld.all("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL", async (err, indexes) => {
            if (!err) {
                console.log('\n🔨 Recreating indexes...');
                for (const idx of indexes) {
                    try {
                        await runQuery(dbNew, idx.sql);
                    } catch (e) {
                         // Ignore
                    }
                }
                console.log('   ✅ Indexes processed');
            }
            
            console.log('\n🏁 Rescue complete.');
            dbOld.close();
            dbNew.close(() => {
                console.log('🔄 Swapping databases...');
                const backup = corruptDbPath + '.bak-' + Date.now();
                fs.renameSync(corruptDbPath, backup);
                fs.renameSync(newDbPath, corruptDbPath);
                console.log(`✅ Database restored! Backup saved to ${backup}`);
            });
        });
    });
}

run();
