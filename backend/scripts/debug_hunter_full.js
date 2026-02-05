const UnifiedHunter = require('../../telegram-bot/unified-hunter.js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Register ts-node if needed
try {
    require('ts-node').register({ transpileOnly: true });
} catch (e) {}

// Logging setup
const logFile = path.resolve(__dirname, 'hunter_debug.log');
fs.writeFileSync(logFile, ''); // Clear log

function log(msg, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${type}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

async function runDebug() {
    log('🚀 STARTING DEBUG HUNTER SESSION');
    
    // 1. Check DB
    const dbPath = path.resolve(__dirname, '../database/eubike.db');
    log(`Checking DB at: ${dbPath}`);
    if (!fs.existsSync(dbPath)) {
        log('❌ DB file not found!', 'ERROR');
        process.exit(1);
    }
    
    const db = new Database(dbPath, { readonly: true });
    try {
        const tableInfo = db.pragma('table_info(bikes)');
        const columns = tableInfo.map(c => c.name);
        log(`DB Columns (bikes): ${columns.join(', ')}`);
        
        const required = ['fmv', 'hotness_score', 'condition_grade', 'logistics_priority'];
        const missing = required.filter(c => !columns.includes(c));
        if (missing.length > 0) {
            log(`❌ Missing columns in 'bikes': ${missing.join(', ')}`, 'ERROR');
        } else {
            log('✅ Schema check passed for bikes');
        }

        // Check market_history schema
        try {
            const marketInfo = db.pragma('table_info(market_history)');
            const marketCols = marketInfo.map(c => c.name);
            log(`DB Columns (market_history): ${marketCols.join(', ')}`);
            if (!marketCols.includes('title')) {
                log('❌ Missing "title" column in market_history!', 'ERROR');
            }
        } catch (e) {
            log(`❌ Could not check market_history: ${e.message}`, 'WARN');
        }

    } catch (e) {
        log(`❌ DB Check failed: ${e.message}`, 'ERROR');
    }
    db.close();

    // 2. Initialize Hunter
    log('Initializing UnifiedHunter...');
    const hunter = new UnifiedHunter({ 
        logger: (msg) => log(msg, 'HUNTER') 
    });
    
    try {
        await hunter.ensureInitialized();
        log('✅ Hunter initialized');
    } catch (e) {
        log(`❌ Hunter init failed: ${e.message}`, 'ERROR');
        process.exit(1);
    }

    // 3. Define Test Targets
    // Using broad search terms to ensure we find *something*
    const targets = [
        {
            name: "Enduro Bikes (General)",
            url: "https://www.kleinanzeigen.de/s-fahrraeder/enduro/k0c217+fahrraeder.type_s:mountainbike+fahrraeder.versand_s:ja"
        }
    ];

    log(`🎯 Starting Hunt for ${targets.length} targets...`);

    for (const t of targets) {
        log(`\n🔎 HUNTING TARGET: ${t.name}`);
        log(`URL: ${t.url}`);
        
        try {
            // Fetch
            log('Fetching market data...');
            const listings = await hunter.fetchMarketData(t.url, 'MTB');
            log(`Found ${listings.length} raw listings`);
            
            if (listings.length === 0) {
                log('⚠️ No listings found - might be blocked or URL invalid', 'WARN');
                continue;
            }

            // Filter
            log('Applying Funnel Filter...');
            const filtered = await hunter.applyFunnelFilter(listings);
            log(`Passed filter: ${filtered.length}`);
            
            // Process up to 3 items to increase chance of success/failure variety
            const itemsToProcess = filtered.slice(0, 3);
            
            if (itemsToProcess.length > 0) {
                for (let i = 0; i < itemsToProcess.length; i++) {
                    const item = itemsToProcess[i];
                    log(`\n🚀 Processing Item ${i+1}/${itemsToProcess.length}: ${item.title} (${item.link})`);
                    
                    try {
                        const success = await hunter.processListing(item.link);
                        if (success) {
                            log('✅ Item processed successfully');
                        } else {
                            log('❌ Item processing returned false (skipped or failed)', 'ERROR');
                        }
                    } catch (innerErr) {
                        log(`❌ Error processing listing: ${innerErr.message}\n${innerErr.stack}`, 'ERROR');
                    }
                }
            } else {
                log('⚠️ No items passed the filter', 'WARN');
            }
            
        } catch (e) {
            log(`❌ Error in hunt loop: ${e.message}\n${e.stack}`, 'ERROR');
        }
        
        await new Promise(r => setTimeout(r, 2000));
    }
    
    log('\n🏁 DEBUG SESSION COMPLETE');
}

runDebug().catch(e => log(`FATAL: ${e.message}`, 'ERROR'));
