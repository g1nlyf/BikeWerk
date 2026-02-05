require('dotenv').config();
const GeminiProcessor = require('./gemini-processor');
const ConditionAnalyzer = require('./ConditionAnalyzer');
const BikesDatabaseNode = require('./bikes-database-node');
const path = require('path');
const fs = require('fs');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
// Using v1beta and gemini-2.5-flash as requested/stable
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function runSimulation() {
    console.log('🚀 Starting Hunter Simulation with Gemini 2.5 Flash...');
    
    // 1. Setup Components
    const geminiProcessor = new GeminiProcessor(GEMINI_KEY, GEMINI_URL);
    geminiProcessor.timeout = 60000; // Increase timeout to 60s for stability
    
    // Mock techDecoder for ConditionAnalyzer (simplified)
    const techDecoder = {
        decode: (title, desc) => ({
            brand: 'Cube',
            model: 'Attain SL',
            year: null,
            material: 'Aluminium',
            wheelSize: '28',
            isBike: true
        })
    };
    
    const conditionAnalyzer = new ConditionAnalyzer(geminiProcessor, techDecoder);
    const bikesDB = new BikesDatabaseNode();
    await bikesDB.ensureInitialized();

    // 2. Prepare Data (Simulated Real Request)
    const rawData = {
        title: 'Cube Rennrad Attain SL - Shimano 105 - Rahmengröße 60',
        description: `Ich biete hier mein Cube Rennrad vom Modell Attain SL an. Das Rad befindet sich in einem sehr guten Zustand und ist sofort fahrbereit.Das Rennrad wurde ca. 1000 km gefahren und stets gepflegt. Die Kette ist frisch gereinigt und geölt, die Schaltung funktioniert einwandfrei. Lediglich an der Kurbel des Tretlagers sind ein paar leichte Gebrauchsspuren (siehe Bilder), die die Funktion in keiner Weise beeinträchtigen.Ich verkaufe das Fahrrad, weil mir beim Kauf leider eine falsche Rahmengröße genannt wurde – für mich ist es einfach zu groß.Technische Daten:    •    Modell: Cube Attain SL    •    Farbe: Schwarz/Grün    •    Rahmengröße: 60 cm    •    Gänge: 22 (2x11)    •    Schaltkomponenten: Shimano 105    •    Gabel: CSL Race, Carbon super light    •    Bremsen: Shimano Scheibenbremsen    •    Laufräder: Fulcrum Racing Seventyseven DB    •    Reifen: Continental Grandsport Race    •    Pedale: Shimano SPD Klick-PedaleZusätzlich im Angebot enthalten:    •    Sigma Tacho    •    Trelock Faltschloss inkl. Schlüssel    •    2 Flaschenhalter (1x am Rahmen, 1x als Doppelhalter am Sattel)Wichtig:Eine Rückgabe ist ausgeschlossen.Ein Versand ist leider nicht möglich – Abholung und Probefahrt vor Ort sind aber gerne nach Absprache möglich.Bei Fragen einfach melden – ich antworte so schnell wie möglich!`,
        price: 850, // Estimated from typical market or listing (user didn't provide price, I'll use a placeholder or extract if possible. In real scenario parser gets it. I'll put a reasonable guess or leave it for AI to find if in text, but text doesn't have it. I'll use 850 as placeholder)
        location: 'Holzwickede',
        link: 'https://www.kleinanzeigen.de/s-anzeige/cube-rennrad-attain-sl-shimano-105-rahmengroesse-60/3118002799-217-1371',
        currency: 'EUR',
        isNegotiable: true,
        deliveryOption: 'pickup-only'
    };

    // Images (Use existing screenshots from repo)
    // For this simulation, we'll try to use existing images but since they don't match the BMC bike,
    // we expect the AI to lean on the text description due to the prompt instructions we just added.
    // However, if the images are clearly NOT a road bike, it might get confused.
    // Let's use whatever images we have, but rely on the fix in createFlexiblePrompt to prioritize text/merge info.
    const screenshotsDir = path.join(__dirname, 'autocat-klein', 'screenshots');
    let imagePaths = [];
    
    try {
        if (fs.existsSync(screenshotsDir)) {
            const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.jpg')).slice(0, 2);
            if (files.length >= 1) {
                imagePaths = files.map(f => path.join(screenshotsDir, f));
                console.log(`📸 Using images: ${files.join(', ')}`);
            } else {
                console.warn('⚠️ No screenshots found in autocat-klein/screenshots. Checking telegram-bot/screenshots...');
            }
        }
        
        if (imagePaths.length === 0) {
             const altDir = path.join(__dirname, 'screenshots');
             if (fs.existsSync(altDir)) {
                const files = fs.readdirSync(altDir).filter(f => f.endsWith('.jpg')).slice(0, 2);
                if (files.length >= 1) {
                    imagePaths = files.map(f => path.join(altDir, f));
                    console.log(`📸 Using images from backup: ${files.join(', ')}`);
                }
             }
        }

        if (imagePaths.length === 0) {
            console.error('❌ No screenshots found! Cannot simulate multimodal request.');
            // Create a dummy image if needed or fail?
            // User wants "Real requests", so we need real images.
            // If no images, we can't fully test multimodal.
            // Let's assume there are images because I saw them in `ls`.
            process.exit(1);
        }

    } catch (e) {
        console.error('Error finding images:', e);
        process.exit(1);
    }

    // 3. Execution & Cost Tracking
    const requestLog = [];
    
    // Wrap GeminiProcessor.callGeminiAPI / callGeminiMultimodal to track requests
    const originalCallAPI = geminiProcessor.callGeminiAPI.bind(geminiProcessor);
    geminiProcessor.callGeminiAPI = async (...args) => {
        const start = Date.now();
        console.log('➡️ Sending TEXT request...');
        try {
            const res = await originalCallAPI(...args);
            const dur = Date.now() - start;
            requestLog.push({ type: 'text', duration: dur, success: true });
            console.log(`✅ TEXT request success (${dur}ms)`);
            return res;
        } catch (e) {
            const dur = Date.now() - start;
            requestLog.push({ type: 'text', duration: dur, success: false, error: e.message });
            console.error(`❌ TEXT request failed (${dur}ms):`, e.message);
            throw e;
        }
    };

    const originalCallMultimodal = geminiProcessor.callGeminiMultimodal.bind(geminiProcessor);
    geminiProcessor.callGeminiMultimodal = async (...args) => {
        const start = Date.now();
        console.log('➡️ Sending MULTIMODAL request...');
        try {
            const res = await originalCallMultimodal(...args);
            const dur = Date.now() - start;
            requestLog.push({ type: 'multimodal', duration: dur, success: true });
            console.log(`✅ MULTIMODAL request success (${dur}ms)`);
            return res;
        } catch (e) {
            const dur = Date.now() - start;
            requestLog.push({ type: 'multimodal', duration: dur, success: false, error: e.message });
            console.error(`❌ MULTIMODAL request failed (${dur}ms):`, e.message);
            throw e;
        }
    };

    try {
        // Step A: Multimodal Analysis (The heavy lifter)
        console.log('\n📡 Step 1: Multimodal Analysis (Images + Context)...');
        const ctx = {
            originalUrl: rawData.link,
            title: rawData.title,
            description: rawData.description,
            price: rawData.price,
            location: rawData.location
        };
        
        let imgData = {};
        if (imagePaths.length >= 2) {
            imgData = await geminiProcessor.processBikeDataFromTwoShots(imagePaths[0], imagePaths[1], ctx);
        } else {
            imgData = await geminiProcessor.processBikeDataFromImages(imagePaths, ctx);
        }
        console.log('✅ Multimodal Data Received');

        // Step B: Finalize Unified Data (Merge)
        console.log('\n📡 Step 2: Finalize Unified Data...');
        const finalData = await geminiProcessor.finalizeUnifiedData(rawData, imgData);
        
        // Step C: Condition Analysis
        console.log('\n📡 Step 3: Condition Analysis...');
        const techSpecs = techDecoder.decode(rawData.title, rawData.description);
        const conditionReport = await conditionAnalyzer.analyzeBikeCondition(imagePaths, rawData.description, techSpecs);
        console.log('✅ Condition Report Received');

        // Step D: Save to DB
        console.log('\n💾 Saving to Database...');
        
        const dbData = {
            name: finalData.title || rawData.title,
            brand: finalData.brand || 'Unknown',
            model: finalData.model || 'Unknown',
            price: Number(finalData.price || 0),
            category: (finalData.category && finalData.category !== 'null') ? finalData.category : 'Other',
            description: finalData.description,
            year: finalData.year,
            frame_material: finalData.material || finalData.frameMaterial,
            size: finalData.frameSize,
            wheel_diameter: finalData.wheelDiameter,
            condition_status: 'used',
            is_active: 1, 
            original_url: rawData.link,
            images: [],
            source: 'SimulatedHunter',
            location: finalData.location,
            is_negotiable: finalData.isNegotiable ? 1 : 0,
            discipline: finalData.discipline,
            seller_name: finalData.sellerName,
            seller_type: finalData.sellerType,
            seller_member_since: finalData.sellerMemberSince,
            seller_badges_json: finalData.sellerBadges ? JSON.stringify(finalData.sellerBadges) : null,
            // AI Condition Data
            condition_score: conditionReport.score,
            condition_grade: conditionReport.grade,
            condition_penalty: conditionReport.penalty,
            condition_reason: conditionReport.reason,
            needs_audit: conditionReport.needs_review ? 1 : 0,
            shipping_option: rawData.deliveryOption || 'unknown'
        };

        const savedBike = await bikesDB.addBike(dbData);
        console.log(`✅ Bike added to catalog! ID: ${savedBike.lastID}`);

        // 4. Report
        console.log('\n📊 --- COST REPORT ---');
        console.log(`Total Requests: ${requestLog.length}`);
        console.log(`Successful: ${requestLog.filter(r => r.success).length}`);
        console.log(`Failed: ${requestLog.filter(r => !r.success).length}`);
        requestLog.forEach((r, i) => {
            console.log(`Request ${i+1}: ${r.type.toUpperCase()} - ${r.duration}ms - ${r.success ? 'OK' : 'FAIL'}`);
        });

        console.log('\n📄 Final JSON Object (Saved to DB):');
        console.log(JSON.stringify(dbData, null, 2));

    } catch (err) {
        console.error('❌ Simulation Failed:', err);
    }
}

runSimulation();
