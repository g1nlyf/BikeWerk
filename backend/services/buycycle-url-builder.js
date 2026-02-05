class BuycycleURLBuilder {
    constructor() {
        this.baseUrl = 'https://buycycle.com/de-de/shop';
    }

    /**
     * Builds a structured Buycycle URL based on filters
     * @param {Object} filters
     * @param {string[]} filters.bikeTypes - ['mountainbike', 'road', 'gravel', 'e-bike']
     * @param {string[]} filters.categories - ['enduro', 'trail', 'downhill', 'cross-country']
     * @param {string[]} filters.brands - ['Santa Cruz', 'YT', 'Canyon'] (will be normalized)
     * @param {string[]} filters.frameSizes - ['S', 'M', 'L', 'XL']
     * @param {string[]} filters.frameMaterials - ['carbon', 'aluminum']
     * @param {number} filters.minPrice
     * @param {number} filters.maxPrice
     * @param {number} filters.minYear
     * @param {number} filters.maxYear
     * @returns {string} Constructed URL
     */
    buildURL(filters) {
        let url = this.baseUrl;

        // 1. Bike Types (mandatory for us usually)
        if (filters.bikeTypes && filters.bikeTypes.length > 0) {
            url += `/bike-types/${filters.bikeTypes.join(',')}`;
        }

        // 2. Categories
        if (filters.categories && filters.categories.length > 0) {
            url += `/categories/${filters.categories.join(',')}`;
        }

        // 3. Brands
        if (filters.brands && filters.brands.length > 0) {
            const normalizedBrands = filters.brands.map(b => this.normalizeBrandSlug(b));
            url += `/brands/${normalizedBrands.join(',')}`;
        }

        // 4. Frame Sizes
        if (filters.frameSizes && filters.frameSizes.length > 0) {
            const normalizedSizes = filters.frameSizes.map(s => s.toLowerCase());
            url += `/frame-sizes/${normalizedSizes.join(',')}`;
        }

        // 5. Frame Material
        if (filters.frameMaterials && filters.frameMaterials.length > 0) {
            const normalizedMaterials = filters.frameMaterials.map(m => m.toLowerCase());
            url += `/frame-material/${normalizedMaterials.join(',')}`;
        }

        // 6. Price
        if (filters.minPrice !== undefined) {
            url += `/min-price/${filters.minPrice}`;
        }
        if (filters.maxPrice !== undefined) {
            url += `/max-price/${filters.maxPrice}`;
        }

        // 7. Year
        if (filters.minYear !== undefined) {
            url += `/min-year/${filters.minYear}`;
        }
        if (filters.maxYear !== undefined) {
            url += `/max-year/${filters.maxYear}`;
        }

        return url;
    }

    normalizeBrandSlug(brand) {
        const map = {
            'Santa Cruz': 'santa-cruz',
            'YT': 'yt',
            'YT Industries': 'yt',
            'Specialized': 'specialized',
            'Canyon': 'canyon',
            'Pivot': 'pivot',
            'Trek': 'trek',
            'Giant': 'giant',
            'Scott': 'scott',
            'Cube': 'cube',
            'Propain': 'propain',
            'Rose': 'rose',
            'Commencal': 'commencal',
            'Transition': 'transition',
            'Evil': 'evil',
            'Intense': 'intense',
            'Yeti': 'yeti'
        };
        return map[brand] || brand.toLowerCase().replace(/\s+/g, '-');
    }

    generatePriceTierURLs() {
        // Example for Tier C (Data Lake)
        const brands = ['Santa Cruz', 'YT', 'Canyon', 'Specialized', 'Trek', 'Cube'];
        const tiers = [
            { min: 500, max: 1500 },
            { min: 1500, max: 3000 },
            { min: 3000, max: 6000 }
        ];

        const urls = [];
        
        for (const brand of brands) {
            for (const tier of tiers) {
                urls.push({
                    brand,
                    minPrice: tier.min,
                    maxPrice: tier.max,
                    url: this.buildURL({
                        bikeTypes: ['mountainbike'],
                        brands: [brand],
                        minPrice: tier.min,
                        maxPrice: tier.max,
                        minYear: 2018 // Reasonable cutoff
                    })
                });
            }
        }
        return urls;
    }
}

module.exports = BuycycleURLBuilder;
