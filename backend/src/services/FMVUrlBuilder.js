
class FMVUrlBuilder {
    constructor() {
        this.baseUrl = 'https://buycycle.com/de-de/shop';
    }

    /**
     * Generates a collection plan with URLs for specific model/year combinations
     * @param {Array} whitelist - Array of { brand: string, model: string }
     * @param {Object} yearRange - { start: number, end: number }
     * @returns {Array} Plan objects { brand, model, year, url }
     */
    generateCollectionPlan(whitelist, yearRange) {
        const plan = [];
        const { start, end } = yearRange;

        for (const item of whitelist) {
            for (let year = start; year <= end; year++) {
                // Construct specific URL for this year only
                // https://buycycle.com/de-de/shop/min-year/2025/max-year/2025/search/YT%20Capra
                const query = `${item.brand} ${item.model}`;
                const encodedQuery = encodeURIComponent(query);
                
                // Note: The user example had /search/ at the end. 
                // Buycycle URL structure can be: /min-year/X/max-year/Y/search/TERM
                const url = `${this.baseUrl}/min-year/${year}/max-year/${year}/search/${encodedQuery}`;

                plan.push({
                    brand: item.brand,
                    model: item.model,
                    year: year,
                    url: url
                });
            }
        }

        return plan;
    }
}

module.exports = new FMVUrlBuilder();
