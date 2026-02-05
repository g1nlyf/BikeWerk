const { db } = require('../src/js/mysql-config');
const TechDecoder = require('../src/services/TechDecoder');
const BikesDB = require('../src/data/bikes-db'); // Assuming this exists for easy bike insertion, otherwise direct SQL
const path = require('path');

// Initialize services
const decoder = new TechDecoder();
// If BikesDB is a class, instantiate it. If it's a module with static methods, use as is. 
// I'll use direct DB queries to be safe and avoid circular dependencies or unknown interfaces, 
// unless I check BikesDB first. But for now, I'll rely on db.query.

async function retryFailedBikes() {
    console.log('🔄 Starting Failed Bikes Retry Protocol...');

    try {
        // Fetch candidates
        const failedBikes = await db.query(`
            SELECT * FROM failed_bikes 
            WHERE status IN ('pending', 'retrying') 
            AND attempts < 5
            ORDER BY created_at ASC
            LIMIT 10
        `);

        if (failedBikes.length === 0) {
            console.log('✅ No failed bikes to retry.');
            return;
        }

        console.log(`🔍 Found ${failedBikes.length} bikes to retry.`);

        for (const record of failedBikes) {
            console.log(`\n-----------------------------------`);
            console.log(`🔧 Retrying Bike ID ${record.id} (Attempt ${record.attempts + 1}/5)`);
            
            let rawData;
            try {
                rawData = JSON.parse(record.raw_data);
            } catch (e) {
                console.error('❌ JSON Parse Error:', e.message);
                await db.query("UPDATE failed_bikes SET status = 'discarded', error_message = 'JSON Parse Error' WHERE id = ?", [record.id]);
                continue;
            }

            try {
                // Increment attempt counter immediately
                await db.query("UPDATE failed_bikes SET attempts = attempts + 1, last_retry = CURRENT_TIMESTAMP WHERE id = ?", [record.id]);

                // 1. Re-run Normalization
                const normalized = await decoder.normalize(rawData);

                // 2. Validate Result
                if (normalized.quality_score > 40) {
                    console.log(`✅ Success! Quality Score: ${normalized.quality_score}`);
                    
                    // 3. Insert into main DB
                    // Construct columns/values dynamically based on normalized data
                    // This is a simplified insertion. In production, use a dedicated Model/Service.
                    
                    const bikeData = {
                        name: `${normalized.brand} ${normalized.model}`,
                        brand: normalized.brand,
                        model: normalized.model,
                        year: normalized.year,
                        price: normalized.price_eur,
                        category: normalized.category,
                        condition_status: normalized.condition,
                        description: normalized.description_summary || 'No description',
                        main_image: rawData.image || rawData.images?.[0] || '',
                        source_url: rawData.url,
                        audit_status: 'needs_audit', // Flag for manual review since it was tricky
                        is_active: 1,
                        quality_score: normalized.quality_score
                    };

                    // Check if exists first to avoid duplicates
                    const existing = await db.query("SELECT id FROM bikes WHERE source_url = ?", [bikeData.source_url]);
                    
                    if (existing.length === 0) {
                         const keys = Object.keys(bikeData);
                         const values = Object.values(bikeData);
                         const placeholders = keys.map(() => '?').join(',');
                         const sql = `INSERT INTO bikes (${keys.join(',')}) VALUES (${placeholders})`;
                         
                         await db.query(sql, values);
                         console.log(`   💾 Saved to 'bikes' table.`);
                    } else {
                        console.log(`   ⚠️ Bike already exists in DB (ID: ${existing[0].id}). Marking resolved.`);
                    }

                    // 4. Mark Resolved
                    await db.query("UPDATE failed_bikes SET status = 'resolved' WHERE id = ?", [record.id]);

                } else {
                    console.warn(`   ⚠️ Still low quality (${normalized.quality_score}). Leaving for next retry.`);
                    if (record.attempts + 1 >= 5) {
                         await db.query("UPDATE failed_bikes SET status = 'discarded', error_message = 'Max retries exceeded' WHERE id = ?", [record.id]);
                         console.log('   🗑️ Max retries reached. Discarding.');
                    } else {
                         await db.query("UPDATE failed_bikes SET status = 'retrying' WHERE id = ?", [record.id]);
                    }
                }

            } catch (processError) {
                console.error(`   ❌ Processing Error:`, processError.message);
                await db.query("UPDATE failed_bikes SET error_message = ? WHERE id = ?", [processError.message, record.id]);
            }

            // Exponential backoff logic is handled by the loop delay here
            // Wait 5 seconds between retries to be gentle
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error('CRITICAL ERROR in Retry Script:', error);
    } finally {
        // Only close if running standalone
        if (require.main === module) {
            // db.close(); // DatabaseManager handles connection persistence usually
        }
    }
}

// Run if called directly
if (require.main === module) {
    retryFailedBikes();
}

module.exports = retryFailedBikes;
