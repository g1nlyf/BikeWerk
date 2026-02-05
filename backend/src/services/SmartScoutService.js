const { DatabaseManager } = require('../js/mysql-config.js');
const geminiProcessor = require('./geminiProcessor.js');

class SmartScoutService {
    constructor(dbManager) {
        this.db = dbManager || new DatabaseManager();
    }

    /**
     * Search bikes using natural language
     * @param {string} query - User's natural language query
     * @returns {Promise<Object>} - { filters, results, is_fallback }
     */
    async searchBikes(query) {
        // 1. Interpret Query
        console.log(`[SmartScout] Interpreting query: "${query}"`);
        const filters = await geminiProcessor.interpretSearchQuery(query);
        console.log('[SmartScout] Extracted filters:', filters);

        // 2. Build SQL
        let sql = "SELECT * FROM bikes WHERE is_active = 1";
        const params = [];

        if (filters.type) {
            sql += " AND (category LIKE ? OR model LIKE ?)";
            params.push(`%${filters.type}%`, `%${filters.type}%`);
        }

        if (filters.material) {
            sql += " AND (description LIKE ? OR model LIKE ?)";
            params.push(`%${filters.material}%`, `%${filters.material}%`);
        }

        if (filters.sizes && filters.sizes.length > 0) {
            const sizeConditions = filters.sizes.map(() => "size LIKE ?").join(" OR ");
            // This assumes a 'size' column exists or we check description. 
            // Standard schema might not have 'size' explicitly in 'bikes' table, often in 'bike_specs' or description.
            // For now, let's search description for size.
            // A robust implementation would join with bike_specs.
            // Let's assume description search for simplicity in this sprint.
            const sizeOr = filters.sizes.map(s => `description LIKE ?`).join(" OR ");
            sql += ` AND (${sizeOr})`;
            filters.sizes.forEach(s => params.push(`%${s}%`));
        }

        if (filters.brands && filters.brands.length > 0) {
            const brandOr = filters.brands.map(() => "brand LIKE ?").join(" OR ");
            sql += ` AND (${brandOr})`;
            filters.brands.forEach(b => params.push(`%${b}%`));
        }

        if (filters.min_price) {
            sql += " AND price >= ?";
            params.push(filters.min_price);
        }

        if (filters.max_price) {
            sql += " AND price <= ?";
            params.push(filters.max_price);
        }

        if (filters.keywords && filters.keywords.length > 0) {
             filters.keywords.forEach(k => {
                 sql += " AND (name LIKE ? OR description LIKE ?)";
                 params.push(`%${k}%`, `%${k}%`);
             });
        }

        sql += " ORDER BY rank DESC LIMIT 50";

        // 3. Execute
        const results = await this.db.query(sql, params);

        return {
            filters,
            results,
            count: results.length
        };
    }

    /**
     * Save a failed search as a Wishlist Sniper
     */
    async createWishlistSniper(userId, sessionId, query, filters) {
        // Check if similar exists to avoid duplicates
        const existing = await this.db.query(
            "SELECT id FROM wishlist_snipers WHERE query_text = ? AND (user_id = ? OR session_id = ?) AND is_active = 1",
            [query, userId || null, sessionId || null]
        );
        
        if (existing.length > 0) return existing[0].id;

        const result = await this.db.query(
            "INSERT INTO wishlist_snipers (user_id, session_id, query_text, structured_criteria) VALUES (?, ?, ?, ?)",
            [userId || null, sessionId || null, query, JSON.stringify(filters)]
        );
        
        console.log(`[SmartScout] Created Wishlist Sniper #${result.insertId} for "${query}"`);
        return result.insertId;
    }

    /**
     * Check a list of NEW bikes against active wishlist snipers
     * This is called by the Hunter
     * @param {Array} newBikes - Array of bike objects
     */
    async checkSnipers(newBikes) {
        if (!newBikes || newBikes.length === 0) return [];

        const snipers = await this.db.query("SELECT * FROM wishlist_snipers WHERE is_active = 1");
        const matches = [];

        for (const sniper of snipers) {
            const criteria = JSON.parse(sniper.structured_criteria);
            
            for (const bike of newBikes) {
                // Simple matching logic
                let score = 0;
                let required = 0;

                if (criteria.type) {
                    required++;
                    if (bike.category?.toLowerCase().includes(criteria.type.toLowerCase()) || 
                        bike.model?.toLowerCase().includes(criteria.type.toLowerCase())) score++;
                }

                if (criteria.max_price) {
                    required++;
                    if (bike.price <= criteria.max_price) score++;
                }

                if (criteria.min_price) {
                    required++;
                    if (bike.price >= criteria.min_price) score++;
                }
                
                if (criteria.brands && criteria.brands.length > 0) {
                    required++;
                    if (criteria.brands.some(b => bike.brand.toLowerCase().includes(b.toLowerCase()))) score++;
                }

                // Threshold: If we match all hard constraints (or high %)
                // Relaxed: > 75% match
                if (required > 0 && (score / required) >= 0.75) {
                    matches.push({
                        sniper_id: sniper.id,
                        user_id: sniper.user_id,
                        bike_id: bike.id,
                        bike_name: `${bike.brand} ${bike.model}`,
                        score: score
                    });
                    
                    // Update stats
                    await this.db.query(
                        "UPDATE wishlist_snipers SET matches_found = matches_found + 1, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?",
                        [sniper.id]
                    );
                }
            }
        }
        
        return matches;
    }
    
    async saveSwipe(userId, sessionId, bikeId, action) {
        await this.db.query(
            "INSERT INTO user_swipes (user_id, session_id, bike_id, action) VALUES (?, ?, ?, ?)",
            [userId || null, sessionId || null, bikeId, action]
        );
    }
}

module.exports = { SmartScoutService };
