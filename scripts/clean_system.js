const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
const IMAGES_DIR = path.resolve(__dirname, '../backend/public/images/bikes');

async function cleanSystem() {
    console.log('🧹 STARTING SYSTEM CLEANUP...');

    // 1. Clean Database
    console.log('   Running DB Purge...');
    await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) return reject(err);
        });

        db.serialize(() => {
            db.run("DELETE FROM bikes", (err) => {
                if (err) console.error('Error clearing bikes:', err);
                else console.log('   ✅ Table `bikes` cleared.');
            });
            db.run("DELETE FROM market_history", (err) => {
                if (err) console.error('Error clearing market_history:', err);
                else console.log('   ✅ Table `market_history` cleared.');
            });
            db.run("DELETE FROM search_stats", (err) => {
                if (err) console.error('Error clearing search_stats:', err);
                else console.log('   ✅ Table `search_stats` cleared.');
            });
            // Reset sequences if needed, but not critical
        });

        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // 2. Clean Images
    console.log('   Cleaning Image Directory...');
    if (fs.existsSync(IMAGES_DIR)) {
        const files = fs.readdirSync(IMAGES_DIR);
        let count = 0;
        for (const file of files) {
            const curPath = path.join(IMAGES_DIR, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                fs.rmSync(curPath, { recursive: true, force: true });
                count++;
            } else {
                fs.unlinkSync(curPath);
                count++;
            }
        }
        console.log(`   ✅ Deleted ${count} files/directories in ${IMAGES_DIR}`);
    } else {
        console.log('   ⚠️ Image directory does not exist.');
    }

    console.log('✨ SYSTEM CLEANUP COMPLETE.');
}

cleanSystem().catch(console.error);
