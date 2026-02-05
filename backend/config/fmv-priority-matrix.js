const path = require('path');
const Database = require('better-sqlite3');
const brandsConfig = require('./brands-config.json');

class FMVPriorityMatrix {
    constructor() {
        this.dbPath = process.env.DB_PATH 
            ? path.resolve(process.cwd(), process.env.DB_PATH)
            : path.join(__dirname, '../database/eubike.db');
        this.matrix = this.buildMatrix();
    }

    buildMatrix() {
        const matrix = [];

        // Helper to add items
        const addItems = (tierList, tier, priority, target, margin, weight) => {
            if (!tierList) return;
            tierList.forEach(brand => {
                brand.models.forEach(model => {
                    matrix.push({
                        brand: brand.name,
                        model: model,
                        tier: tier,
                        priority: priority,
                        target_records: target,
                        min_price: brand.minPrice,
                        expected_margin: margin,
                        weight: weight
                    });
                });
            });
        };

        // Tier 1: HIGH PRIORITY
        addItems(brandsConfig.tier1, 1, 100, 50, 0.35, 10);

        // Tier 2: MEDIUM PRIORITY
        addItems(brandsConfig.tier2, 2, 50, 30, 0.25, 5);

        // Tier 3: LOW PRIORITY
        addItems(brandsConfig.tier3, 3, 20, 20, 0.15, 2);

        return matrix;
    }

    // Get the next target for FMV collection
    getNextTarget() {
        const coverage = this.getCurrentCoverage();

        // Sort by priority score (priority * gap)
        const targets = this.matrix.map(item => {
            const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}`;
            const current = coverage[key] || 0;
            const gap = Math.max(0, item.target_records - current);
            
            // Score calculation:
            // Base priority * gap
            // Boost for Tier 1 if gap is large
            let score = item.priority * gap;
            
            if (item.tier === 1 && gap > 20) score *= 1.5;

            return { ...item, current_records: current, gap, score };
        })
        .filter(t => t.gap > 0) // Only those that need data
        .sort((a, b) => b.score - a.score); // Descending order

        // Return top result or null
        return targets.length > 0 ? targets[0] : null;
    }
    
    // Get top N targets
    getTopTargets(limit = 10) {
        const coverage = this.getCurrentCoverage();
        
        return this.matrix.map(item => {
            const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}`;
            const current = coverage[key] || 0;
            const gap = Math.max(0, item.target_records - current);
            let score = item.priority * gap;
            if (item.tier === 1 && gap > 20) score *= 1.5;
            
            return { ...item, current_records: current, gap, score };
        })
        .filter(t => t.gap > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    getCurrentCoverage() {
        const db = new Database(this.dbPath, { readonly: true });
        const coverage = {};

        try {
            // Get all coverage in one go for performance
            // We group by brand and model (fuzzy match normalization might be needed but we'll try direct match first)
            // Using LIKE for model matching as models in DB might be "Stumpjumper Evo" etc.
            
            // To avoid N queries, we can fetch all relevant records and process in JS, or use a complex query.
            // Given the matrix size (~100 models), individual queries are acceptable for a config tool, 
            // but fetching all high-quality records is faster.
            
            const rows = db.prepare(`
                SELECT brand, model 
                FROM market_history 
                WHERE quality_score >= 70
            `).all();
            
            // Normalize and count
            rows.forEach(row => {
                if (!row.brand || !row.model) return;
                const b = row.brand.toLowerCase();
                const m = row.model.toLowerCase();
                
                // Map DB record to Matrix Item
                // We need to find which matrix item this record belongs to
                // Optimization: Pre-build a map or regex
                
                // Simple iteration for now (can be optimized if slow)
                const matrixItem = this.matrix.find(item => 
                    b.includes(item.brand.toLowerCase()) && 
                    m.includes(item.model.toLowerCase())
                );
                
                if (matrixItem) {
                    const key = `${matrixItem.brand.toLowerCase()}:${matrixItem.model.toLowerCase()}`;
                    coverage[key] = (coverage[key] || 0) + 1;
                }
            });
            
        } catch (e) {
            console.error('Error getting coverage:', e);
        } finally {
            db.close();
        }

        return coverage;
    }

    // Detailed coverage for dashboard
    getDetailedCoverage() {
        const coverage = this.getCurrentCoverage();
        const detailed = this.matrix.map(item => {
            const key = `${item.brand.toLowerCase()}:${item.model.toLowerCase()}`;
            const current = coverage[key] || 0;
            const progress = (current / item.target_records * 100).toFixed(0);
            
            return {
                brand: item.brand,
                model: item.model,
                tier: item.tier,
                current: current,
                target: item.target_records,
                progress: `${progress}%`,
                status: current >= item.target_records ? '✅ READY' : 
                        current >= item.target_records * 0.5 ? '🟡 PARTIAL' : '🔴 MISSING'
            };
        });

        return {
            tier1: detailed.filter(d => d.tier === 1),
            tier2: detailed.filter(d => d.tier === 2),
            tier3: detailed.filter(d => d.tier === 3)
        };
    }

    // Statistics
    getCoverageStats() {
        const coverage = this.getCurrentCoverage();

        const getTierStats = (tier) => {
            const items = this.matrix.filter(m => m.tier === tier);
            if (items.length === 0) return { ready: '0/0 (0%)', gap: 0 };
            
            const filled = items.filter(m => {
                const key = `${m.brand.toLowerCase()}:${m.model.toLowerCase()}`;
                return (coverage[key] || 0) >= m.target_records;
            }).length;
            
            const totalGap = items.reduce((acc, m) => {
                const key = `${m.brand.toLowerCase()}:${m.model.toLowerCase()}`;
                return acc + Math.max(0, m.target_records - (coverage[key] || 0));
            }, 0);

            return {
                ready: `${filled}/${items.length} (${(filled / items.length * 100).toFixed(0)}%)`,
                gap: totalGap
            };
        };

        return {
            tier1: getTierStats(1),
            tier2: getTierStats(2),
            tier3: getTierStats(3),
            total_targets: this.matrix.length
        };
    }
}

module.exports = new FMVPriorityMatrix();
