/**
 * FMV Refiller - Collects market data for Fair Market Value analysis
 * 
 * Uses canonical collectors to fill market_history table.
 * No AI processing - just raw data collection for FMV calculations.
 * 
 * Run: node backend/cron/fill-fmv.js
 */

const { DB_PATH } = require('../config/db-path');
const Database = require('better-sqlite3');
const BuycycleCollector = require('../scrapers/buycycle-collector');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

class FMVRefiller {
    constructor() {
        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL');
        this.targetCount = 100; // Reduced for faster testing

        // Priority brands for balanced FMV data
        this.brands = [
            'Specialized', 'Canyon', 'Cube', 'Trek', 'Santa Cruz',
            'Scott', 'Giant', 'YT', 'Commencal', 'Propain'
        ];
    }

    async run() {
        console.log('\n' + '═'.repeat(60));
        console.log('📉 FMV REFILLER - Canonical Flow');
        console.log('═'.repeat(60));
        console.log(`Time: ${new Date().toLocaleString('de-DE')}`);
        console.log(`Database: ${DB_PATH}\n`);

        try {
            // Ensure market_history table exists
            this.ensureTable();

            // Randomize brands
            const shuffledBrands = this.brands.sort(() => Math.random() - 0.5).slice(0, 5);

            let totalSaved = 0;
            const perBrand = Math.ceil(this.targetCount / shuffledBrands.length);

            for (const brand of shuffledBrands) {
                if (totalSaved >= this.targetCount) break;

                console.log(`\n🔍 Collecting FMV data for ${brand}...`);

                try {
                    // Use collectForTarget with proper parameters
                    const listings = await BuycycleCollector.collectForTarget({
                        brand: brand,
                        model: '', // Empty = any model
                        minPrice: 500,
                        maxPrice: 10000,
                        limit: perBrand
                    });

                    if (!listings || listings.length === 0) {
                        console.log(`   ⚠️ No listings found for ${brand}`);
                        continue;
                    }

                    console.log(`   📦 Collected ${listings.length} listings`);

                    // Save to market_history (no AI processing needed - already done by collector)
                    let savedCount = 0;

                    const stmt = this.db.prepare(`
                        INSERT OR IGNORE INTO market_history 
                        (title, price_eur, source_url, brand, category, model, year, created_at, scraped_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    `);

                    const insertMany = this.db.transaction((items) => {
                        for (const item of items) {
                            const price = this.extractPrice(item);
                            const url = item.meta?.source_url || item.url || '';
                            const model = item.basic_info?.model || '';
                            const year = item.basic_info?.year || null;
                            const title = item.basic_info?.name || item.title || '';

                            if (price && price > 100 && url) {
                                try {
                                    stmt.run(
                                        title,
                                        price,
                                        url,
                                        brand,
                                        'MTB', // Default category
                                        model,
                                        year
                                    );
                                    savedCount++;
                                } catch (e) {
                                    // Skip duplicates
                                }
                            }
                        }
                    });

                    insertMany(listings);
                    console.log(`   ✅ Saved ${savedCount} new FMV records for ${brand}`);
                    totalSaved += savedCount;

                } catch (e) {
                    console.error(`   ❌ Error collecting ${brand}: ${e.message}`);
                }

                // Polite delay between brands
                console.log('   ⏳ Cooling down 3s...');
                await this.delay(3000);
            }

            // Summary
            const stats = this.getStats();
            console.log('\n' + '═'.repeat(60));
            console.log('📊 FMV REFILL COMPLETE');
            console.log('═'.repeat(60));
            console.log(`New records this run: ${totalSaved}`);
            console.log(`Total in market_history: ${stats.total}`);
            console.log(`Unique brands: ${stats.brands}`);
            console.log(`Date range: ${stats.oldest} to ${stats.newest}\n`);

        } catch (error) {
            console.error('❌ FMV Refill failed:', error);
            throw error;
        } finally {
            this.db.close();
        }
    }

    ensureTable() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS market_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                price_eur REAL,
                source_url TEXT UNIQUE,
                brand TEXT,
                category TEXT,
                model TEXT,
                year INTEGER,
                created_at TEXT,
                scraped_at TEXT
            )
        `);

        // Create index for faster lookups
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_market_history_brand 
            ON market_history(brand)
        `);

        console.log('✅ market_history table ready');
    }

    extractPrice(item) {
        // Try different price locations
        if (item.pricing?.price) return item.pricing.price;
        if (item.price) return typeof item.price === 'number' ? item.price : this.parsePrice(item.price);
        return 0;
    }

    parsePrice(s) {
        if (typeof s === 'number') return s;
        if (!s) return 0;
        const cleaned = String(s).replace(/[^\d,.]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    }

    getStats() {
        try {
            const total = this.db.prepare('SELECT COUNT(*) as c FROM market_history').get();
            const brands = this.db.prepare('SELECT COUNT(DISTINCT brand) as c FROM market_history').get();
            const dates = this.db.prepare(`
                SELECT MIN(created_at) as oldest, MAX(created_at) as newest 
                FROM market_history
            `).get();

            return {
                total: total?.c || 0,
                brands: brands?.c || 0,
                oldest: dates?.oldest || 'N/A',
                newest: dates?.newest || 'N/A'
            };
        } catch (e) {
            return { total: 0, brands: 0, oldest: 'N/A', newest: 'N/A' };
        }
    }

    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

// Run if called directly
if (require.main === module) {
    const refiller = new FMVRefiller();
    refiller.run()
        .then(() => {
            console.log('\n✅ FMV Refill complete!');
            process.exit(0);
        })
        .catch(e => {
            console.error('\n❌ FMV Refill failed:', e);
            process.exit(1);
        });
}

module.exports = FMVRefiller;
