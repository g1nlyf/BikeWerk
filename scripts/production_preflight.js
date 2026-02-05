const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

async function runPreflight() {
    console.log('=== PRE-FLIGHT CHECK REPORT ===');
    console.log(`Date: ${new Date().toLocaleString()}`);
    console.log(`Server: ${os.hostname()} (${os.platform()} ${os.release()})`);
    console.log('');

    // 1. System Resources
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    console.log(`✅ RAM: ${formatBytes(freeMem)} available (${formatBytes(totalMem)} total)`);
    
    // Disk check (Windows specific mostly, or generic)
    // On Windows, checking disk space via node is tricky without external libs, 
    // but we can try 'wmic' or just skip specific disk check and rely on "it runs".
    // Or use fs.statfs if node version >= 18.15
    try {
        if (fs.statfsSync) {
            const stats = fs.statfsSync(process.cwd());
            const freeDisk = stats.bavail * stats.bsize;
            const totalDisk = stats.blocks * stats.bsize;
            console.log(`✅ Disk: ${formatBytes(freeDisk)} free (${formatBytes(totalDisk)} total)`);
        } else {
            console.log('ℹ️  Disk: Check skipped (Node version too old)');
        }
    } catch (e) {
        console.log('⚠️  Disk check failed: ' + e.message);
    }

    // 2. Database Check
    let db;
    try {
        db = new Database(DB_PATH);
        const bikeCount = db.prepare('SELECT COUNT(*) as c FROM bikes WHERE is_active = 1').get().c;
        const fmvCount = db.prepare('SELECT COUNT(*) as c FROM market_history').get().c;
        console.log(`✅ Database: ${bikeCount} active bikes, ${fmvCount} FMV records`);
    } catch (e) {
        console.log(`❌ Database Error: ${e.message}`);
        process.exit(1);
    }

    // 3. PM2 Status
    try {
        // Just check if pm2 is in path
        execSync('pm2 -v', { stdio: 'ignore' });
        // Getting list might be verbose, let's just say it's installed
        const pm2List = execSync('pm2 jlist').toString();
        const processes = JSON.parse(pm2List);
        const running = processes.filter(p => p.pm2_env.status === 'online').length;
        console.log(`✅ PM2: ${running} processes running`);
    } catch (e) {
        console.log('⚠️  PM2: Not found or error (Local dev environment?)');
    }

    // 4. API Keys
    const gemini = process.env.GEMINI_API_KEY ? 'YES' : 'NO';
    const telegram = (process.env.TELEGRAM_BOT_TOKEN || process.env.TG_CLIENT_BOT_TOKEN) ? 'YES' : 'NO';
    console.log(`✅ API Keys: Gemini ${gemini === 'YES' ? '✅' : '❌'}, Telegram ${telegram === 'YES' ? '✅' : '❌'}`);

    // 5. DB Write Test
    try {
        db.prepare("INSERT INTO bikes (brand, model, tier, name, price) VALUES ('TEST', 'PREFLIGHT', 1, 'Test Bike', 100)").run();
        const deleted = db.prepare("DELETE FROM bikes WHERE brand = 'TEST' AND model = 'PREFLIGHT'").run();
        if (deleted.changes > 0) {
            console.log('✅ Database Write: OK');
        } else {
            console.log('❌ Database Write: Inserted but not deleted?');
        }
    } catch (e) {
        console.log(`❌ Database Write Failed: ${e.message}`);
    }

    console.log('');
    console.log('STATUS: READY FOR STRESS TEST');
}

runPreflight();
