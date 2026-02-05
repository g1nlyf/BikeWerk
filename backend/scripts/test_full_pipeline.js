
const { BuycycleCollector } = require('../scrapers/buycycle-collector');
const normalizer = require('../src/services/UnifiedNormalizer');
const DatabaseService = require('../src/services/DatabaseService');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  saveToDb: process.argv.includes('--save-to-db'),
  targetUrl: process.argv.find(arg => arg.startsWith('--url='))?.split('=')[1]
};

async function runTest() {
  console.log('🚀 Starting Full Pipeline Test');
  console.log('-----------------------------------');
  
  if (!CONFIG.targetUrl) {
    console.error('❌ Error: --url parameter is required');
    console.log('Usage: node test_full_pipeline.js --url="<URL>" [--save-to-db]');
    process.exit(1);
  }

  try {
    // 1. Initialize Services
    console.log('📦 Initializing services...');
    // normalizer is already an instance
    const dbService = new DatabaseService();

    // 2. Run Collector
    console.log(`\n🕵️  Scraping URL: ${CONFIG.targetUrl}`);
    const collector = new BuycycleCollector();
    const rawData = await collector.collect(CONFIG.targetUrl);
    
    if (!rawData) {
      throw new Error('Collector returned null data');
    }
    
    console.log(`✅ Scraped successfully: ${rawData.title}`);
    console.log(`📸 Found images: ${rawData.images?.length || 0}`);
    
    // 3. Run Normalizer (Gemini)
    console.log('\n🧠 Running Gemini Normalization...');
    const normalized = await normalizer.normalize(rawData);
    
    console.log('✅ Normalization complete');
    console.log('-----------------------------------');
    console.log('Condition Assessment:');
    console.log(JSON.stringify(normalized.condition, null, 2));
    console.log('-----------------------------------');
    console.log(`Gallery size: ${normalized.media?.gallery?.length || 0}`);

    // 4. Save to DB (Optional)
    if (CONFIG.saveToDb) {
      console.log('\n💾 Saving to Database...');

      // NEW: Cleanup existing bike to ensure fresh insert/update verification
      try {
          const DatabaseManager = require('../database/db-manager');
          const dbManager = new DatabaseManager();
          const db = dbManager.getDatabase();
          
          // Helper to delete by ID
          const deleteById = (id) => {
              try {
                  db.prepare('DELETE FROM bike_images WHERE bike_id = ?').run(id);
                  db.prepare('DELETE FROM bikes WHERE id = ?').run(id);
                  console.log(`🗑️ Deleted existing bike ID ${id} (and related images)`);
                  return true;
              } catch (err) {
                  console.log(`⚠️ Failed to delete bike ID ${id}: ${err.message}`);
                  return false;
              }
          };

          let deleted = false;
          
          // 1. Try by source_ad_id
          if (normalized.meta && normalized.meta.source_ad_id) {
              const row = db.prepare('SELECT id FROM bikes WHERE source_ad_id = ?').get(normalized.meta.source_ad_id);
              if (row) {
                  deleted = deleteById(row.id);
              }
          }
          
          // 2. Try by source_url if not deleted
          if (!deleted) {
              const row = db.prepare('SELECT id FROM bikes WHERE source_url = ?').get(CONFIG.targetUrl);
              if (row) {
                  deleted = deleteById(row.id);
              }
          }
          
          if (!deleted) {
              console.log('ℹ️ No existing record found to delete');
          }
      } catch (e) {
          console.log('⚠️ Failed to cleanup existing bike:', e.message);
      }

      // HACK: Randomize source_ad_id to force new insert and bypass FK constraints on old records
      if (normalized.meta) {
          normalized.meta.source_ad_id = `${normalized.meta.source_ad_id}_TEST_${Date.now()}`;
          console.log(`🔧 Randomized source_ad_id to: ${normalized.meta.source_ad_id}`);
      }

      const saveResult = await dbService.saveBikesToDB([normalized]);
      
      // Check for inserted or total processed
      if (saveResult && (saveResult.inserted > 0 || saveResult.total > 0)) {
        console.log('✅ Saved successfully!');
        
        // Fetch back to verify
        try {
            const DatabaseManager = require('../database/db-manager');
            const dbManager = new DatabaseManager();
            const db = dbManager.getDatabase();
            
            let row;
            // Try to get ID from result
            if (saveResult.results && saveResult.results.length > 0 && saveResult.results[0].bike_id) {
                const id = saveResult.results[0].bike_id;
                console.log(`🔍 Verifying ID: ${id}`);
                row = db.prepare('SELECT * FROM bikes WHERE id = ?').get(id);
            } else {
                row = db.prepare('SELECT * FROM bikes WHERE source_url = ? OR url = ?').get(CONFIG.targetUrl, CONFIG.targetUrl);
            }

            if (row) {
                console.log(`✅ [VERIFY] Bike found in DB! ID: ${row.id}`);
                console.log(`   Gallery Length: ${row.gallery ? JSON.parse(row.gallery).length : 0}`);
                console.log(`   Condition: Class=${row.condition_class}, Score=${row.condition_score}, Grade=${row.condition_grade}`);
                
                // Write dump
                const dumpPath = path.join(__dirname, '../logs/pipeline/db_dump.json');
                const dir = path.dirname(dumpPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                
                fs.writeFileSync(dumpPath, JSON.stringify(row, null, 2));
                console.log(`💾 Dumped DB record to ${dumpPath}`);
            } else {
                console.error('❌ [VERIFY] Bike NOT found in DB despite success report.');
            }
        } catch (err) {
            console.error('❌ [VERIFY] Error querying DB:', err);
        }
      } else {
        console.error('❌ Save failed or no bikes processed', saveResult);
      }
    }

  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    process.exit(1);
  }
}

runTest();
