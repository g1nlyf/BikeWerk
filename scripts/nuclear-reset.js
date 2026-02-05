const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');
const UPLOADS_DIR_1 = path.resolve(__dirname, '../backend/public/images/bikes'); // Using the one we saw in file structure
const UPLOADS_DIR_2 = path.resolve(__dirname, '../public/uploads/bikes'); // As requested
const BACKEND_UPLOADS = path.resolve(__dirname, '../backend/uploads'); // As requested

console.log('☢️  INITIATING NUCLEAR RESET ☢️');
console.log(`Target DB: ${DB_PATH}`);

async function wipeDB() {
    if (!fs.existsSync(DB_PATH)) {
        console.log('⚠️  DB file not found, skipping DB wipe.');
        return;
    }

    try {
        const filebuffer = fs.readFileSync(DB_PATH);
        const SQL = await initSqlJs();
        const db = new SQL.Database(filebuffer);

        const tablesToWipe = [
            'bikes',
            'bike_images', // if exists
            'market_history', // if exists
            'orders', // or shop_orders
            'bot_tasks',
            'analytics_events', // if exists
            // 'users' - maybe keep users? User said "DB Wipe: bikes, bike_images..."
            // Strict adherence to list: bikes, bike_images, market_history, orders, bot_tasks, analytics_events.
        ];

        console.log('🧹 Wiping tables...');
        db.exec('BEGIN TRANSACTION');
        
        for (const table of tablesToWipe) {
            try {
                // Check if table exists
                const res = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
                if (res.length > 0) {
                    db.exec(`DELETE FROM ${table}`);
                    // Reset autoincrement
                    db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
                    console.log(`   - Cleared ${table}`);
                } else {
                    console.log(`   - Table ${table} not found (skipping)`);
                }
            } catch (e) {
                console.warn(`   ⚠️ Failed to wipe ${table}: ${e.message}`);
            }
        }

        db.exec('COMMIT');
        
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
        console.log('✅ DB Wipe Complete.');
        db.close();

    } catch (e) {
        console.error('❌ DB Wipe Failed:', e);
    }
}

function wipeDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    console.log(`🧹 Wiping directory: ${dirPath}`);
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const curPath = path.join(dirPath, file);
            // Check if it's a directory (like id1, id2...)
            if (fs.lstatSync(curPath).isDirectory()) {
                fs.rmSync(curPath, { recursive: true, force: true });
                console.log(`   - Deleted folder ${file}`);
            } else {
                fs.unlinkSync(curPath);
            }
        }
    } catch (e) {
        console.error(`   ⚠️ Failed to wipe directory ${dirPath}: ${e.message}`);
    }
}

async function run() {
    await wipeDB();
    wipeDirectory(UPLOADS_DIR_1);
    wipeDirectory(UPLOADS_DIR_2);
    wipeDirectory(BACKEND_UPLOADS);
    console.log('☢️  NUCLEAR RESET COMPLETED ☢️');
}

run();
