const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { BuycycleCollector } = require('./buycycle-collector');
const UnifiedNormalizer = require('../src/services/UnifiedNormalizer');
const DatabaseService = require('../src/services/DatabaseService');

puppeteer.use(StealthPlugin());

class HotDealHunter {
    constructor(options = {}) {
        this.baseUrl = 'https://buycycle.com/de-de/shop/main-types/bikes/bike-types/mountainbike/min-price/500/sort-by/new/high-demand/1';
        this.limit = options.limit || 5;
        this.dbService = new DatabaseService();
        this.collector = new BuycycleCollector();
    }

    async hunt() {
        // Use BuycycleCollector's built-in robust logic
        const segment = 'mountainbike/min-price/500/sort-by/new/high-demand/1';
        console.log(`🔥 [HotDealHunter] Delegate hunt to BuycycleCollector for segment: ${segment}`);
        
        try {
            // collectHighDemand returns normalized, AI-enhanced bikes
            const enrichedBikes = await this.collector.collectHighDemand(segment, this.limit);
            
            console.log(`   ✅ Received ${enrichedBikes.length} enriched bikes from collector.`);
            const processedBikes = [];

            for (const bike of enrichedBikes) {
                try {
                    console.log(`\n   💾 Saving Hot Offer: ${bike.basic_info?.brand} ${bike.basic_info?.model}`);
                    
                    // Mark as Hot Offer explicitly
                    bike.basic_info.is_hot_offer = true;
                    if (bike.meta) {
                        bike.meta.is_hot_offer = true;
                    }

                    const saveResult = await this.dbService.saveBikesToDB(bike);
                    
                    if (saveResult.inserted > 0 || saveResult.duplicates > 0) {
                        console.log('      ✅ Saved successfully');
                        processedBikes.push(bike);
                    } else {
                        console.log('      ⚠️ Save reported no insertion/duplicate (check logs)');
                    }

                } catch (err) {
                    console.error(`      ❌ Error saving bike:`, err.message);
                }
            }

            return processedBikes;

        } catch (error) {
            console.error(`   ❌ [HotDealHunter] Error: ${error.message}`);
            return [];
        }
    }

    // Legacy method - removed in favor of delegation
    async _extractLinks(page) { return []; }
}

module.exports = HotDealHunter;
