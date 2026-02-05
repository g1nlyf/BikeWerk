console.log("DEBUG: Script started execution");

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log("DEBUG: Standard modules loaded");

// Safe load of UnifiedHunter
let UnifiedHunter;
try {
    const hunterPath = path.resolve(__dirname, '../../telegram-bot/unified-hunter.js');
    console.log(`DEBUG: Loading UnifiedHunter from ${hunterPath}`);
    if (!fs.existsSync(hunterPath)) {
        console.error("ERROR: UnifiedHunter file not found at " + hunterPath);
        process.exit(1);
    }
    UnifiedHunter = require(hunterPath);
    console.log("DEBUG: UnifiedHunter loaded");
} catch (e) {
    console.error("ERROR loading UnifiedHunter:", e);
    process.exit(1);
}

// Load env
require('dotenv').config();

async function run() {
    console.log("🚀 Starting FMV-based Hunt...");

    // 1. Connect to DB
    const dbPath = path.resolve(__dirname, '../database/eubike.db');
    console.log(`DB Path: ${dbPath}`);
    
    if (!fs.existsSync(dbPath)) {
        console.error("ERROR: DB not found at " + dbPath);
        // Try absolute path as fallback or relative to CWD
        // But better-sqlite3 needs correct path
    }

    let db;
    try {
        db = new Database(dbPath, { readonly: true });
        console.log("DB Connected");
    } catch(e) {
        console.error("DB Connection Error:", e);
        return;
    }
    
    // 2. Get FMV models
    console.log("Fetching target models from FMV history...");
    
    let rows = [];
    try {
        rows = db.prepare(`
            SELECT brand, model, AVG(price) as avg_price, COUNT(*) as c 
            FROM market_history 
            WHERE price > 500 
            AND model IS NOT NULL 
            AND brand IS NOT NULL
            GROUP BY brand, model 
            HAVING c >= 2
            ORDER BY RANDOM() 
            LIMIT 10
        `).all();
    } catch (e) {
        console.error("Error querying market_history:", e.message);
        // Try fallback query if schema differs
        try {
            console.log("Retrying with simpler query...");
            rows = db.prepare(`SELECT * FROM market_history LIMIT 10`).all();
            console.log("Fallback rows:", rows.length);
        } catch(e2) {
            console.error("Fallback failed:", e2.message);
        }
    }

    if (rows.length === 0) {
        console.log("No FMV models found!");
        return;
    }

    console.log(`Found ${rows.length} FMV models to hunt:`);
    rows.forEach(r => console.log(` - ${r.brand} ${r.model} (Avg: ${Math.round(r.avg_price)}€, Count: ${r.c})`));

    db.close();

    // 3. Initialize Hunter
    console.log("Initializing Hunter instance...");
    const hunter = new UnifiedHunter();
    await hunter.ensureInitialized();
    console.log("Hunter initialized.");

    // 4. Hunt Loop
    for (const row of rows) {
        if (!row.brand || !row.model) continue;

        console.log(`\n${'='.repeat(40)}`);
        console.log(`🎯 Hunting: ${row.brand} ${row.model}`);
        
        const minPrice = Math.max(500, Math.round((row.avg_price || 2000) * 0.5));
        const maxPrice = Math.round((row.avg_price || 2000) * 1.2);
        
        const url = hunter.urlBuilder.buildSearchURL({
            brand: row.brand,
            model: row.model,
            minPrice: minPrice,
            maxPrice: maxPrice,
            shippingRequired: true
        });
        
        console.log(`[URL] ${url}`);
        
        try {
            const listings = await hunter.fetchMarketData(url, 'MTB');
            
            if (listings && listings.length > 0) {
                const filtered = await hunter.applyFunnelFilter(listings);
                console.log(`[Stats] Found: ${listings.length}, Passed Filter: ${filtered.length}`);
                
                let processedForThisModel = 0;
                for (const item of filtered) {
                     if (processedForThisModel >= 1) break; // Just 1 per model for now

                     console.log(`Processing: ${item.title} (${item.price})`);
                     const success = await hunter.processListing(item.link);
                     if (success) processedForThisModel++;
                     
                     await new Promise(r => setTimeout(r, 2000));
                }
            } else {
                console.log("⚠️ No listings found.");
            }
        } catch (e) {
            console.error(`❌ Error hunting ${row.brand} ${row.model}:`, e.message);
        }
        
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log("\n🏁 Hunt Complete.");
}

run().catch(e => console.error("Fatal Error in run():", e));
