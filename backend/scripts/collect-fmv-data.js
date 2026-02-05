/**
 * FMV Data Collection Script
 * 
 * Collects market prices from multiple sources for whitelist models.
 * Run on server after deploy (can take hours).
 * 
 * Usage: node scripts/collect-fmv-data.js [--dry-run] [--limit=10]
 */

const Database = require('better-sqlite3');
const path = require('path');
const puppeteer = require('puppeteer');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

// Brand/Model whitelist
const BRAND_MODELS = {
    'MTB DH': {
        brands: ['Santa Cruz', 'Trek', 'Specialized', 'Canyon', 'YT', 'Commencal', 'Scott', 'Cube', 'Giant', 'Propain'],
        models: ['V10', 'Session', 'Demo', 'Sender', 'Tues', 'Supreme', 'Gambler', 'Two15', 'Glory', 'Rage']
    },
    'MTB Enduro': {
        brands: ['Santa Cruz', 'Trek', 'Specialized', 'Canyon', 'YT', 'Commencal', 'Scott', 'Cube', 'Giant', 'Orbea', 'Propain', 'Radon'],
        models: ['Megatower', 'Nomad', 'Slash', 'Enduro', 'Strive', 'Torque', 'Capra', 'Meta AM', 'Meta SX', 'Ransom', 'Stereo 170', 'Reign', 'Rallon', 'Tyee', 'Swoop']
    },
    'MTB Trail': {
        brands: ['Santa Cruz', 'Trek', 'Specialized', 'Canyon', 'YT', 'Commencal', 'Scott', 'Cube', 'Giant', 'Orbea', 'Radon', 'Rocky Mountain', 'Norco', 'Pivot'],
        models: ['Hightower', '5010', 'Tallboy', 'Fuel EX', 'Stumpjumper', 'Spectral', 'Neuron', 'Jeffsy', 'Meta TR', 'Genius', 'Stereo 140', 'Stereo 150', 'Trance', 'Occam', 'Slide', 'Skeen', 'Chameleon', 'Roscoe', 'Stoic', 'Status', 'Fuse', 'Fluid', 'Smuggler', 'Optic', 'Hugene', 'Izzo']
    },
    'MTB XC': {
        brands: ['Specialized', 'Trek', 'Scott', 'Canyon', 'Cube', 'Giant', 'Orbea', 'Cannondale', 'BMC', 'Santa Cruz', 'Ghost', 'Rose', 'Focus'],
        models: ['Epic', 'Supercaliber', 'Top Fuel', 'Spark', 'Scale', 'Lux', 'Exceed', 'AMS', 'Elite', 'Anthem', 'Oiz', 'Scalpel', 'Fourstroke', 'Highball', 'Blur', 'Chisel', 'X-Caliber', 'Marlin', 'Grand Canyon', 'Alma', 'Procaliber', 'Lector', 'Raven', 'Psycho Path']
    },
    'Road Aero': {
        brands: ['Trek', 'Specialized', 'Canyon', 'Scott', 'Giant', 'Merida', 'Cube', 'Cervelo', 'BMC'],
        models: ['Madone', 'Venge', 'Aeroad', 'Foil', 'Propel', 'Reacto', 'Litening', 'S5', 'Timemachine Road']
    },
    'Road Endurance': {
        brands: ['Trek', 'Specialized', 'Canyon', 'Scott', 'Giant', 'Cube', 'Merida', 'Cannondale', 'BMC'],
        models: ['Domane', 'Roubaix', 'Endurace', 'Addict', 'Defy', 'Attain', 'Agree', 'Scultura Endurance', 'Synapse', 'Roadmachine']
    },
    'Road Climbing': {
        brands: ['Trek', 'Specialized', 'Canyon', 'Scott', 'Giant', 'Cannondale', 'BMC', 'Pinarello'],
        models: ['Emonda', 'Aethos', 'Tarmac', 'Ultimate', 'Addict RC', 'TCR', 'SuperSix', 'Teammachine', 'Dogma']
    },
    'Gravel': {
        brands: ['Canyon', 'Specialized', 'Trek', 'Scott', 'Cervelo', 'BMC', 'Giant', 'Cube'],
        models: ['Grail', 'Grizl', 'Crux', 'Diverge', 'Checkpoint', 'Addict Gravel', 'Aspero', 'Revolt', 'Nuroad']
    }
};

// Arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

console.log('═'.repeat(60));
console.log('🔍 FMV DATA COLLECTION');
console.log('═'.repeat(60));
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
console.log(`Limit: ${LIMIT || 'None'}`);

// Build search pairs
function buildSearchPairs() {
    const pairs = [];
    const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    
    for (const [category, data] of Object.entries(BRAND_MODELS)) {
        for (const brand of data.brands) {
            for (const model of data.models) {
                for (const year of years) {
                    pairs.push({ brand, model, year, category });
                }
            }
        }
    }
    
    return pairs;
}

// Insert market history
const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO market_history 
    (brand, model, year, price_eur, title, source_url, source_platform, category, scraped_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

// Scrape Buycycle
async function scrapeBuycycle(browser, brand, model, year) {
    const results = [];
    const page = await browser.newPage();
    
    try {
        const searchQuery = encodeURIComponent(`${brand} ${model} ${year}`);
        const url = `https://buycycle.com/de-de/shop/search/${searchQuery}`;
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // Extract prices from listing
        const items = await page.evaluate(() => {
            const listings = document.querySelectorAll('[data-cnstrc-item-id]');
            return Array.from(listings).map(el => {
                const priceEl = el.querySelector('[class*="price"]') || el.querySelector('.text-lg.font-bold');
                const titleEl = el.querySelector('h3') || el.querySelector('[class*="title"]');
                const linkEl = el.querySelector('a');
                
                let price = priceEl?.textContent?.replace(/[^\d]/g, '');
                return {
                    price: price ? parseInt(price) : null,
                    title: titleEl?.textContent?.trim() || '',
                    url: linkEl?.href || ''
                };
            }).filter(i => i.price && i.price > 100);
        });
        
        for (const item of items) {
            if (item.title.toLowerCase().includes(model.toLowerCase())) {
                results.push({
                    price: item.price,
                    title: item.title,
                    url: item.url,
                    source: 'buycycle'
                });
            }
        }
    } catch (e) {
        console.log(`   ⚠️ Buycycle error: ${e.message}`);
    } finally {
        await page.close();
    }
    
    return results;
}

// Scrape Bikeflip
async function scrapeBikeflip(browser, brand, model, year) {
    const results = [];
    const page = await browser.newPage();
    
    try {
        const searchQuery = encodeURIComponent(`${brand} ${model}`);
        const url = `https://bikeflip.de/suche?q=${searchQuery}`;
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const items = await page.evaluate(() => {
            const cards = document.querySelectorAll('.bike-card, [class*="listing"]');
            return Array.from(cards).map(el => {
                const priceEl = el.querySelector('[class*="price"]');
                const titleEl = el.querySelector('h2, h3, [class*="title"]');
                const linkEl = el.querySelector('a');
                
                let price = priceEl?.textContent?.replace(/[^\d]/g, '');
                return {
                    price: price ? parseInt(price) : null,
                    title: titleEl?.textContent?.trim() || '',
                    url: linkEl?.href || ''
                };
            }).filter(i => i.price && i.price > 100);
        });
        
        for (const item of items) {
            // Check year in title
            if (item.title.includes(String(year)) || Math.abs(year - 2022) <= 2) {
                results.push({
                    price: item.price,
                    title: item.title,
                    url: item.url,
                    source: 'bikeflip'
                });
            }
        }
    } catch (e) {
        console.log(`   ⚠️ Bikeflip error: ${e.message}`);
    } finally {
        await page.close();
    }
    
    return results;
}

// Main collection
async function collectFMVData() {
    const pairs = buildSearchPairs();
    console.log(`\nTotal search pairs: ${pairs.length}`);
    
    if (LIMIT) {
        pairs.splice(LIMIT);
        console.log(`Limited to: ${pairs.length}`);
    }
    
    if (DRY_RUN) {
        console.log('\n🔵 DRY RUN - showing first 20 pairs:');
        pairs.slice(0, 20).forEach((p, i) => {
            console.log(`  ${i+1}. ${p.brand} ${p.model} ${p.year} (${p.category})`);
        });
        return;
    }
    
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    let processed = 0;
    let collected = 0;
    const stats = { buycycle: 0, bikeflip: 0 };
    
    try {
        for (const pair of pairs) {
            processed++;
            process.stdout.write(`\r[${processed}/${pairs.length}] ${pair.brand} ${pair.model} ${pair.year}...                    `);
            
            // Scrape sources
            const buycycleResults = await scrapeBuycycle(browser, pair.brand, pair.model, pair.year);
            const bikeflipResults = await scrapeBikeflip(browser, pair.brand, pair.model, pair.year);
            
            // Save results
            for (const r of buycycleResults) {
                try {
                    insertStmt.run(
                        pair.brand, pair.model, pair.year, r.price,
                        r.title, r.url, r.source, pair.category
                    );
                    collected++;
                    stats.buycycle++;
                } catch (e) {}
            }
            
            for (const r of bikeflipResults) {
                try {
                    insertStmt.run(
                        pair.brand, pair.model, pair.year, r.price,
                        r.title, r.url, r.source, pair.category
                    );
                    collected++;
                    stats.bikeflip++;
                } catch (e) {}
            }
            
            // Rate limiting
            await new Promise(r => setTimeout(r, 1500));
            
            // Progress report every 50
            if (processed % 50 === 0) {
                console.log(`\n   📊 Progress: ${processed}/${pairs.length}, Collected: ${collected}`);
            }
        }
    } finally {
        await browser.close();
    }
    
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 COLLECTION COMPLETE');
    console.log('═'.repeat(60));
    console.log(`Processed: ${processed} pairs`);
    console.log(`Collected: ${collected} prices`);
    console.log(`  - Buycycle: ${stats.buycycle}`);
    console.log(`  - Bikeflip: ${stats.bikeflip}`);
    
    // Show market_history stats
    const totalHistory = db.prepare('SELECT COUNT(*) as cnt FROM market_history').get().cnt;
    const distinctModels = db.prepare('SELECT COUNT(DISTINCT brand || model) as cnt FROM market_history').get().cnt;
    console.log(`\nTotal in market_history: ${totalHistory}`);
    console.log(`Distinct models: ${distinctModels}`);
}

collectFMVData().then(() => {
    db.close();
    console.log('\n✅ Done');
}).catch(e => {
    console.error('❌ Error:', e);
    db.close();
});
