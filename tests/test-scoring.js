const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ScoringService = require('../telegram-bot/ScoringService');
const UniversalLogger = require('../telegram-bot/UniversalLogger');
const DiversityManager = require('../telegram-bot/DiversityManager');
const BikesDatabase = require('../telegram-bot/bikes-database-node');

// Init Logger
const logger = new UniversalLogger({ logDir: path.resolve(__dirname, '../logs') });
logger.info('🧪 Starting Stage 1 Test: Scoring Engine');

// Init DB
const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
const dbInstance = new sqlite3.Database(DB_PATH);

// Mock BikesDatabase for ScoringService (it expects a wrapper with .db property)
const mockBikesDB = { db: dbInstance };
const scoringService = new ScoringService(mockBikesDB);
const diversityManager = new DiversityManager();

async function getRandomListings(limit = 10) {
    return new Promise((resolve, reject) => {
        // Fetch rows that have brand and model info for FMV calculation
        const query = `
            SELECT * FROM market_history 
            WHERE brand IS NOT NULL AND model_name IS NOT NULL AND price_eur > 0
            ORDER BY RANDOM() 
            LIMIT ?
        `;
        dbInstance.all(query, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function runTest() {
    try {
        logger.info('Fetching 10 random listings from Lake...');
        const listings = await getRandomListings(10);
        
        if (listings.length === 0) {
            logger.error('No listings found in market_history. Please ensure DB is populated.');
            return;
        }

        const scoredBikes = [];

        for (const listing of listings) {
            // 1. Calculate FMV (Simulated "Sniper" step)
            const fmv = await scoringService.calculateFMV(listing.brand, listing.model_name);
            
            // 2. Simulate AI Condition Score (1-10)
            // For test, we assign random condition or derive from keywords if available
            // Let's be random but deterministic based on price to make it interesting
            const simulatedCondition = 5 + Math.floor(Math.random() * 5); // 5-9
            
            // 3. Calculate Score
            const result = scoringService.calculateDesirability(listing, fmv, simulatedCondition);
            
            const bikeData = {
                ...listing,
                fmv,
                conditionScore: simulatedCondition,
                score: result
            };
            
            scoredBikes.push(bikeData);
        }

        // 4. Sort by Desirability
        scoredBikes.sort((a, b) => b.score.totalScore - a.score.totalScore);

        // 5. Output Detailed Log
        console.log('\n📊 SCORING RESULTS:\n');
        
        for (const bike of scoredBikes) {
            const s = bike.score;
            const c = s.components;
            const r = c.rawValues;
            
            const diversity = diversityManager.categorize(bike);
            
            // "Bike X: Profit 22%, Cond 9/10, Brand 1.2. Total Score: 8.4. Recommended..."
            const profitMsg = r.profitPercent > 0 ? `Profit ${r.profitPercent}%` : `Overpriced`;
            const recommendation = s.totalScore > 7.0 ? '✅ BUY' : (s.totalScore > 5.0 ? '⚠️ CONSIDER' : '❌ SKIP');
            
            const msg = `Bike: ${bike.brand} ${bike.model_name} (${bike.price_eur}€) [FMV: ${r.fmv || 'N/A'}€]
   Details: ${profitMsg} | Cond ${r.conditionRaw}/10 | Brand Factor ${r.brandFactor}
   Scores:  P=${c.profitScore} | C=${c.conditionScore} | B=${c.brandScore}
   Total:   ${s.totalScore}
   Type:    ${diversity.type.toUpperCase()} (${diversity.budget})
   Result:  ${recommendation}`;
            
            logger.info(msg);
            console.log(msg + '\n');
        }
        
        // Diversity Check
        const batch = diversityManager.selectBatch(scoredBikes, 5);
        logger.info(`\n🧺 Diversity Batch (Top 5): ${batch.map(b => b.brand).join(', ')}`);

    } catch (e) {
        logger.error('Test Failed:', e);
    } finally {
        dbInstance.close();
    }
}

runTest();
