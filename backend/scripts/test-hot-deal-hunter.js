/**
 * Test script for HotDealHunter
 * Tests the full flow: scraping → normalization → database save
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DatabaseManager = require('../database/db-manager');

async function ensureTables() {
    console.log('📦 Ensuring required tables exist...\n');
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    
    // hunter_events table
    db.exec(`
        CREATE TABLE IF NOT EXISTS hunter_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            source TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('   ✅ hunter_events table ready');
    
    // failed_bikes table  
    db.exec(`
        CREATE TABLE IF NOT EXISTS failed_bikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE,
            raw_data TEXT,
            error_message TEXT,
            status TEXT DEFAULT 'pending',
            attempts INTEGER DEFAULT 0,
            last_retry DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('   ✅ failed_bikes table ready\n');
}

async function testHotDealHunter() {
    console.log('═'.repeat(60));
    console.log('🧪 HOT DEAL HUNTER TEST');
    console.log('═'.repeat(60) + '\n');
    
    // 1. Ensure tables
    await ensureTables();
    
    // 2. Load HotDealHunter
    console.log('📥 Loading HotDealHunter...');
    const HotDealHunter = require('../src/services/HotDealHunter');
    console.log('   ✅ Loaded\n');
    
    // 3. Check current hot deals count
    const dbManager = new DatabaseManager();
    const db = dbManager.getDatabase();
    
    const before = db.prepare(`
        SELECT COUNT(*) as cnt FROM bikes WHERE is_hot_offer = 1
    `).get();
    console.log(`📊 Current hot deals in DB: ${before.cnt}\n`);
    
    // 4. Run hunt with limit of 2 for testing
    console.log('🔥 Starting hunt (limit: 2)...\n');
    const startTime = Date.now();
    
    try {
        const stats = await HotDealHunter.hunt(2);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n' + '═'.repeat(60));
        console.log('📊 TEST RESULTS');
        console.log('═'.repeat(60));
        console.log(`   Duration: ${duration}s`);
        console.log(`   Found: ${stats.found}`);
        console.log(`   Processed: ${stats.processed}`);
        console.log(`   Added: ${stats.added}`);
        console.log(`   Duplicates: ${stats.duplicates}`);
        console.log(`   Errors: ${stats.errors}`);
        
        // Check new hot deals count
        const after = db.prepare(`
            SELECT COUNT(*) as cnt FROM bikes WHERE is_hot_offer = 1
        `).get();
        console.log(`\n   Hot deals in DB: ${before.cnt} → ${after.cnt} (+${after.cnt - before.cnt})`);
        
        // Show latest hot deals
        const latest = db.prepare(`
            SELECT id, name, brand, price, quality_score, ranking_score, created_at
            FROM bikes 
            WHERE is_hot_offer = 1 
            ORDER BY created_at DESC 
            LIMIT 5
        `).all();
        
        if (latest.length > 0) {
            console.log('\n📋 Latest Hot Deals:');
            latest.forEach(b => {
                console.log(`   [${b.id}] ${b.brand} - €${b.price} (Q:${b.quality_score}, R:${b.ranking_score?.toFixed(2)})`);
            });
        }
        
        // Check hunter events
        const events = db.prepare(`
            SELECT type, details, created_at 
            FROM hunter_events 
            WHERE source = 'HotDealHunter' 
            ORDER BY created_at DESC 
            LIMIT 5
        `).all();
        
        if (events.length > 0) {
            console.log('\n📋 Recent Events:');
            events.forEach(e => {
                const details = JSON.parse(e.details || '{}');
                console.log(`   [${e.type}] ${details.title || 'N/A'} (${e.created_at})`);
            });
        }
        
        console.log('\n✅ Test complete!\n');
        
        return stats.added > 0 || stats.duplicates > 0;
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run test
testHotDealHunter()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
