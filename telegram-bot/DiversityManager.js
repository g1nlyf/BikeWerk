class DiversityManager {
    constructor() {
        this.targets = {
            mtb: 0.45,
            gravel: 0.25,
            road: 0.2,
            emtb: 0.08,
            kids: 0.02
        };
        
        this.budgetLayers = {
            budget: { max: 1500, label: 'Budget' },
            mid: { min: 1500, max: 3500, label: 'Mid-Range' },
            premium: { min: 3500, label: 'Premium' }
        };
    }

    categorize(bike) {
        // Simple heuristic based on category/discipline
        // Assuming bike object has 'category' or 'discipline' or 'title'
        const text = `${bike.title || ''} ${(bike.category || '')} ${(bike.discipline || '')}`.toLowerCase();
        
        let type = 'mtb';
        if (text.match(/kids|kid|детск|child|junior|kinder|14\"|16\"|20\"|24\"/)) {
            type = 'kids';
        } else if (text.match(/e-mtb|emtb|e mtb|ebike|e-bike|pedelec|elektro|electric/)) {
            type = 'emtb';
        } else if (text.match(/gravel|allroad|all-road|bikepacking|cyclocross|cx/)) {
            type = 'gravel';
        } else if (text.match(/road|rennrad|aero|endurance|climbing|tt|triathlon|tarmac|roubaix|ultimate|litening|aeroad|venge|madone|emonda|domane|addict|supersix|systemsix/)) {
            type = 'road';
        } else if (text.match(/mtb|mountain|enduro|downhill|trail|xc|hardtail|fully|jekyll|megatower|rise|trance|scalpel|strive|spectral|capra|jeffsy|neuron|stumpjumper|epic|spark|scale/)) {
            type = 'mtb';
        }
        
        // Budget
        const price = bike.price || bike.price_eur || 0;
        let budget = 'budget';
        if (price >= 3500) budget = 'premium';
        else if (price >= 1500) budget = 'mid';
        
        return { type, budget };
    }

    selectBatch(candidates, n = 20) {
        // Sort by Desirability Score descending
        const sorted = candidates.sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));
        
        const batch = [];
        const counts = Object.fromEntries(Object.keys(this.targets).map(key => [key, 0]));
        const entries = Object.entries(this.targets).map(([key, ratio]) => {
            const raw = n * ratio;
            return { key, base: Math.floor(raw), frac: raw - Math.floor(raw) };
        });
        const limits = {};
        let total = 0;
        for (const entry of entries) {
            limits[entry.key] = entry.base;
            total += entry.base;
        }
        let remaining = n - total;
        entries.sort((a, b) => b.frac - a.frac);
        let idx = 0;
        while (remaining > 0 && entries.length > 0) {
            const key = entries[idx % entries.length].key;
            limits[key] += 1;
            remaining -= 1;
            idx += 1;
        }

        for (const bike of sorted) {
            if (batch.length >= n) break;
            
            const cat = this.categorize(bike);
            if (limits[cat.type] !== undefined && counts[cat.type] < limits[cat.type]) {
                batch.push({ ...bike, _diversityCat: cat });
                counts[cat.type]++;
            }
        }
        
        // Fill remaining slots if any category didn't meet quota
        if (batch.length < n) {
            for (const bike of sorted) {
                if (batch.length >= n) break;
                if (!batch.includes(bike)) {
                    batch.push({ ...bike, _diversityCat: this.categorize(bike), _fill: true });
                }
            }
        }
        
        return batch;
    }
}

module.exports = DiversityManager;
