class ProfitCalculator {
    constructor(db) {
        this.db = db;
    }

    async calculateProfit(bike) {
        // Logic:
        // Profit = FMV - CurrentPrice - ShippingCost (Assume 50€ shipping/logistics buffer if not specified)
        // If FMV not found: Profit = (CurrentPrice * 1.2) - CurrentPrice
        
        // Shipping Cost Assumption: 0 for calculation to match User Formula explicitly:
        // User said: "$Profit = FMV - CurrentPrice - ShippingCost$" but didn't give ShippingCost value.
        // But then for fallback: "$Profit = (CurrentPrice \times 1.2) - CurrentPrice$".
        // Let's assume ShippingCost = 0 for now unless we have data, or maybe 50 is a safe bet.
        // User formula: Profit = FMV - CurrentPrice - ShippingCost.
        // Let's look at the user prompt again. "Profit = FMV - CurrentPrice - ShippingCost".
        // I will use 0 for ShippingCost for now to be safe, or 50 if I want to be conservative.
        // Given the fallback is 20% margin, 0 shipping makes the logic cleaner.
        
        const shippingCost = 0; 
        const fmv = await this._getFMV(bike.brand, bike.model, bike.year);
        
        // Logistic Sniper 2.0: Negotiation Premium
        // If pickup-only and NOT guaranteed (Marburg Hub), we add 50€ "bribe" to the cost.
        let negotiationBonus = 0;
        if (bike.shipping_option === 'pickup-only' && !bike.guaranteed_pickup) {
            negotiationBonus = 50;
        }

        let profit = 0;
        let calculationMethod = 'fmv';

        if (fmv && fmv > 0) {
            profit = fmv - bike.price - shippingCost - negotiationBonus;
        } else {
            // Fallback: 20% margin
            // Ensure bike.price is valid
            const safePrice = bike.price > 0 ? bike.price : 0;
            if (safePrice > 0) {
                // If fallback, we still need to account for the bonus in the margin?
                // Or is the 1.2x just a crude estimation? 
                // Let's subtract the bonus from the potential profit.
                const grossProfit = (safePrice * 1.2) - safePrice;
                profit = grossProfit - negotiationBonus;
            } else {
                profit = 0;
            }
            calculationMethod = 'fallback_1.2x';
        }

        return {
            profit: Math.round(profit),
            fmv: fmv ? Math.round(fmv) : null,
            method: calculationMethod
        };
    }

    async _getFMV(brand, model, year) {
        if (!brand || !model) return null;
        
        // Search market_history for similar bikes
        // We use a simple average of price_eur for matching brand/model
        // Ideally we filter by year if available, but market_history might not have year.
        // Let's try matching brand and model.
        
        try {
            const query = `
                SELECT price_eur 
                FROM market_history 
                WHERE brand LIKE ? 
                AND model_name LIKE ? 
                AND price_eur > 0
            `;
            
            // Clean model for search (remove year, size if possible)
            // But strict matching is better for FMV.
            // Let's use %model%
            
            const rows = await this.db.allQuery(query, [`%${brand}%`, `%${model}%`]);
            
            if (!rows || rows.length < 3) {
                // Not enough data for reliable FMV
                return null;
            }

            // Calculate Median to avoid outliers
            const prices = rows.map(r => r.price_eur).sort((a, b) => a - b);
            const median = prices[Math.floor(prices.length / 2)];
            
            return median;
        } catch (e) {
            console.error('Error calculating FMV:', e.message);
            return null;
        }
    }
}

module.exports = ProfitCalculator;
