const { DatabaseManager } = require('../backend/src/js/mysql-config');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const db = new DatabaseManager();

async function testHunterStats() {
    console.log("Testing Hunter Stats Logic...");
    try {
        let timeFilter = 'date("now", "-1 day")'; 
        
        // 1. Found (Market History)
        const [found] = await db.query(`SELECT COUNT(*) as c FROM market_history WHERE created_at > ${timeFilter}`);
        console.log('Found (24h):', found.c);
        
        // 2. Analyzed (Bikes created)
        const [analyzed] = await db.query(`SELECT COUNT(*) as c FROM bikes WHERE created_at > ${timeFilter}`);
        console.log('Analyzed (24h):', analyzed.c);
        
        // 3. Published (Active bikes)
        const [published] = await db.query(`SELECT COUNT(*) as c FROM bikes WHERE is_active = 1 AND created_at > ${timeFilter}`);
        console.log('Published (24h):', published.c);

        console.log("✅ Database queries successful");
    } catch (e) {
        console.error("❌ Test failed:", e);
    }
}

testHunterStats();
