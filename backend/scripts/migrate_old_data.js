const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const GeminiProcessor = require('../../telegram-bot/gemini-processor');

// Config
const BATCH_SIZE = 5;
const LIMIT_RECORDS = 10000; // Process all records

const DB_PATH = path.join(__dirname, '../database/eubike.db');
const db = new Database(DB_PATH);

const geminiProcessor = new GeminiProcessor(
    null, 
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
);
geminiProcessor.timeout = 120000;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateOldData() {
    console.log('🔄 Starting migration of old data (Scenario A fix)...');
    
    // 1. Select old records (quality_score = 0 OR category IS NULL)
    // Filter by created_at < '2026-01-26' as established in diagnosis
    // Use scraped_at if created_at not available (schema check showed scraped_at)
    // Actually schema check showed scraped_at in market_history.
    
    const query = `
        SELECT * FROM market_history 
        WHERE (quality_score = 0 OR category IS NULL OR category = '')
        AND scraped_at < '2026-01-26'
        LIMIT ?
    `;
    
    const oldRecords = db.prepare(query).all(LIMIT_RECORDS);
    
    console.log(`Found ${oldRecords.length} old records to migrate (Limit: ${LIMIT_RECORDS})`);
    
    if (oldRecords.length === 0) {
        console.log('✅ No records need migration.');
        return;
    }

    // 2. Batch Processing
    for (let i = 0; i < oldRecords.length; i += BATCH_SIZE) {
        const batch = oldRecords.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
        
        const inputData = batch.map((b, idx) => ({
            index: idx,
            title: b.title,
            description: b.title, // Use title as description if desc missing or to save tokens, real code uses desc
            price: b.price_eur
        }));

        const prompt = `
        You are a bike data normalization expert.
        INPUT: Array of bike listings (JSON)
        OUTPUT: Normalized array with EXACT fields (JSON only, no markdown)
        
        Required output format:
        [
          {
            "index": 0,
            "brand": "Canyon",
            "model": "Spectral",
            "year": 2022,
            "frame_material": "Carbon",
            "trim_level": "CF 9",
            "category": "MTB",
            "quality_score": 85
          }
        ]
        
        Rules:
        - model: BASE model only
        - trim_level: extract variant
        - year: null if uncertain
        - category: MTB/Road/E-Bike/Gravel/City/Other
        - quality_score: 0-100
        - frame_material: Carbon/Aluminum/Steel/Titanium/null
        
        Input:
        ${JSON.stringify(inputData)}
        `;

        try {
            const responseText = await geminiProcessor.callGeminiAPI(prompt);
            const cleanJson = responseText.replace(/```json\s*/g, '').replace(/```/g, '').trim();
            const normalized = JSON.parse(cleanJson);
            
            if (!Array.isArray(normalized)) {
                console.error('❌ AI response is not an array.');
                continue;
            }

            // 3. UPDATE market_history
            const updateStmt = db.prepare(`
                UPDATE market_history 
                SET 
                  year = ?, 
                  category = ?, 
                  trim_level = ?, 
                  frame_material = ?, 
                  quality_score = ?,
                  brand = ?,
                  model = ?
                WHERE id = ?
            `);

            let updatedCount = 0;
            for (const item of normalized) {
                const original = batch[item.index];
                if (!original) continue;
                
                try {
                    updateStmt.run(
                        item.year, 
                        item.category, 
                        item.trim_level, 
                        item.frame_material, 
                        item.quality_score,
                        item.brand,
                        item.model,
                        original.id
                    );
                    updatedCount++;
                    console.log(`   ✅ Updated ID ${original.id}: ${item.brand} ${item.model} (${item.year || '?'})`);
                } catch (e) {
                    console.error(`   ❌ Failed to update ID ${original.id}: ${e.message}`);
                }
            }
            console.log(`   Batch complete: ${updatedCount} updated.`);

        } catch (e) {
            console.error(`❌ Batch processing error: ${e.message}`);
            await sleep(5000); // Wait longer on error
        }
        
        await sleep(2000); // Rate limit protection
    }
    
    console.log('✅ Migration test complete');
}

migrateOldData().catch(console.error);
