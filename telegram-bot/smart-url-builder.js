class SmartURLBuilder {
    constructor() {
        this.baseUrl = 'https://www.kleinanzeigen.de/s-fahrraeder';
    }

    /**
     * Universal URL Constructor (User Provided Logic)
     */
    buildSearchURL(config) {
        const {
            brand,
            model = null,        // NEW: Optional model
            category,
            minPrice = 500,      // ✅ DEFAULT: €500
            maxPrice = null,
            location = 'global',
            shippingRequired = true,
            page = null
        } = config;

        let url = 'https://www.kleinanzeigen.de/s-fahrraeder/';

        // Geography
        if (location === 'marburg') {
            url += 'marburg/';
        }

        // Price (CRITICAL!)
        if (minPrice || maxPrice) {
            url += `preis:${minPrice || 500}:${maxPrice || ''}/`;
        }

        // Brand + Model (NEW!)
        const searchQuery = model 
            ? `${brand}-${model}`.toLowerCase().replace(/\s+/g, '-')
            : brand.toLowerCase().replace(/\s+/g, '-');

        url += `${searchQuery}/`;

        // Category code & Location Radius
        if (location === 'marburg') {
            url += 'k0c217l4825r100';  // Marburg + 100km
        } else {
            url += 'k0c217'; // Default category
        }

        // Bike type
        const typeMap = {
            'MTB': 'mountainbike',
            'DH': 'mountainbike',
            'Enduro': 'mountainbike',
            'Trail': 'mountainbike',
            'Road': 'rennrad',
            'Gravel': 'rennrad',
            'eMTB': 'elektrofahrrad',
            'mtb': 'mountainbike', // Case insensitive support
            'road': 'rennrad',
            'emtb': 'elektrofahrrad'
        };

        const typeKey = (category || 'MTB').toString(); // Handle potential non-string
        const mappedType = typeMap[typeKey] || typeMap[Object.keys(typeMap).find(k => k.toLowerCase() === typeKey.toLowerCase())] || 'mountainbike';
        
        url += `+fahrraeder.type_s:${mappedType}`;

        // Shipping
        if (shippingRequired) {
            url += '+fahrraeder.versand_s:ja';
        }

        // Pagination
        if (page) {
            url += `?seite=${page}`;
        }

        return url;
    }

    // --- Legacy Adapters for UnifiedHunter ---

    constructUrl(params) {
        // Map old params to new config
        return this.buildSearchURL({
            brand: params.brand,
            minPrice: params.priceMin,
            maxPrice: params.priceMax,
            category: params.type, // 'type' was used for bikeType
            shippingRequired: params.shipping,
            page: params.page
        });
    }

    buildSniperURL({ brand, priceMin, priceMax, bikeType }) {
        return this.buildSearchURL({
            brand,
            minPrice: priceMin,
            maxPrice: priceMax,
            category: bikeType,
            shippingRequired: true
        });
    }

    buildLocalURL({ brand, priceMin, priceMax, bikeType }) {
        return this.buildSearchURL({
            brand,
            minPrice: priceMin || 500, // Ensure min price even for local
            maxPrice: priceMax,
            category: bikeType,
            location: 'marburg',
            shippingRequired: false
        });
    }

    buildDataLakeURL({ brand, bikeType }) {
        return this.buildSearchURL({
            brand,
            category: bikeType,
            minPrice: 500, // Safety net
            shippingRequired: true
        });
    }
}

module.exports = SmartURLBuilder;
