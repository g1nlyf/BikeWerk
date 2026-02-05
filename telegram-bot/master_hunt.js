const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const UnifiedHunter = require('./unified-hunter');
const BikesDatabase = require('./bikes-database-node');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const TARGET_COUNT = 4; // 1 per category
const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');

async function runMasterHunt() {
    console.log('👑 STARTING MASTER HUNT (Populate Catalog)...');
    
    // 1. Initialize
    const logger = (msg) => console.log(`[MASTER] ${msg}`);
    const hunter = new UnifiedHunter({ logger });
    await hunter.ensureInitialized();
    
    // Force permissive valuation
    hunter.valuationService.evaluateSniperRule = async function(price, fmv) {
        return { isHit: true, reason: 'Master Hunt Override', priority: 'high' };
    };
    
    // 2. Define Targets (One for each main category)
    const targets = [
        { query: 'rose backroad', category: 'gravel' },
        { query: 'canyon ultimate', category: 'road' },
        { query: 'specialized levo', category: 'emtb' },
        { query: 'santa cruz megatower', category: 'mtb' }
    ];
    
    let processed = 0;
    
    for (const t of targets) {
        console.log(`\n🎯 Hunting Category: ${t.category.toUpperCase()} (${t.query})`);
        
        // Custom search URL for this target
        const typeParam = mapCategory(t.category);
        const typeSuffix = typeParam ? `+fahrraeder.type_s:${typeParam}` : '';
        const url = `https://www.kleinanzeigen.de/s-fahrraeder/${t.query.replace(/\s+/g, '-')}/k0c217${typeSuffix}`;
        
        try {
            const html = await hunter.fetchHtml(url);
            const items = hunter.parseSearchItems(html);
            
            if (items.length > 0) {
                const item = items[0]; // Pick first
                console.log(`   Found: ${item.title} (${item.price})`);
                
                // Process
                await hunter.processListing(item.link);
                processed++;
                
                // Force Activation
                await activateLastBike();
                
            } else {
                console.log('   ⚠️ No items found.');
            }
        } catch (e) {
            console.error(`   ❌ Error: ${e.message}`);
        }
        
        // Small delay between categories
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log(`\n✅ Master Hunt Finished. Processed: ${processed}/${targets.length}`);
}

function mapCategory(cat) {
    if (cat === 'mtb') return 'mountainbike';
    if (cat === 'road') return 'rennrad';
    if (cat === 'emtb') return 'pedelec';
    return ''; // gravel often has no specific type or mixed
}

async function activateLastBike() {
    return new Promise((resolve) => {
        const db = new sqlite3.Database(DB_PATH);
        db.run("UPDATE bikes SET is_active = 1, needs_audit = 0 WHERE id = (SELECT MAX(id) FROM bikes)", function(err) {
            if (err) console.error('   ❌ Activation failed:', err.message);
            else console.log(`   ✅ Activated Bike ID (Last Inserted). Changes: ${this.changes}`);
            db.close();
            resolve();
        });
    });
}

runMasterHunt();
