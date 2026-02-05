const BikesDatabase = require('./bikes-database-node');
const UniversalLogger = require('./UniversalLogger');

class SupplyGapAnalyzer {
    constructor() {
        this.db = new BikesDatabase();
        this.logger = new UniversalLogger();
    }

    async analyzeGaps() {
        await this.db.ensureInitialized();
        this.logger.info('🕵️ Starting Supply Gap Analysis...');

        // 1. Analyze SEARCH_ABANDON events (User Gaps)
        // Look back 24 hours
        const userGaps = await this._analyzeUserGaps(24);
        
        // 2. Analyze Inventory Gaps
        const inventoryGaps = await this._analyzeInventoryGaps();

        // 3. Calculate Priorities
        const priorities = this._calculatePriorities(userGaps, inventoryGaps);

        return priorities;
    }

    async _analyzeUserGaps(hours) {
        // Since we are in telegram-bot context, we need to access the same DB as backend.
        // BikesDatabase connects to the same sqlite file.
        // We need raw access to `user_interactions`.
        
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        const rows = await this.db.allQuery(
            `SELECT payload FROM user_interactions 
             WHERE event_type = 'SEARCH_ABANDON' 
             AND created_at >= ?`, 
            [since]
        );

        // Aggregate by category/size/brand
        const gaps = {};

        for (const row of rows) {
            try {
                const data = JSON.parse(row.payload);
                // Key: Category + Size (if available) + Brand (optional)
                // Simplify to Category first
                const cat = data.category || 'Any';
                // Extract size from search string if possible or structured filter?
                // Currently API doesn't filter by size cleanly in backend (it's in specs), 
                // but let's assume we focus on category for now.
                
                if (!gaps[cat]) gaps[cat] = 0;
                gaps[cat]++;

            } catch (e) {
                // ignore parse error
            }
        }
        
        this.logger.info(`📉 User Gaps Detected: ${JSON.stringify(gaps)}`);
        return gaps;
    }

    async _analyzeInventoryGaps() {
        const rows = await this.db.allQuery(
            `SELECT category, COUNT(*) as count FROM bikes 
             WHERE is_active = 1 
             GROUP BY category`
        );
        
        const inventory = {};
        rows.forEach(r => inventory[r.category] = r.count);
        return inventory;
    }

    _calculatePriorities(userDemand, inventorySupply, activeBounties = []) {
        const priorities = [];
        const categories = new Set([
            ...Object.keys(userDemand), 
            ...Object.keys(inventorySupply),
            ...activeBounties.map(b => b.category).filter(Boolean)
        ]);

        // Count bounties per category
        const bountyCounts = {};
        activeBounties.forEach(b => {
            const cat = b.category || 'Any';
            bountyCounts[cat] = (bountyCounts[cat] || 0) + 1;
        });

        for (const cat of categories) {
            if (cat === 'Any') continue;

            const demand = userDemand[cat] || 0;
            const supply = inventorySupply[cat] || 1; // Avoid division by zero
            const bounties = bountyCounts[cat] || 0;
            
            // Profit Factor (Base 1.0, could be higher for E-Bikes)
            const profitFactor = (cat === 'Электро' || cat === 'E-Bike') ? 1.5 : 1.0;

            // Formula: Priority = (Demand / Supply) * ProfitFactor
            // Bounty Boost: +10 per active bounty
            let score = ((demand + 1) / (supply + 1)) * profitFactor * 10; 
            
            if (bounties > 0) {
                score += (bounties * 10.0); // Infinite priority boost simulation
            }

            priorities.push({
                category: cat,
                score: parseFloat(score.toFixed(2)),
                demand,
                supply,
                bounties,
                isUrgent: score > 2.0 // Threshold
            });
        }

        return priorities.sort((a, b) => b.score - a.score);
    }

    async _analyzeBounties() {
        // Fetch active orders that are looking for a bike
        // For now, we assume 'new' orders with no bike_id are bounties, 
        // OR orders with specific source 'sniper'.
        // This is a placeholder implementation.
        try {
            const rows = await this.db.allQuery(
                `SELECT o.id, o.customer_id 
                 FROM orders o 
                 WHERE o.status IN ('new', 'searching') 
                 AND o.bike_id IS NULL`
            );
            
            return rows.map(r => {
                // Try to parse requirements from notes
                // e.g. "Looking for MTB, Size L"
                // This is very rough.
                return {
                    id: r.id,
                    customer_id: r.customer_id,
                    raw_notes: '', // Column order_notes does not exist yet
                    // Mock data to prevent errors in matchBounty
                    category: 'Any', 
                    brand: '',
                    max_price: 100000
                };
            });
        } catch (e) {
            this.logger.error('Error fetching bounties', e);
            return [];
        }
    }

    matchBounty(bike) {
        // Check if this bike matches any active bounty
        // Simple matching logic
        const self = this;
        return new Promise(async (resolve) => {
             try {
                 const bounties = await this._analyzeBounties();
                 const matches = bounties.filter(b => {
                     // Category match
                     if (b.category && bike.category && !bike.category.includes(b.category)) return false;
                     // Brand match (fuzzy)
                     if (b.brand && bike.brand && !bike.brand.toLowerCase().includes(b.brand.toLowerCase())) return false;
                     // Price match
                     if (b.max_price && bike.price > b.max_price) return false;
                     // Size match
                     if (b.size && bike.size && bike.size !== b.size) return false;
                     // Grade match (A, B, C)
                     // If bounty wants A, bike must be A. If B, bike can be A or B.
                     if (b.min_grade && bike.initial_quality_class) {
                         const grades = { 'A': 3, 'B': 2, 'C': 1 };
                         const req = grades[b.min_grade] || 1;
                         const actual = grades[bike.initial_quality_class] || 1;
                         if (actual < req) return false;
                     }
                     return true;
                 });
                 resolve(matches);
             } catch (e) {
                 console.error('Bounty match error', e);
                 resolve([]);
             }
        });
    }
}

module.exports = SupplyGapAnalyzer;
