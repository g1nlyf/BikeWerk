class BikeflipUrlBuilder {
    constructor() {
        this.baseUrl = 'https://www.bikeflip.com/de/search/bikes';
    }

    /**
     * Generates a collection plan for BikeFlip
     * @param {Array} whitelist - [{ brand: 'YT', model: 'Capra' }, ...]
     * @param {Object} yearRange - { start: 2020, end: 2025 }
     * @returns {Array} - [{ brand, model, year, url, source: 'bikeflip' }]
     */
    generateCollectionPlan(whitelist, yearRange) {
        const plan = [];
        const { start, end } = yearRange;

        for (const item of whitelist) {
            for (let year = start; year <= end; year++) {
                // Format: bike_brand_model=yt+capra&model_year=2023
                const brandModel = `${item.brand.toLowerCase()}+${item.model.toLowerCase()}`;
                const url = `${this.baseUrl}?bike_brand_model=${brandModel}&sort-by=&model_year=${year}`;
                
                plan.push({
                    brand: item.brand,
                    model: item.model,
                    year: year,
                    url: url,
                    source: 'bikeflip'
                });
            }
        }

        return plan;
    }
}

module.exports = new BikeflipUrlBuilder();