const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Database = require('better-sqlite3');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const GeminiProcessor = require('../../telegram-bot/gemini-processor');
const PriorityMatrix = require('../config/fmv-priority-matrix.js');

puppeteer.use(StealthPlugin());

// --- Configuration ---
const LOG_FILE = path.join(__dirname, '../logs/balanced_fmv.log');
const DB_PATH = path.join(__dirname, '../database/eubike.db');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function log(msg) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    console.log(logMsg);
    fs.appendFileSync(LOG_FILE, logMsg + '\n');
}

// DB Setup
const db = new Database(DB_PATH);

// Initialize Gemini
const geminiProcessor = new GeminiProcessor(
    null, 
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
); 
geminiProcessor.timeout = 120000;

function initDB() {
    log('🛠️ Initializing Database...');
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS raw_fmv_staging (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            price_eur REAL,
            source_url TEXT UNIQUE,
            category TEXT,
            target_brand TEXT,
            target_model TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS market_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            brand TEXT,
            model TEXT,
            year INTEGER,
            price_eur REAL,
            source_url TEXT UNIQUE,
            frame_size TEXT,
            condition TEXT,
            scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            category TEXT,
            quality_score INTEGER DEFAULT 0,
            trim_level TEXT,
            frame_material TEXT
        )
    `);
    
    // Ensure columns exist
    try {
        const tableInfo = db.pragma('table_info(market_history)');
        const hasQualityScore = tableInfo.some(c => c.name === 'quality_score');
        if (!hasQualityScore) db.exec('ALTER TABLE market_history ADD COLUMN quality_score INTEGER DEFAULT 0');
    } catch (e) {}

    log('✅ Database initialized.');
}

function buildKleinanzeigenURL(target) {
    const query = `${target.brand} ${target.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `https://www.kleinanzeigen.de/s-fahrraeder/${query}/k0c217`;
}

async function scrapePage(url, browser) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Accept cookies if present
        try {
            const cookieSelector = '#gdpr-banner-accept';
            if (await page.$(cookieSelector)) {
                await page.click(cookieSelector);
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {}

        const listings = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('article.aditem').forEach(el => {
                const titleEl = el.querySelector('.text-module-begin a');
                const priceEl = el.querySelector('.aditem-main--middle--price-shipping--price');
                const descEl = el.querySelector('.aditem-main--middle--description');
                
                if (titleEl && priceEl) {
                    const link = titleEl.href;
                    // Skip Pro/Ads
                    if (link.includes('/pro/')) return;

                    const title = titleEl.innerText.trim();
                    const description = descEl ? descEl.innerText.trim() : '';
                    const priceRaw = priceEl.innerText.trim();
                    
                    // Parse price
                    const priceMatch = priceRaw.match(/([\d\.]+)/);
                    let price = 0;
                    if (priceMatch) {
                        price = parseInt(priceMatch[1].replace(/\./g, ''));
                    }

                    if (price > 100) { // Basic filter
                        items.push({
                            title,
                            description,
                            price,
                            url: link
                        });
                    }
                }
            });
            return items;
        });

        return listings;

    } catch (e) {
        log(`❌ Scraping error for ${url}: ${e.message}`);
        return [];
    } finally {
        await page.close();
    }
}

async function saveToStaging(listing, target) {
    try {
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO raw_fmv_staging 
            (title, description, price_eur, source_url, category, target_brand, target_model)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(listing.title, listing.description, listing.price, listing.url, 'MTB', target.brand, target.model);
    } catch (e) {
        // Ignore unique constraint errors silently
        if (!e.message.includes('UNIQUE')) {
            log(`⚠️ Staging save error: ${e.message}`);
        }
    }
}

async function processStagingBatch() {
    log('⚙️ Processing Staging Batch with AI...');
    
    const stagingItems = db.prepare('SELECT * FROM raw_fmv_staging LIMIT 50').all();
    if (stagingItems.length === 0) {
        log('ℹ️ No items in staging.');
        return;
    }

    // Process in small groups
    const chunkSize = 10;
    for (let i = 0; i < stagingItems.length; i += chunkSize) {
        const batch = stagingItems.slice(i, i + chunkSize);
        
        const prompt = `
        Normalize these bike listings.
        Context: Looking for ${batch[0].target_brand} ${batch[0].target_model}.
        
        Input:
        ${JSON.stringify(batch.map((b, idx) => ({
            index: idx,
            title: b.title,
            desc: b.description,
            price: b.price_eur
        })))}
        
        Output JSON Array:
        [{
            "index": 0,
            "brand": "Brand",
            "model": "Model",
            "year": 2022, // null if unknown
            "category": "MTB/Road/Gravel/E-Bike",
            "trim_level": "Comp/Expert/etc",
            "frame_material": "Carbon/Alloy",
            "quality_score": 80 // 0-100 based on data completeness
        }]
        `;

        try {
            const responseText = await geminiProcessor.callGeminiAPI(prompt);
            const cleanJson = responseText.replace(/```json\s*/g, '').replace(/```/g, '').trim();
            const normalized = JSON.parse(cleanJson);

            const insertHistory = db.prepare(`
                INSERT OR IGNORE INTO market_history 
                (title, brand, model, year, price_eur, source_url, category, quality_score, trim_level, frame_material, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const deleteStaging = db.prepare('DELETE FROM raw_fmv_staging WHERE id = ?');

            for (const item of normalized) {
                const original = batch[item.index];
                if (!original) continue;

                if (item.quality_score >= 50) { // Only save decent data
                    try {
                        insertHistory.run(
                            original.title,
                            item.brand || original.target_brand,
                            item.model || original.target_model,
                            item.year,
                            original.price_eur,
                            original.source_url,
                            item.category,
                            item.quality_score,
                            item.trim_level,
                            item.frame_material,
                            original.created_at
                        );
                    } catch (e) {}
                }
                
                deleteStaging.run(original.id);
            }
            log(`✅ Processed batch ${i/chunkSize + 1}`);
            
            // Rate limit pause
            await new Promise(r => setTimeout(r, 2000));

        } catch (e) {
            log(`❌ AI Batch Error: ${e.message}`);
        }
    }
}

async function smartFMVCollection() {
    initDB();
    log('🎯 Starting SMART FMV Collection');

    // Get targets
    const targets = PriorityMatrix.getTopTargets(10); // Get top 10
    
    if (targets.length === 0) {
        log('✅ All targets fulfilled! No data needed.');
        return;
    }

    log('📋 Today\'s targets:');
    targets.forEach((t, i) => {
        log(`${i+1}. ${t.brand} ${t.model} [Tier ${t.tier}] - Need ${t.gap} more records (Score: ${t.score.toFixed(0)})`);
    });

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        for (const target of targets) {
            const url = buildKleinanzeigenURL(target);
            log(`\n🔍 Scraping: ${target.brand} ${target.model}`);
            
            const listings = await scrapePage(url, browser);
            
            // Save to Staging
            for (const listing of listings) {
                await saveToStaging(listing, target);
            }
            
            log(`✅ Collected ${listings.length} listings for ${target.model}`);
            
            // Pause between targets
            await new Promise(r => setTimeout(r, 3000));
        }
    } catch (e) {
        log(`❌ Fatal error: ${e.message}`);
    } finally {
        await browser.close();
    }

    // Process Staging
    await processStagingBatch();

    // Stats
    const stats = PriorityMatrix.getCoverageStats();
    log('\n📊 Coverage Update:');
    log(`Tier 1: ${stats.tier1.ready} (Gap: ${stats.tier1.gap})`);
    log(`Tier 2: ${stats.tier2.ready} (Gap: ${stats.tier2.gap})`);
    log('✅ Smart Collection Complete');
}

// Run
smartFMVCollection().catch(e => {
    log(`❌ Unhandled error: ${e.message}`);
    process.exit(1);
});
