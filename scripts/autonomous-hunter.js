const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../telegram-bot/.env') });

// Dynamic Imports for Axios/Proxy
let axios;
let HttpsProxyAgent;
try {
    axios = require('axios');
    HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
} catch (e) {
    try {
        axios = require('../telegram-bot/node_modules/axios');
        HttpsProxyAgent = require('../telegram-bot/node_modules/https-proxy-agent').HttpsProxyAgent;
    } catch (e2) {
        console.warn('⚠️ Optional modules (axios/proxy) not found. Proxy checks might fail.');
    }
}

const KleinanzeigenParser = require('../telegram-bot/kleinanzeigen-parser');
const GeminiProcessor = require('../telegram-bot/gemini-processor');
const BikesDatabase = require('../telegram-bot/bikes-database-node');

// Configuration
const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
// POLL_INTERVAL_MS removed in favor of dynamic timing
const BATCH_SIZE = 20;
const PROXY_URL = 'http://user258350:otuspk@191.101.73.161:8984';

// Initialize components
const db = new sqlite3.Database(DB_PATH);
const bikesDB = new BikesDatabase();
const parser = new KleinanzeigenParser();
const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const gp = new GeminiProcessor(geminiKey, geminiUrl);

// Helper for Promisified DB queries
function dbAll(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbGet(query, params = []) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Task 0: Berserk Utilities ---

const HOTNESS_THRESHOLD = 1000;

function calculateHotnessScore(price, fmv, views, publishDate) {
    if (!fmv || !price) return 0;
    
    const profit = fmv - price;
    if (profit <= 0) return 0;

    const now = new Date();
    const pub = new Date(publishDate || now);
    // Ensure at least 0.5 hour to avoid massive multipliers for just-published items
    const hoursAlive = Math.max(0.5, (now - pub) / (1000 * 60 * 60)); 
    
    // Extrapolate hourly velocity
    const velocity = (views || 0) / hoursAlive;
    
    // Formula: Profit * Velocity
    // Example: 500€ Profit * 2 views/hour = 1000 Score
    return Math.round(profit * velocity);
}

function getCurrentPollInterval() {
    const now = new Date();
    // MSK is UTC+3. 
    // We want hours in MSK.
    const mskDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const mskHours = mskDate.getUTCHours();
    const mskDay = mskDate.getUTCDay(); // 0=Sun, 6=Sat

    const isWeekend = (mskDay === 0 || mskDay === 6);
    // Prime Time: 18:00 - 22:00 MSK
    const isPrimeHours = (mskHours >= 18 && mskHours < 22);
    // Night: 01:00 - 07:00 MSK
    const isNightHours = (mskHours >= 1 && mskHours < 7);

    // 1. Night Mode (Economy)
    if (isNightHours) {
        return { 
            ms: 45 * 60 * 1000, // 45 min
            mode: 'NIGHT (Economy)',
            isPrime: false 
        };
    }

    // 2. Prime Mode (Berserk)
    if (isPrimeHours || isWeekend) {
        // Random 90 - 120 seconds
        const ms = Math.floor(90000 + Math.random() * 30000); 
        return { 
            ms, 
            mode: 'BERSERK (Prime Time)',
            isPrime: true
        };
    }

    // 3. Standard Mode
    return { 
        ms: 10 * 60 * 1000, // 10 min
        mode: 'STANDARD',
        isPrime: false
    };
}

async function checkProxyAvailability() {
    if (!axios || !HttpsProxyAgent) return true; // Cannot check without libs

    console.log(`🔌 Checking Proxy Artery: ${PROXY_URL}`);
    const agent = new HttpsProxyAgent(PROXY_URL);
    // Ping Gemini to verify full path connectivity
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const payload = { contents: [{ parts: [{ text: "Ping" }] }] };

    try {
        const start = Date.now();
        await axios.post(url, payload, {
            httpsAgent: agent,
            proxy: false,
            timeout: 5000, // Fast fail (5s)
            headers: { 'Content-Type': 'application/json' }
        });
        const ping = Date.now() - start;
        console.log(`✅ Proxy Alive. Latency: ${ping}ms`);
        return true;
    } catch (e) {
        console.error(`❌ PROXY DIED! Error: ${e.message}`);
        
        // Alert Manager Bot via DB Task
        try {
            const alertMsg = `🚨 **HUNTER ALERT**\nProxy Unreachable in Prime Time!\nError: ${e.message}`;
            await dbRun("INSERT INTO bot_tasks (type, payload, status) VALUES (?, ?, ?)", 
                ['admin_broadcast', JSON.stringify({ message: alertMsg }), 'pending']
            );
            console.log('📨 Alert sent to Manager Bot queue.');
        } catch (dbErr) {
            console.error('Failed to queue alert:', dbErr);
        }
        
        return false;
    }
}

// --- Task 1: Sniper Logic ---

async function calculateFMV(brand, model) {
    // Simple heuristic: Median of last 50 sales for this brand/model
    // In a real system, we might need fuzzy matching for model names
    if (!brand || !model) return null;

    try {
        const query = `
            SELECT price_eur 
            FROM market_history 
            WHERE brand LIKE ? AND model_name LIKE ? 
            ORDER BY scraped_at DESC 
            LIMIT 50
        `;
        const rows = await dbAll(query, [`%${brand}%`, `%${model}%`]);
        
        if (rows.length < 3) return null; // Not enough data

        const prices = rows.map(r => r.price_eur).sort((a, b) => a - b);
        const mid = Math.floor(prices.length / 2);
        const median = prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
        
        return median;
    } catch (e) {
        console.error(`Error calculating FMV for ${brand} ${model}:`, e);
        return null;
    }
}

async function shouldDeepScrape(listing) {
    const fmv = await calculateFMV(listing.brand, listing.model_name);
    
    if (!fmv) {
        // If no FMV data, we can't decide. 
        // Strategy: If it's a known brand, maybe scrape anyway? 
        // For now, let's be conservative: Skip if no market data.
        // OR: Scrape if it looks cheap absolute (< 1000EUR)? 
        // User instruction: "Calculates median... Filter benefit". Implies we need FMV.
        return { shouldScrape: false, reason: 'No FMV data' };
    }

    // Initial check using optimistic delivery assumption (Shipping Available -> 0.85)
    // We don't know delivery option yet.
    const optimisticThreshold = fmv * 0.85;
    
    if (listing.price_eur <= optimisticThreshold) {
        return { 
            shouldScrape: true, 
            fmv, 
            reason: `Price ${listing.price_eur} <= Optimistic Threshold ${optimisticThreshold.toFixed(0)} (FMV: ${fmv})` 
        };
    }

    return { 
        shouldScrape: false, 
        reason: `Price ${listing.price_eur} > FMV ${fmv} (Threshold ${optimisticThreshold.toFixed(0)})` 
    };
}

// --- Task 2: Pipeline ---

async function processListing(listing) {
    console.log(`\n🔍 Analyzing: ${listing.brand} ${listing.model_name} (${listing.price_eur}€)...`);

    // 1. Sniper Check
    const sniperResult = await shouldDeepScrape(listing);
    if (!sniperResult.shouldScrape) {
        console.log(`⏭️ Skipped: ${sniperResult.reason}`);
        return;
    }

    console.log(`🎯 Sniper Hit! Potential Gem. ${sniperResult.reason}`);

    try {
        // 2. Deep Archaeology (Parser)
        await sleep(2000 + Math.random() * 3000); // Random delay 2-5s
        
        let rawData;
        try {
            rawData = await parser.parseKleinanzeigenLink(listing.source_url);
        } catch (e) {
            console.error(`❌ Parse failed for ${listing.source_url}: ${e.message}`);
            return;
        }

        // 3. Refined Sniper Check (now that we know delivery)
        // If pickup-only, we need 25% discount (0.75)
        // If shipping, we need 15% discount (0.85)
        const isPickupOnly = rawData.deliveryOption === 'pickup-only';
        const requiredDiscount = isPickupOnly ? 0.25 : 0.15;
        const maxPrice = sniperResult.fmv * (1 - requiredDiscount);

        if (listing.price_eur > maxPrice) {
            console.log(`💸 Price ${listing.price_eur} too high for ${isPickupOnly ? 'Pickup' : 'Shipping'} (Max: ${maxPrice.toFixed(0)})`);
            return;
        }

        const savings = sniperResult.fmv - listing.price_eur;
        const savingsPercent = Math.round((savings / sniperResult.fmv) * 100);

        console.log(`🎯 НАЙДЕН БРИЛЛИАНТ: ${listing.brand} ${listing.model_name}`);
        console.log(`   FMV: ${sniperResult.fmv}€, Цена: ${listing.price_eur}€. Выгода: ${savingsPercent}%. Отправляем в каталог!`);

        // 4. Semantic Enrichment (Gemini)
        // Now using "Deep Vision 3.0" logic to assess Real FMV based on condition
        const enrichedData = await gp.enrichBikeData(rawData);
        
        // --- NEW: Smart Valuation Logic ---
        // If Gemini provided a technical_score (1-10), use it to adjust FMV.
        // Formula: Real_FMV = Base_FMV * (Technical_Score / 10) * K
        // Where K is a safety factor (e.g., 1.2 for Class A to allow premium, 0.8 for Class C).
        // For simplicity: Real_FMV = Base_FMV * (0.5 + (Technical_Score / 20)) 
        // Example: Score 10 -> 0.5 + 0.5 = 1.0 (100% FMV)
        // Example: Score 5 -> 0.5 + 0.25 = 0.75 (75% FMV)
        
        let technicalScore = enrichedData.technical_score || 7; // Default to 7 (Good/B) if missing
        let conditionModifier = 0.5 + (technicalScore / 20); 
        
        // Bonus for upgrades
        if (enrichedData.interesting_components && enrichedData.interesting_components.length > 0) {
            console.log(`✨ Detected Upgrades: ${enrichedData.interesting_components.join(', ')}`);
            conditionModifier += 0.05; // +5% for upgrades
        }

        const realFMV = Math.round(sniperResult.fmv * conditionModifier);
        
        // Re-evaluate Deal with Real FMV
        // We want to buy if Price < Real_FMV * 0.85 (Shipping) or 0.75 (Pickup)
        const smartMaxPrice = realFMV * (1 - requiredDiscount);

        console.log(`🧠 AI Valuation: Score ${technicalScore}/10. Real FMV: ${realFMV}€ (Base: ${sniperResult.fmv}€). Smart Max Price: ${smartMaxPrice}€`);

        if (listing.price_eur > smartMaxPrice) {
            console.log(`📉 AI Reject: Price ${listing.price_eur} > Smart Max ${smartMaxPrice}. Condition/Value too low.`);
            return; // Skip saving
        }

        // Sprint 1.4: Hotness Radar
        const hotnessScore = calculateHotnessScore(listing.price_eur, realFMV, rawData.views, rawData.publishDate);
        if (hotnessScore > HOTNESS_THRESHOLD) {
            console.log(`🔥 ALARM: Hotness Score ${hotnessScore} (Threshold ${HOTNESS_THRESHOLD})!`);
            
            const alarmPayload = {
                message: `🔥 **ALARM: СВЕРХ-ЛИКВИДНЫЙ ЛОТ!**\n\n` +
                         `🚲 **${enrichedData.title}**\n` +
                         `💰 **${listing.price_eur}€** (FMV: ${realFMV}€)\n` +
                         `📈 **Hotness Score: ${hotnessScore}**\n` +
                         `🧠 AI Score: ${technicalScore}/10\n` +
                         `👀 Просмотры: ${rawData.views || 0}\n` +
                         `🔗 [Ссылка](${enrichedData.originalUrl})`,
                buttons: [
                    { text: "⚡️ МГНОВЕННЫЙ ВЫКУП", callback_data: `buy_instant_${enrichedData.sourceAdId || 'unknown'}` },
                    { text: "🔍 ПОСМОТРЕТЬ В ТМА", url: `https://t.me/EuBikeBot/app?startapp=bike_${enrichedData.sourceAdId || 'unknown'}` },
                    { text: "❌ ИГНОРИРОВАТЬ", callback_data: `ignore_${enrichedData.sourceAdId || 'unknown'}` }
                ],
                // Add bike data for instant buy context
                bike_context: {
                    brand: enrichedData.brand,
                    model: enrichedData.model,
                    price: listing.price_eur,
                    fmv: realFMV,
                    url: enrichedData.originalUrl
                }
            };

            // Send to Manager Bot
            await dbRun("INSERT INTO bot_tasks (type, payload, status) VALUES (?, ?, ?)", 
                ['admin_broadcast', JSON.stringify(alarmPayload), 'pending']
            );
        }

        // Task 3: Handle Exceptions & Confidence
        let status = 'active';
        let needsAudit = 0;

        if (enrichedData.is_killed) {
            console.warn(`💀 AI Detected KILLED Bike. Marking for audit/salvage.`);
            status = 'hidden';
            needsAudit = 1;
        } else if (enrichedData.classificationConfidence < 0.8) {
            console.warn(`⚠️ Low confidence (${enrichedData.classificationConfidence}). Marking for review.`);
            status = 'pending'; 
            needsAudit = 1;
        }

        // 5. Publication (Save to DB)
        const bikePayload = {
            name: enrichedData.title,
            brand: enrichedData.brand,
            model: enrichedData.model,
            price: enrichedData.price,
            original_price: realFMV, // Use Real FMV as the "Market Value" shown to user
            discount: Math.round(((realFMV - listing.price_eur) / realFMV) * 100),
            category: enrichedData.category,
            year: enrichedData.year,
            condition: enrichedData.condition, // e.g. "Good", "Excellent"
            is_active: status === 'active' ? 1 : 0,
            description: enrichedData.description,
            original_url: enrichedData.originalUrl,
            discipline: enrichedData.discipline,
            location: enrichedData.location,
            is_negotiable: enrichedData.isNegotiable ? 1 : 0,
            wheel_diameter: enrichedData.wheelDiameter,
            size: enrichedData.frameSize,
            needs_audit: needsAudit,
            shipping_option: enrichedData.deliveryOption,
            // New AI Fields
            technical_score: technicalScore,
            condition_class: enrichedData.condition_class || (technicalScore >= 9 ? 'A' : technicalScore >= 6 ? 'B' : 'C'),
            condition_reason: enrichedData.mechanic_notes || enrichedData.justification,
            components_json: JSON.stringify(enrichedData.interesting_components || []),
            ai_specs: JSON.stringify(enrichedData.detected_specs || {}),
            description_ru: enrichedData.description_ru,
            hotness_score: hotnessScore,
            views_count: rawData.views,
            publish_date: rawData.publishDate
        };

        // Check if already exists
        const existing = await bikesDB.getQuery('SELECT id FROM bikes WHERE original_url = ?', [bikePayload.original_url]);
        if (existing) {
            console.log(`ℹ️ Bike already in catalog (ID: ${existing.id}). Skipping insert.`);
        } else {
            await bikesDB.addBike(bikePayload);
            console.log(`🚀 Published to Catalog!`);
            
            // --- Wishlist Sniper Check ---
            try {
                const newBike = await bikesDB.getQuery('SELECT * FROM bikes WHERE original_url = ?', [bikePayload.original_url]);
                if (newBike) {
                    const matches = await smartScout.checkSnipers([newBike]);
                    if (matches.length > 0) {
                        console.log(`🎯 Wishlist Matches Found: ${matches.length}`);
                        for (const match of matches) {
                            const message = `🎯 **WISHLIST SNIPER HIT!**\n\n` +
                                            `Мы нашли байк под ваш запрос!\n` +
                                            `🚲 **${match.bike_name}**\n` +
                                            `💰 **${bikePayload.price}€**\n` +
                                            `🔗 [Посмотреть](${bikePayload.original_url})`;
                            
                            // Send notification via Admin Bot (since we don't have direct user chat access here easily, 
                            // or we add to bot_tasks for broadcast)
                            // If we have user_id, we can target them if they are in telegram_users.
                            // For now, notify Admin/Manager.
                            
                            const adminMsg = `🎯 **Sniper Hit for User #${match.user_id}**\n` +
                                             `Query: (Sniper #${match.sniper_id})\n` +
                                             `Bike: ${match.bike_name}`;
                                             
                            await dbRun("INSERT INTO bot_tasks (type, payload, status) VALUES (?, ?, ?)", 
                                ['admin_broadcast', JSON.stringify({ message: adminMsg }), 'pending']
                            );
                        }
                    }
                }
            } catch (e) {
                console.error('❌ Sniper Check Failed:', e.message);
            }
        }

    } catch (e) {
        console.error(`❌ Error processing listing ${listing.id}:`, e);
    }
}

async function runOrchestrator() {
    console.log('🏗️ Starting Autonomous Hunter Orchestrator (BERSERK MODE READY)...');
    await bikesDB.ensureInitialized();

    while (true) {
        try {
            const timing = getCurrentPollInterval();
            console.log(`\n⏰ Cycle Start. Mode: ${timing.mode}`);

            // Proxy Check in Prime Time
            if (timing.isPrime) {
                const isProxyAlive = await checkProxyAvailability();
                if (!isProxyAlive) {
                    console.error('🚨 CRITICAL: Proxy Unreachable in Prime Time! Pausing Hunter.');
                    // Wait 5 minutes for recovery before retrying
                    console.log('⏳ Waiting 5 minutes for proxy recovery...');
                    await sleep(5 * 60 * 1000);
                    continue; 
                }
            }

            console.log('📡 Scanning Market History (Lake)...');

            // Find candidates in market_history that are NOT in bikes table
            // We use LEFT JOIN or NOT IN
            const query = `
                SELECT mh.* 
                FROM market_history mh
                LEFT JOIN bikes b ON mh.source_url = b.original_url
                WHERE b.id IS NULL
                ORDER BY mh.scraped_at DESC
                LIMIT ?
            `;
            
            const candidates = await dbAll(query, [BATCH_SIZE]);

            if (candidates.length === 0) {
                console.log('😴 No new candidates found.');
            } else {
                console.log(`🔍 Found ${candidates.length} candidates. Processing...`);
                
                for (const listing of candidates) {
                    await processListing(listing);
                }
            }

            console.log(`⏳ Sleeping ${Math.round(timing.ms / 1000)}s (${timing.mode})...`);
            await sleep(timing.ms);

        } catch (e) {
            console.error('💥 Critical Orchestrator Error:', e);
            await sleep(60000);
        }
    }
}

// Start
runOrchestrator();
