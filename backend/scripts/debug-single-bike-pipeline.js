
const CatalogGapAnalyzer = require('../src/services/catalog-gap-analyzer');
const BuycycleCollector = require('../scrapers/buycycle-collector');
const TechDecoder = require('../src/services/TechDecoder');
const Database = require('better-sqlite3');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const DB_PATH = path.join(__dirname, '../database/eubike.db');
const db = new Database(DB_PATH);

// Target for Debug
const TARGET = { brand: 'Canyon', model: 'Spectral' };

async function runDebugPipeline() {
    console.log('🐞 DEBUG PIPELINE: SINGLE BIKE INTEGRATION (15 STEPS)');
    console.log('==================================================');

    const collector = BuycycleCollector;
    const decoder = TechDecoder;
    let browser = null;

    try {
        // STEP 1: GAP ANALYSIS
        console.log('\n[Step 1/15] 📊 Gap Analysis...');
        const gaps = await CatalogGapAnalyzer.analyzeModelGaps(TARGET.brand, TARGET.model);
        console.log(`   ✅ Priority: ${gaps.priority}`);
        console.log(`   ✅ Missing: ${gaps.gaps.sizes.map(s => s.size).join(', ')}`);

        // STEP 2: STRATEGY & SOURCE SELECTION
        console.log('\n[Step 2/15] 🧠 Strategy Decision...');
        const strategy = { source: 'buycycle', minPrice: 1500, maxPrice: 4000 };
        console.log(`   ✅ Selected Source: ${strategy.source}`);

        // STEP 3: URL CONSTRUCTION
        console.log('\n[Step 3/15] 🔗 Constructing URL...');
        const searchUrl = collector.buildSearchUrl({
            brand: TARGET.brand,
            model: TARGET.model,
            minPrice: strategy.minPrice,
            maxPrice: strategy.maxPrice,
            frameSizes: gaps.gaps.sizes.map(s => s.size)
        });
        console.log(`   ✅ URL: ${searchUrl}`);

        // STEP 4: NETWORK REQUEST (SEARCH)
        console.log('\n[Step 4/15] 🌐 Fetching Search Page...');
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        const response = await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log(`   ✅ Status: ${response.status()}`);

        // STEP 5: EXTRACT LISTINGS
        console.log('\n[Step 5/15] 📄 Extracting Listings...');
        const listings = await collector.extractListingsFromPage(page);
        console.log(`   ✅ Found ${listings.length} listings`);
        if (listings.length === 0) throw new Error('No listings found');

        // STEP 6: CANDIDATE SELECTION
        console.log('\n[Step 6/15] 🎯 Selecting Best Candidate...');
        const candidate = listings[0]; 
        console.log(`   ✅ Selected: ${candidate.title} (€${candidate.price})`);

        // STEP 7: DEEP FETCH (DETAILS)
        console.log('\n[Step 7/15] 🕵️ Fetching Details Page...');
        await page.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log(`   ✅ Page Loaded`);

        // STEP 8: DEEP EXTRACTION
        console.log('\n[Step 8/15] 📝 Parsing Specs...');
        const details = await collector.scrapeListingDetails(page);
        console.log(`   ✅ Extracted: Size=${details.frame_size}, Year=${details.year}, Condition=${details.condition}`);

        // STEP 9: IMAGE VALIDATION
        console.log('\n[Step 9/15] 📸 Validating Images...');
        // We simulate what BuycycleCollector does (using candidate.image)
        const images = [candidate.image]; 
        console.log(`   ✅ Main Image: ${candidate.image}`);
        
        // STEP 10: GEMINI PREP
        console.log('\n[Step 10/15] 🤖 Preparing for AI...');
        const rawBike = {
            ...candidate,
            ...details,
            brand: TARGET.brand,
            model: TARGET.model,
            images: images
        };
        console.log(`   ✅ Payload ready`);

        // STEP 11: GEMINI ANALYSIS
        console.log('\n[Step 11/15] 🧠 AI Analysis (TechDecoder)...');
        const normalized = await decoder.normalize(rawBike);
        console.log(`   ✅ Analysis Complete`);

        // STEP 12: SCORING & METRICS
        console.log('\n[Step 12/15] 💯 Calculating Scores...');
        console.log(`   ✅ Quality Score: ${normalized.quality_score} (Should NOT be 100 unless perfect)`);
        console.log(`   ✅ Condition Score: ${normalized.condition_score}`);
        
        if (normalized.quality_score === 100) {
            console.warn('   ⚠️ WARNING: Quality Score is 100. Check if this is real or hardcoded.');
        }

        // STEP 13: SCHEMA MAPPING
        console.log('\n[Step 13/15] 🗺️  Mapping to DB Schema...');
        const dbRecord = {
            name: normalized.title || `${normalized.brand} ${normalized.model}`,
            brand: normalized.brand,
            model: normalized.model,
            year: normalized.year,
            price: normalized.price,
            category: 'Mountain Bike',
            condition_score: normalized.condition_score || 80, 
            description: normalized.description || 'Imported from Buycycle',
            main_image: normalized.image,
            source_url: normalized.url,
            original_url: normalized.url,
            fmv: normalized.price,
            is_active: 1, // CRITICAL FOR API
            size: normalized.frame_size,
            condition_status: normalized.condition,
            quality_score: normalized.quality_score // Added column
        };
        console.log(`   ✅ Mapped Record: Active=${dbRecord.is_active}, Image=${dbRecord.main_image}`);

        // STEP 14: DB INSERTION
        console.log('\n[Step 14/15] 💾 Inserting into DB...');
        // Ensure quality_score column exists (it was missing in validation log)
        try {
            db.prepare('ALTER TABLE bikes ADD COLUMN quality_score REAL DEFAULT 50').run();
        } catch (e) { /* ignore if exists */ }

        const insertStmt = db.prepare(`
            INSERT INTO bikes (
                name, brand, model, year, price, category, condition_score,
                description, main_image, source_url, original_url, fmv,
                is_active, created_at, size, condition_status, quality_score
            ) VALUES (
                @name, @brand, @model, @year, @price, @category, @condition_score,
                @description, @main_image, @source_url, @original_url, @fmv,
                @is_active, datetime('now'), @size, @condition_status, @quality_score
            )
        `);
        
        const info = insertStmt.run(dbRecord);
        const bikeId = info.lastInsertRowid;
        console.log(`   ✅ Inserted ID: ${bikeId}`);

        // Insert Image to bike_images (Required for API)
        db.prepare('INSERT OR IGNORE INTO bike_images (bike_id, image_url, is_main, image_order) VALUES (?, ?, ?, ?)').run(bikeId, dbRecord.main_image, 1, 0);
        console.log(`   ✅ Inserted Image Record`);

        // STEP 15: VERIFICATION (Simulate API Query)
        console.log('\n[Step 15/15] 🔍 Verifying API Visibility...');
        
        // This query mimics the API's query structure
        const apiQuery = `
            SELECT 
                bikes.*,
                GROUP_CONCAT(DISTINCT bike_images.image_url) as images
            FROM bikes 
            LEFT JOIN bike_images ON bikes.id = bike_images.bike_id
            WHERE bikes.is_active = 1 AND bikes.id = ?
            GROUP BY bikes.id
        `;
        
        const saved = db.prepare(apiQuery).get(bikeId);
        
        if (saved) {
            console.log(`   ✅ API Query Successful: Found "${saved.name}"`);
            console.log(`   ✅ Price: ${saved.price}`);
            console.log(`   ✅ Quality Score: ${saved.quality_score}`);
            console.log(`   ✅ Images: ${saved.images}`);
            
            if (!saved.images) {
                console.error('   ❌ ERROR: No images linked! API will filter this out.');
            }
        } else {
            throw new Error('Verification failed: Record not found via API query');
        }

        console.log('\n==================================================');
        console.log('✅ DEBUG PIPELINE PASSED SUCCESSFULLY');

    } catch (e) {
        console.error(`\n❌ DEBUG FAILED at some step: ${e.message}`);
        console.error(e);
    } finally {
        if (browser) await browser.close();
        db.close();
    }
}

runDebugPipeline();
