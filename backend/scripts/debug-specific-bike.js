const path = require('path');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { DatabaseManager } = require('../src/js/mysql-config');
const geminiProcessor = require('../src/services/geminiProcessor');

puppeteer.use(StealthPlugin());

async function debugBike(url) {
    console.log('🚀 STARTING DEBUG PIPELINE FOR:', url);
    console.log('--------------------------------------------------');

    const db = new DatabaseManager();
    let browser;

    // 1. FETCH HTML (Puppeteer)
    console.log('📡 Fetching HTML (Puppeteer Stealth)...');
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Go to URL
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for key elements
        try { await page.waitForSelector('h1', { timeout: 5000 }); } catch (e) {}

        const html = await page.content();
        console.log(`✅ HTML Fetched (${html.length} chars)`);

        // 2. PARSE DATA
        console.log('--------------------------------------------------');
        console.log('🕵️ EXTRACTING DATA...');
        
        const $ = cheerio.load(html);
        let extracted = {
            title: null,
            price: null,
            images: [],
            specs: {},
            seller: {},
            raw_chips: []
        };

        // A. JSON-LD
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const data = JSON.parse($(el).html());
                const product = Array.isArray(data) ? data.find(i => i['@type'] === 'Product') : (data['@type'] === 'Product' ? data : null);
                if (product) {
                    console.log('   ✅ Found JSON-LD');
                    extracted.title = product.name;
                    extracted.brand = product.brand?.name || product.brand;
                    extracted.description = product.description;
                    extracted.images = Array.isArray(product.image) ? product.image : (product.image ? [product.image] : []);
                    if (product.offers) {
                        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                        extracted.price = parseFloat(offer.price);
                    }
                }
            } catch (e) {}
        });

        // B. DOM IMAGES (Advanced Sorting)
        const galleryImages = [];
        $('img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http') && !src.includes('avatar') && !src.includes('icon')) {
                // Heuristic: Prefer high-res uploads
                if (src.includes('uploads/bike') || src.includes('media')) {
                    galleryImages.push(src);
                }
            }
        });
        // Merge and Sort: Put "uploads/bike" images first
        const allImages = [...new Set([...extracted.images, ...galleryImages])];
        extracted.images = allImages.sort((a, b) => {
            const aScore = a.includes('uploads/bike') ? 2 : (a.includes('buycycle') ? 0 : 1);
            const bScore = b.includes('uploads/bike') ? 2 : (b.includes('buycycle') ? 0 : 1);
            return bScore - aScore;
        });
        console.log(`   📸 Found ${extracted.images.length} images (Sorted best first)`);

        // C. CHIPS
        const generalHeader = $('*').filter((i, el) => $(el).text().trim() === 'Allgemeine Informationen').first();
        if (generalHeader.length) {
            generalHeader.parent().find('div.flex-wrap > div').each((j, chip) => {
                 const text = $(chip).text().trim();
                 if (text) extracted.raw_chips.push(text);
                 if (text.includes('Jahr:')) extracted.year = parseInt(text.split('Jahr:')[1].trim());
                 if (text.includes('Rahmenmaterial:')) extracted.material = text.split('Rahmenmaterial:')[1].trim();
            });
            console.log(`   ✅ Found ${extracted.raw_chips.length} Info Chips`);
        }

        // D. SPECS (Heuristic Search for Keys)
        // If "Fahrraddetails" header fails, look for known keys like "Gabel", "Dämpfer", "Bremse"
        const knownKeys = ['Gabel', 'Dämpfer', 'Schaltwerk', 'Kurbel', 'Bremsen', 'Laufräder', 'Reifen', 'Sattel', 'Vorbau', 'Lenker', 'Kassette'];
        
        let specsFound = 0;
        
        // Strategy D1: Find elements containing keys and look at siblings
        knownKeys.forEach(key => {
            // Find div containing exact key
            $('div').filter((i, el) => $(el).text().trim() === key).each((i, el) => {
                // Usually the value is the NEXT sibling div
                const val = $(el).next().text().trim();
                if (val && val.length > 1 && val.length < 200) {
                    extracted.specs[key] = val;
                    specsFound++;
                }
            });
        });

        if (specsFound > 0) {
            console.log(`   ✅ Found ${specsFound} Specs via Key-Search Strategy`);
        } else {
            console.log('   ⚠️ Specs extraction failed. Dumping generic grid items...');
             // Strategy D2: Dump all grid items in that section
             const detailsHeader = $('*').filter((i, el) => $(el).text().trim() === 'Fahrraddetails').first();
             if (detailsHeader.length) {
                 const textContent = detailsHeader.parent().text();
                 console.log('   DEBUG CONTEXT:', textContent.substring(0, 200) + '...');
             }
        }

        console.log('--------------------------------------------------');
        console.log('📊 FINAL DATA PREVIEW:');
        console.log(JSON.stringify({
            title: extracted.title,
            year: extracted.year,
            specs: extracted.specs,
            first_image: extracted.images[0]
        }, null, 2));

        // 3. GEMINI
        console.log('--------------------------------------------------');
        console.log('🧠 SENDING TO GEMINI...');
        const imagesToAnalyze = extracted.images.slice(0, 3);
        
        try {
            const aiResult = await geminiProcessor.analyzeCondition(
                imagesToAnalyze, extracted.title, extracted.description
            );
            
            console.log('🤖 AI SCORE:', aiResult.technical_score);
            console.log('🤖 AI NOTE:', aiResult.mechanic_notes?.substring(0, 100) + '...');
            
            // 4. DB INSERTION
            console.log('--------------------------------------------------');
            console.log('💾 DB INSERTION:');
            
            // Enforce Score -> Class Logic
            // User requirement: 8-10 = A, 5-7.9 = B, 0-4.9 = C
            const score = aiResult.technical_score || 0;
            let finalClass = 'C';
            if (score >= 8.0) finalClass = 'A';
            else if (score >= 5.0) finalClass = 'B';
            
            // Map extracted data to DB columns
            extracted.specs.badges = extracted.raw_chips;
            
            // Ensure core specs are also in features for redundancy
            if (extracted.frame_size) extracted.specs.frame_size = extracted.frame_size;
            if (extracted.wheel_size) extracted.specs.wheel_size = extracted.wheel_size;
            if (extracted.year) extracted.specs.year = extracted.year;
            if (extracted.material) extracted.specs.frame_material = extracted.material;
            
            const featuresJson = JSON.stringify(extracted.specs);
            
            const insertSql = `
                INSERT INTO bikes (
                    name, brand, model, year, price, category, 
                    ranking_score, condition_score, condition_grade, condition_reason, 
                    features, description, main_image, 
                    source_url, is_active, created_at,
                    size, wheel_diameter, original_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, ?)
            `;
            
            const params = [
                extracted.title,
                extracted.brand || 'Unknown',
                extracted.title ? extracted.title.replace(extracted.brand || '', '').trim() : 'Unknown',
                extracted.year || 2024,
                extracted.price,
                extracted.specs['Kategorie'] || 'MTB',
                score, // REAL
                Math.round(score), // INT
                finalClass, // Enforced Class
                aiResult.mechanic_notes,
                featuresJson,
                extracted.description,
                extracted.images[0],
                url,
                // Extra fields for frontend spec view
                extracted.frame_size || extracted.specs['Rahmengröße'] || null,
                extracted.wheel_size || extracted.specs['Laufradgröße'] || null,
                url
            ];

            await db.initialize();
            const result = await db.query(insertSql, params);
            console.log('✅ INSERT SUCCESSFUL! Bike ID created:', result.insertId);
            
            // Insert Images
            if (result.insertId) {
                console.log(`📸 Inserting ${extracted.images.length} images into bike_images...`);
                for (let i = 0; i < extracted.images.length; i++) {
                    const imgUrl = extracted.images[i];
                    await db.query(`
                        INSERT INTO bike_images (bike_id, image_url, image_order, is_main)
                        VALUES (?, ?, ?, ?)
                    `, [result.insertId, imgUrl, i, i === 0 ? 1 : 0]);
                }
                console.log('✅ Images inserted.');
                
                // 5. FINAL VERIFICATION & UNIFIED JSON OUTPUT
                console.log('--------------------------------------------------');
                console.log('🏁 FINAL UNIFIED JSON (EUBIKE STANDARD):');
                
                // Construct Unified Schema
                const unifiedSchema = {
                    "meta": {
                        "id": result.insertId,
                        "source_platform": "buycycle",
                        "source_url": url,
                        "is_active": true,
                        "created_at": new Date().toISOString(),
                        "last_updated": new Date().toISOString()
                    },
                    "basic_info": {
                        "title": extracted.title,
                        "price": extracted.price,
                        "currency": "EUR",
                        "brand": extracted.brand || 'Giant',
                        "model": extracted.title.replace(extracted.brand || '', '').trim(),
                        "year": extracted.year || 2019,
                        "category": extracted.specs['Kategorie'] || 'MTB'
                    },
                    "specs": {
                        "frame_size": extracted.frame_size || extracted.specs['Rahmengröße'] || null,
                        "wheel_size": extracted.wheel_size || extracted.specs['Laufradgröße'] || null,
                        "frame_material": extracted.material || extracted.specs['Rahmenmaterial'] || null,
                        "color": extracted.specs['Farbe'] || null,
                        "weight": null, // Not found
                        "groupset": extracted.specs['Schaltwerk'] || null,
                        "suspension_type": extracted.specs['Federungstyp'] || null
                    },
                    "condition": {
                        "score": score,
                        "class": finalClass,
                        "reason": aiResult.mechanic_notes,
                        "visual_rating": aiResult.visual_condition,
                        "issues": aiResult.detected_issues || [],
                        "mechanic_notes": aiResult.mechanic_notes
                    },
                    "features": {
                        "raw_specs": extracted.specs,
                        "badges": extracted.raw_chips,
                        "upgrades": aiResult.interesting_components || []
                    },
                    "seller": {
                        "name": extracted.seller.name || "Unknown Private Seller",
                        "location": extracted.seller.city || null,
                        "country": extracted.seller.country || null,
                        "rating": null, // Buycycle doesn't expose this easily
                        "badges": null, // Kleinanzeigen specific
                        "type": "private" // Default
                    },
                    "media": {
                        "main_image": extracted.images[0],
                        "gallery": extracted.images
                    }
                };
                
                console.log(JSON.stringify(unifiedSchema, null, 2));
                console.log('--------------------------------------------------');
                console.log('✅ ALL TASKS COMPLETE. READY FOR FRONTEND.');
            }

        } catch (e) {
            console.error('❌ AI Failed:', e.message);
        }

    } catch (e) {
        console.error('❌ Pipeline Failed:', e);
    } finally {
        if (browser) await browser.close();
    }
}

const url = 'https://buycycle.com/de-de/product/reign-1-2019-71635';
debugBike(url).catch(console.error);
