const { normalizeCategory, normalizeDiscipline } = require('../../config/category-constants');

class BrandsCatalogLoader {
    constructor() {
        const fs = require('fs');
        const path = require('path');
        const catalogPath = path.join(__dirname, '../../config/unified-brands-catalog.json');
        this.catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    }

    getAllCategories() {
        return Object.keys(this.catalog.categories);
    }

    getCategoryConfig(categoryKey) {
        const config = this.catalog.categories[categoryKey];
        if (!config) return null;

        // Normalize category and discipline to lowercase for frontend compatibility
        return {
            ...config,
            category: normalizeCategory(config.category),
            discipline: normalizeDiscipline(config.discipline)
        };
    }

    getAllBrandsForCategory(categoryKey) {
        return this.catalog.categories[categoryKey]?.brands || [];
    }

    getBrandTier(brandName) {
        for (const cat of Object.values(this.catalog.categories)) {
            const brand = cat.brands.find(b => b.name === brandName);
            if (brand) return brand.tier;
        }
        return 3; // fallback
    }

    isModelAllowed(brandName, modelName, categoryKey) {
        const catConfig = this.catalog.categories[categoryKey];
        if (!catConfig) return false;

        const brand = catConfig.brands.find(b => b.name === brandName);
        if (!brand) return false;

        return brand.models.some(m =>
            modelName.toLowerCase().includes(m.toLowerCase())
        );
    }
}

module.exports = BrandsCatalogLoader;