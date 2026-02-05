const UnifiedHunter = require('../scripts/unified-hunter.js');
const DatabaseManager = require('../database/db-manager');

// Register ts-node if needed (for imports inside UnifiedHunter)
try {
    require('ts-node').register({
        transpileOnly: true
    });
} catch (e) { }

class FMVRefiller {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.hunter = new UnifiedHunter({ logger: console.log });
        this.targetCount = 500;
    }

    async run() {
        console.log('\n' + '═'.repeat(60));
        console.log('📉 FMV REFILLER - Auto Run');
        console.log('═'.repeat(60));
        console.log(`Time: ${new Date().toLocaleString('de-DE')}\n`);

        try {
            await this.hunter.ensureInitialized();
            const db = this.dbManager.getDatabase();

            const brands = [
                'Specialized', 'Canyon', 'Cube', 'Trek', 'Santa Cruz',
                'Scott', 'Giant', 'YT', 'Orbea', 'Commencal',
                'Propain', 'Rose', 'Radon', 'Focus', 'Cannondale'
            ];

            // Randomize brands
            brands.sort(() => Math.random() - 0.5);

            let totalSaved = 0;
            const perBrand = Math.ceil(this.targetCount / brands.length);

            for (const brand of brands) {
                if (totalSaved >= this.targetCount) break;

                console.log(`🔍 Collecting data for ${brand}...`);

                // Build URL for broad search
                const url = this.hunter.urlBuilder.buildSearchURL({
                    brand: brand,
                    minPrice: 500,
                    maxPrice: 10000,
                    shippingRequired: false // Get all data for FMV
                });

                const listings = await this.hunter.fetchMarketData(url, 'MTB');

                if (listings && listings.length > 0) {
                    let savedCount = 0;
                    const stmt = db.prepare(`
                        INSERT OR IGNORE INTO market_history 
                        (title, price_eur, source_url, brand, category, created_at, scraped_at)
                        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    `);

                    const insertMany = db.transaction((items) => {
                        for (const item of items) {
                            // Extract title, price, url
                            const price = this.hunter.parsePriceEUR(item.price);
                            if (price && price > 100) {
                                stmt.run(item.title, price, item.link, brand, 'MTB');
                                savedCount++;
                            }
                        }
                    });

                    try {
                        insertMany(listings);
                        console.log(`   ✅ Saved ${savedCount} records for ${brand}`);
                        totalSaved += savedCount;
                    } catch (e) {
                        console.error(`   ❌ Error saving batch: ${e.message}`);
                    }
                }

                // Pause to be polite
                await new Promise(r => setTimeout(r, 2000));
            }

            console.log(`\n✅ FMV Refill Complete. Total saved: ${totalSaved}\n`);

        } catch (error) {
            console.error('❌ Error in FMV Refill:', error);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const refiller = new FMVRefiller();
    refiller.run().then(() => process.exit(0)).catch(e => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = FMVRefiller;
