class KleinanzeigenFMVUrlBuilder {
    constructor() {
        this.baseUrl = 'https://www.kleinanzeigen.de/s-fahrraeder/preis:500:';
        this.categoryCode = 'k0c217'; // Bikes category
    }

    /**
     * Builds a search URL for a specific bike
     * @param {string} brand - e.g., "YT"
     * @param {string} model - e.g., "Capra"
     * @param {number} year - e.g., 2023
     * @returns {string} - e.g., "https://www.kleinanzeigen.de/s-fahrraeder/preis:500:/yt-capra-2023/k0c217"
     */
    buildSearchUrl(brand, model, year) {
        const query = `${brand.toLowerCase()}-${model.toLowerCase()}-${year}`;
        return `${this.baseUrl}/${query}/${this.categoryCode}`;
    }

    /**
     * Generates a collection plan for Kleinanzeigen
     * @param {Array} whitelist - [{ brand: 'YT', model: 'Capra' }, ...]
     * @param {Object} yearRange - { start: 2020, end: 2025 }
     * @returns {Array} - [{ brand, model, year, url, source: 'kleinanzeigen' }]
     */
    generateCollectionPlan(whitelist, yearRange) {
        const plan = [];
        const { start, end } = yearRange;

        for (const item of whitelist) {
            for (let year = start; year <= end; year++) {
                const url = this.buildSearchUrl(item.brand, item.model, year);
                
                plan.push({
                    brand: item.brand,
                    model: item.model,
                    year: year,
                    url: url,
                    source: 'kleinanzeigen'
                });
            }
        }

        return plan;
    }
}

module.exports = new KleinanzeigenFMVUrlBuilder();