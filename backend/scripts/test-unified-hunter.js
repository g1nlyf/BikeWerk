/**
 * Test UnifiedHunter (Kleinanzeigen) - Quick smoke test
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Set DB path
process.env.BOT_DB_PATH = path.resolve(__dirname, '../database/eubike.db');
process.env.DB_PATH = process.env.BOT_DB_PATH;

const DatabaseManager = require('../database/db-manager');

async function testUnifiedHunter() {
    console.log('═'.repeat(60));
    console.log('🧪 UNIFIED HUNTER TEST (Kleinanzeigen)');
    console.log('═'.repeat(60) + '\n');
    
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    
    // Get initial count
    const beforeCount = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE source_platform LIKE ?').get('%kleinanzeigen%');
    console.log(`📊 Kleinanzeigen bikes before: ${beforeCount.cnt}\n`);
    
    // Load UnifiedHunter
    console.log('📥 Loading UnifiedHunter...');
    const UnifiedHunter = require('../../telegram-bot/unified-hunter');
    
    const logger = (msg) => console.log(`   ${msg}`);
    const hunter = new UnifiedHunter({ logger });
    
    console.log('🔧 Initializing...');
    await hunter.ensureInitialized();
    console.log('   ✅ Initialized\n');
    
    // Test URL builder
    console.log('🔍 Testing URL Builder...');
    const testUrl = hunter.urlBuilder.buildSearchURL({
        brand: 'Specialized',
        model: 'Stumpjumper',
        category: 'mtb',
        minPrice: 1000,
        maxPrice: 3000
    });
    console.log(`   ✅ URL: ${testUrl}\n`);
    
    // Test HTML fetch
    console.log('🌐 Testing HTML fetch...');
    try {
        const html = await hunter.fetchHtml(testUrl);
        console.log(`   ✅ Fetched ${html?.length || 0} chars\n`);
        
        // Parse search items
        console.log('📋 Testing search parser...');
        const items = hunter.parseSearchItems(html);
        console.log(`   ✅ Found ${items?.length || 0} items\n`);
        
        if (items && items.length > 0) {
            console.log('📋 First 3 items:');
            items.slice(0, 3).forEach((item, i) => {
                console.log(`   ${i+1}. ${item.title?.substring(0, 50)}...`);
                console.log(`      Price: ${item.price}`);
                console.log(`      Link: ${item.link?.substring(0, 60)}...`);
            });
            
            // Process ONE item (quick test)
            console.log('\n🔄 Processing first item...');
            const firstItem = items[0];
            
            if (firstItem && firstItem.link) {
                console.log(`   Target: ${firstItem.title}`);
                
                try {
                    // Check if already exists
                    const existing = db.prepare('SELECT id FROM bikes WHERE source_url = ?').get(firstItem.link);
                    if (existing) {
                        console.log('   ⚠️ Already in DB, skipping processing');
                    } else {
                        console.log('   🤖 Processing listing...');
                        const result = await hunter.processListing(firstItem.link);
                        console.log(`   ✅ Process result: ${result ? 'Success' : 'Failed'}`);
                    }
                } catch (e) {
                    console.error(`   ❌ Error: ${e.message}`);
                }
            }
        }
    } catch (e) {
        console.error(`   ❌ Fetch error: ${e.message}`);
    }
    
    // Final count
    const afterCount = db.prepare('SELECT COUNT(*) as cnt FROM bikes WHERE source_platform LIKE ?').get('%kleinanzeigen%');
    console.log(`\n📊 Kleinanzeigen bikes after: ${afterCount.cnt} (+${afterCount.cnt - beforeCount.cnt})`);
    
    console.log('\n✅ Test complete!\n');
}

testUnifiedHunter()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
