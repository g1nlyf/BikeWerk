const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const UnifiedHunter = require('./unified-hunter');

// Configuration
const DB_PATH_REL = '../backend/database/eubike.db';
const DB_PATH = path.resolve(__dirname, DB_PATH_REL);
const IMAGES_DIR = path.resolve(__dirname, '../backend/public/images/bikes');

async function runDiagnostics() {
    console.log('🔍 STARTING REMOTE DIAGNOSTICS');
    console.log('------------------------------------------------');
    console.log(`📂 CWD: ${process.cwd()}`);
    console.log(`📂 __dirname: ${__dirname}`);
    console.log(`📂 DB Path (Resolved): ${DB_PATH}`);
    console.log(`📂 Images Dir (Resolved): ${IMAGES_DIR}`);
    
    // 1. Check DB File
    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ DB File NOT FOUND at ' + DB_PATH);
    } else {
        const stats = fs.statSync(DB_PATH);
        console.log(`✅ DB File exists (${stats.size} bytes, Last Mod: ${stats.mtime.toISOString()})`);
    }

    // 2. Check DB Content
    const db = new sqlite3.Database(DB_PATH);
    const activeBikes = await new Promise((resolve, reject) => {
        db.all("SELECT id, name, price, is_active, created_at FROM bikes WHERE is_active = 1 ORDER BY id DESC LIMIT 5", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    
    console.log(`\n📊 Active Bikes in DB: ${activeBikes.length}`);
    activeBikes.forEach(b => {
        console.log(`   - [ID ${b.id}] ${b.name} (€${b.price})`);
    });

    // 3. Check Images for Last Bike
    if (activeBikes.length > 0) {
        const lastId = activeBikes[0].id;
        const imgPath = path.join(IMAGES_DIR, `id${lastId}`);
        if (fs.existsSync(imgPath)) {
            const files = fs.readdirSync(imgPath);
            console.log(`\n🖼️ Images for ID ${lastId}: Found ${files.length} files`);
            console.log(`   Path: ${imgPath}`);
        } else {
            console.error(`\n❌ Images for ID ${lastId} NOT FOUND at ${imgPath}`);
        }
    }

    // 4. Check API Response (Local)
    console.log('\n🌐 Checking Local API (http://localhost:8082/api/bikes)...');
    try {
        const res = await axios.get('http://localhost:8082/api/bikes');
        console.log(`   Status: ${res.status}`);
        console.log(`   Total Bikes Returned: ${res.data.bikes ? res.data.bikes.length : 0}`);
        if (res.data.bikes && res.data.bikes.length > 0) {
            console.log(`   First Bike Image URL: ${res.data.bikes[0].image}`);
        }
    } catch (e) {
        console.error(`   ❌ API Error: ${e.message}`);
    }

    // 5. Run a Mini Hunt (1 item)
    console.log('\n🏹 RUNNING MINI HUNT TEST...');
    const hunter = new UnifiedHunter({ logger: (msg) => console.log(`   [HUNTER] ${msg}`) });
    await hunter.ensureInitialized();
    
    // Force permissive valuation
    hunter.valuationService.evaluateSniperRule = async () => ({ isHit: true, reason: 'Test', priority: 'high' });
    
    // Hunt a specific query
    const testUrl = 'https://www.kleinanzeigen.de/s-fahrraeder/specialized-tarmac/k0c217';
    console.log(`   Target: ${testUrl}`);
    
    try {
        const html = await hunter.fetchHtml(testUrl);
        const items = hunter.parseSearchItems(html);
        if (items.length > 0) {
            const target = items[0];
            console.log(`   Found: ${target.title}`);
            await hunter.processListing(target.link);
            console.log('   ✅ Processed Listing.');
            
            // Activate it
            await new Promise(r => {
                db.run("UPDATE bikes SET is_active = 1 WHERE id = (SELECT MAX(id) FROM bikes)", function(err) {
                    if(!err) console.log(`   ✅ Activated Bike (Rows: ${this.changes})`);
                    r();
                });
            });
            
        } else {
            console.log('   ⚠️ No items found in search.');
        }
    } catch (e) {
        console.error(`   ❌ Hunt Error: ${e.message}`);
    }

    db.close();
    console.log('\n✅ DIAGNOSTICS COMPLETE');
}

runDiagnostics();
