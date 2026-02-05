const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const GeminiProcessor = require('../backend/src/services/geminiProcessor');
const KleinanzeigenParser = require('../telegram-bot/kleinanzeigen-parser');

// Helper for DB queries
const dbPath = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);
const parser = new KleinanzeigenParser();

function dbAll(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function calculateRealFMV(baseFMV, technicalScore, upgrades = []) {
    if (!baseFMV) return 0;
    
    // Base Logic (Continuous Curve for Decimals):
    // Score 10.0 -> 1.0x (New)
    // Score 7.0  -> 0.85x (Class A Bottom)
    // Score 4.0  -> 0.70x (Class B Bottom)
    // Score 1.0  -> 0.55x (Class C Bottom)
    
    let conditionModifier = 0.5 + (technicalScore / 20); 
    
    // Upgrades Bonus
    if (upgrades.length > 0) {
        conditionModifier += 0.05; // Flat 5% bonus for upgrades
    }
    
    return Math.round(baseFMV * conditionModifier);
}

async function revaluateCatalog() {
    console.log('🚀 Starting Catalog Re-evaluation (Deep Vision 3.0 - Decimal Precision)...');
    
    try {
        // Ensure columns exist (Updated to REAL for score)
        const columnsToAdd = [
            'ALTER TABLE bikes ADD COLUMN images TEXT',
            'ALTER TABLE bikes ADD COLUMN technical_score REAL',
            'ALTER TABLE bikes ADD COLUMN condition_class TEXT',
            'ALTER TABLE bikes ADD COLUMN condition_reason TEXT',
            'ALTER TABLE bikes ADD COLUMN components_json TEXT',
            'ALTER TABLE bikes ADD COLUMN ai_specs TEXT',
            'ALTER TABLE bikes ADD COLUMN description_ru TEXT'
        ];

        for (const sql of columnsToAdd) {
            try {
                await dbRun(sql);
                console.log(`✅ Executed: ${sql}`);
            } catch (e) {
                // Ignore if column exists
            }
        }

        // 1. Fetch all active bikes
        const bikes = await dbAll('SELECT * FROM bikes WHERE is_active = 1');
        console.log(`Found ${bikes.length} active bikes.`);
        
        let processedCount = 0;
        // const TEST_LIMIT = 2; // Test on 2 bikes as requested

        for (const bike of bikes) {
            // if (processedCount >= TEST_LIMIT) {
            //     console.log('🛑 Test limit reached. Stopping.');
            //     break;
            // }
            console.log(`\n-----------------------------------`);
            console.log(`Analyzing: ${bike.brand} ${bike.model} (ID: ${bike.id})`);
            
            // 2. Parse or Fetch images
            let images = [];
            try {
                if (bike.images) {
                    const parsed = JSON.parse(bike.images);
                    if (Array.isArray(parsed) && parsed.length > 0) images = parsed;
                }
            } catch (e) {
                // Invalid JSON
            }
            
            // If no images in DB, try to scrape
            if (images.length === 0) {
                if (bike.original_url && bike.original_url.includes('kleinanzeigen')) {
                    console.log(`🕵️ No images in DB. Re-scraping source: ${bike.original_url}`);
                    try {
                        // Add delay before scrape
                        await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                        
                        const scrapedData = await parser.parseKleinanzeigenLink(bike.original_url);
                        if (scrapedData && scrapedData.images && scrapedData.images.length > 0) {
                            images = scrapedData.images;
                            console.log(`🎉 Recovered ${images.length} images from source.`);
                            
                            // Save recovered images immediately
                            await dbRun('UPDATE bikes SET images = ? WHERE id = ?', [JSON.stringify(images), bike.id]);
                        } else {
                            console.warn('⚠️ Scraper found no images (or listing deleted).');
                        }
                    } catch (e) {
                        console.error(`❌ Scrape failed: ${e.message}`);
                    }
                } else {
                    // Fallback to main_image if available
                    if (bike.main_image) {
                        images = [bike.main_image];
                        console.log('⚠️ Using single main_image fallback.');
                    }
                }
            }
            
            if (images.length === 0) {
                console.warn('❌ Still no images found. Skipping analysis.');
                continue;
            }
            
            console.log(`📸 Sending ${images.length} images to Gemini 3.0 Pro Preview...`);
            
            // 3. Perform Deep Audit (Pass context for better specs extraction)
            const auditResult = await GeminiProcessor.analyzeCondition(images, bike.title, bike.description);
            
            if (auditResult.error) {
                console.error(`❌ Audit Failed: ${auditResult.error}`);
                continue;
            }

            // 3.1 Translate Description
            let translatedDesc = bike.description;
            try {
                if (bike.description) {
                    console.log('🌍 Translating description...');
                    translatedDesc = await GeminiProcessor.translateText(bike.description);
                }
            } catch (e) {
                console.warn('Translation failed, keeping original');
            }
            
            console.log(`✅ Audit Complete!`);
            console.log(`   Score: ${auditResult.technical_score}/10 (${auditResult.condition_class})`);
            console.log(`   Condition: ${auditResult.visual_condition}`);
            console.log(`   Notes: ${auditResult.mechanic_notes}`);
            if (auditResult.detected_specs) {
                console.log(`   Specs: ${Object.keys(auditResult.detected_specs).length} items extracted`);
            }
            
            if (auditResult.is_killed) {
                console.warn(`💀 DETECTED KILLED BIKE! Hiding from catalog.`);
                await dbRun('UPDATE bikes SET is_active = 0, condition_reason = ? WHERE id = ?', 
                    [`KILLED: ${auditResult.mechanic_notes}`, bike.id]);
                continue;
            }
            
            // 4. Calculate Real FMV
            const baseFMV = bike.original_price || bike.price * 1.2; 
            const realFMV = calculateRealFMV(baseFMV, auditResult.technical_score, auditResult.interesting_components);
            
            console.log(`💰 Valuation Update: Base ${baseFMV}€ -> Real ${realFMV}€`);
            
            // 5. Update Database
            await dbRun(`
                UPDATE bikes 
                SET 
                    technical_score = ?,
                    condition_class = ?,
                    condition_reason = ?,
                    components_json = ?,
                    original_price = ?, 
                    condition_score = ?,
                    ai_specs = ?,
                    description_ru = ?
                WHERE id = ?
            `, [
                auditResult.technical_score,
                auditResult.condition_class,
                auditResult.mechanic_notes,
                JSON.stringify(auditResult.interesting_components || []),
                realFMV,
                auditResult.technical_score,
                JSON.stringify(auditResult.detected_specs || {}),
                translatedDesc,
                bike.id
            ]);
            
            console.log(`💾 Saved to DB.`);
            
            // Sleep to respect rate limits
            await new Promise(r => setTimeout(r, 2000));
            processedCount++;
        }
        
        console.log('\n🎉 Re-evaluation Complete!');
        
    } catch (e) {
        console.error('Critical Error:', e);
    } finally {
        db.close();
    }
}

revaluateCatalog();
