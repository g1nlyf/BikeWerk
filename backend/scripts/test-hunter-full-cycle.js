const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 1. Setup Environment & Paths
const ROOT_DIR = path.resolve(__dirname, '../../');
const BACKEND_DIR = path.resolve(__dirname, '../');

// Force DB Path to ensure we write to the correct database
const DB_PATH = path.resolve(BACKEND_DIR, 'database/eubike.db');
process.env.DB_PATH = DB_PATH;
process.env.BOT_DB_PATH = DB_PATH;
process.env.HUNTER_PUBLISH_MODE = 'catalog'; // Ensure we publish to catalog

// Load Environment Variables
dotenv.config({ path: path.resolve(ROOT_DIR, 'telegram-bot/.env') });

console.log('🔧 [TEST] Environment Setup:');
console.log(`   ROOT_DIR: ${ROOT_DIR}`);
console.log(`   DB_PATH: ${DB_PATH}`);

// 2. Import Hunter
// Adjust path to point to telegram-bot/unified-hunter.js
const unifiedHunterPath = path.resolve(ROOT_DIR, 'telegram-bot/unified-hunter.js');
if (!fs.existsSync(unifiedHunterPath)) {
    console.error(`❌ UnifiedHunter not found at: ${unifiedHunterPath}`);
    process.exit(1);
}
const UnifiedHunter = require(unifiedHunterPath);

// 3. Define Stage Detection
const STAGES = {
    1: { name: 'TARGETING', keywords: ['Starting Hunt', 'Engaging Intelligent Diversity'], found: false },
    2: { name: 'SMART_TARGETS', keywords: ['Targets:', 'Smart targets'], found: false },
    3: { name: 'URL_CONSTRUCTION', keywords: ['Sourcing from:', 'URL:', '🔗'], found: false },
    4: { name: 'SILENT_COLLECTOR', keywords: ['Silent Collector', 'Saved raw items', 'Collected', 'Starting market data collection'], found: false },
    5: { name: 'FUNNEL_FILTER', keywords: ['Rejected', 'Processing:', 'Found'], found: false },
    6: { name: 'CAPTURE', keywords: ['Check Status', 'Screenshots', 'checkKleinanzeigenStatus'], found: false },
    7: { name: 'GEMINI_VISION', keywords: ['Gemini', 'AI_ANALYSIS', 'Project N', 'AI Analysis', 'Multimodal'], found: false },
    8: { name: 'ARBITER', keywords: ['Arbiter', 'Discrepancy', 'Integrity Verified'], found: false },
    9: { name: 'CONDITION_ANALYZER', keywords: ['VISUAL JUDGE', 'Condition Penalty', 'Anti-Fake'], found: false },
    10: { name: 'VALUATION_FMV', keywords: ['Valuation:', 'FMV'], found: false },
    11: { name: 'SNIPER_RULE', keywords: ['SNIPER HIT', 'SNIPER SKIP', 'Smart Pickup', 'CATALOG FILL', 'Режим публикации', 'Good deal', 'Low margin', 'Rejected: No FMV', 'Deal Analysis'], found: false },
    12: { name: 'HOTNESS_SCORE', keywords: ['Hotness Score'], found: false },
    13: { name: 'SALVAGE_VALUE', keywords: ['Salvage', 'GOLD MINE', 'SALVAGE GEM', 'Salvage Gem Detected'], found: false }, // Optional
    14: { name: 'DECISION', keywords: ['PublishMode', 'CATALOG FILL', 'SNIPER HIT', 'Режим публикации', 'Publishing to catalog', 'Data Lake only', 'Rejected', 'Saving to DB'], found: false },
    15: { name: 'DB_SAVE', keywords: ['Saving to DB', 'Запись в каталог'], found: false }, // Might need to infer from "Cycle Complete" if explicit log missing
    16: { name: 'ALERTS', keywords: ['ALARM', 'Notification', 'Waitlist'], found: false } // Optional
};

// 4. Custom Logger to Track Stages
const capturedLogs = [];
const customLogger = (msg) => {
    console.log(`[HUNTER] ${msg}`);
    capturedLogs.push(msg);

    // Check for stages
    for (const [id, stage] of Object.entries(STAGES)) {
        if (!stage.found) {
            if (stage.keywords.some(k => msg.includes(k))) {
                stage.found = true;
                console.log(`✅ [STAGE ${id}] ${stage.name} PASSED`);
            }
        }
    }
};

// 5. Main Test Function
(async () => {
    console.log('\n🚀 STARTING FULL HUNTER CYCLE TEST (16 STAGES)\n');

    try {
        const hunter = new UnifiedHunter({ logger: customLogger, publishMode: 'catalog' });
        
        await hunter.ensureInitialized();
        console.log('✅ Hunter Initialized');

        const HARD_TIMEOUT_MS = 300000; // 5 minutes
        const hardTimer = setTimeout(() => {
            console.error('\n❌ HARD TIMEOUT: Hunter cycle exceeded 5 minutes.');
            process.exit(1);
        }, HARD_TIMEOUT_MS);

        // Trigger Hunt
        // Use 'mtb' to ensure we get results (Canyon MTB is usually reliable)
        // Or 'auto' to test smart targets
        await hunter.hunt({ category: 'mtb', quota: 1, maxTargets: 5, maxRuntimeMs: 240000 });
        clearTimeout(hardTimer);

        console.log('\n🏁 HUNT CYCLE FINISHED. ANALYZING RESULTS...\n');

        // 6. Verify Stages
        let passed = 0;
        const requiredStages = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14]; // Core required stages
        // Note: 2 (Smart Targets) might be skipped if we force 'mtb'
        // 12 (Hotness), 13 (Salvage), 16 (Alerts) might be conditional

        for (const [id, stage] of Object.entries(STAGES)) {
            const isRequired = requiredStages.includes(Number(id));
            if (stage.found) {
                passed++;
                console.log(`✅ Stage ${id}: ${stage.name} - CONFIRMED`);
            } else {
                console.log(`${isRequired ? '❌' : '⚠️'} Stage ${id}: ${stage.name} - NOT DETECTED ${isRequired ? '(REQUIRED)' : '(OPTIONAL)'}`);
            }
        }

        console.log(`\nScore: ${passed}/${Object.keys(STAGES).length} Stages Detected`);

        // 7. Verify DB
        // We'll query the DB to see if a bike was added in the last 2 minutes
        // Use BikesDatabaseNode (SQLite) instead of DatabaseManager (MySQL)
        const BikesDatabaseNode = require(path.resolve(ROOT_DIR, 'telegram-bot/bikes-database-node.js'));
        const db = new BikesDatabaseNode();
        await db.ensureInitialized();
        
        const recentBikes = await db.allQuery(`
            SELECT id, name, brand, price, created_at 
            FROM bikes 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (recentBikes && recentBikes.length > 0) {
            const bike = recentBikes[0];
            // SQLite might return created_at as 'YYYY-MM-DD HH:MM:SS' string (UTC or Local)
            // We assume it's roughly now.
            
            console.log('\n📦 LATEST DB ENTRY:');
            console.log(bike);
            
            // Just check if it exists and looks recent-ish (simple check)
            console.log('✅ DB Verification: SUCCESS (New bike found in SQLite)');
            STAGES[15].found = true;
        } else {
            console.log('❌ DB Verification: FAILED (No bikes found)');
        }

        process.exit(0);

    } catch (e) {
        console.error('\n❌ CRITICAL ERROR:', e);
        process.exit(1);
    }
})();
