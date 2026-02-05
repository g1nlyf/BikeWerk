/**
 * SmartModelSelector.js
 * Gap-driven selection моделей для Hunter
 */

const BrandsCatalogLoader = require('../utils/BrandsCatalogLoader');

class SmartModelSelector {
    constructor(gapAnalyzer, databaseService) {
        this.gapAnalyzer = gapAnalyzer;
        this.db = databaseService;
        this.catalog = new BrandsCatalogLoader();
    }

    /**
     * Выбирает модели для охоты на основе дефицита
     * @param {number} maxTargets - Максимум целей
     * @returns {Array} Targets с приоритетами
     */
    async selectModelsForHunting(maxTargets = 10) {
        console.log(`🎯 [SmartSelector] Анализ дефицита для ${maxTargets} целей...`);

        const allTargets = [];
        const categories = this.catalog.getAllCategories();

        for (const categoryKey of categories) {
            const catConfig = this.catalog.getCategoryConfig(categoryKey);

            console.log(`📊 Проверка категории: ${catConfig.display_name}`);

            // Проверяем общий инвентарь категории
            const currentInventory = await this.getCurrentInventory(
                catConfig.category,
                catConfig.discipline
            );

            const categoryDeficit = catConfig.targetInventory - currentInventory;

            if (categoryDeficit <= 0) {
                console.log(`  ✅ ${catConfig.display_name}: Достаточно (${currentInventory}/${catConfig.targetInventory})`);
                continue;
            }

            console.log(`  ⚠️ ${catConfig.display_name}: Дефицит ${categoryDeficit} байков`);

            // Анализируем каждую модель в категории
            for (const brand of catConfig.brands) {
                for (const model of brand.models) {
                    const modelGaps = await this.analyzeModelGaps(
                        brand.name,
                        model,
                        catConfig.category,
                        catConfig.discipline
                    );

                    if (modelGaps.totalDeficit > 0) {
                        allTargets.push({
                            brand: brand.name,
                            model,
                            category: catConfig.category,
                            discipline: catConfig.discipline,
                            categoryKey,
                            tier: brand.tier,
                            minPrice: brand.minPrice,
                            deficit: modelGaps.totalDeficit,
                            gaps: modelGaps,
                            priority: this.calculatePriority(
                                modelGaps.totalDeficit,
                                brand.tier,
                                categoryDeficit
                            )
                        });
                    }
                }
            }
        }

        const targetsWithDeficit = allTargets.filter(t => t.deficit > 0);

        if (targetsWithDeficit.length === 0) {
            console.log('✅ Каталог заполнен!');
            return [];
        }

        const sorted = targetsWithDeficit.sort((a, b) => b.priority - a.priority);

        // Берём топ N
        const selected = sorted.slice(0, maxTargets);

        console.log(`\n🎯 Выбрано ${selected.length} целей:`);
        selected.forEach((t, i) => {
            console.log(`  ${i + 1}. ${t.brand} ${t.model} (${t.discipline}) - deficit: ${t.deficit}, priority: ${t.priority.toFixed(2)}`);
        });

        return selected;
    }

    /**
     * Получает текущий инвентарь для категории/дисциплины
     */
    async getCurrentInventory(category, discipline) {
        let query = 'SELECT COUNT(*) as count FROM bikes WHERE is_active = 1 AND category = ?';
        const params = [category];

        // Handle null discipline correctly for SQL
        if (discipline !== undefined) {
            if (discipline === null) {
                query += ' AND discipline IS NULL';
            } else {
                query += ' AND discipline = ?';
                params.push(discipline);
            }
        }

        try {
            const result = await this.db.query(query, params);
            return result[0]?.count || 0;
        } catch (e) {
            console.error(`   [DEBUG] getCurrentInventory FAILED: ${e.message}`);
            console.error(`   [DEBUG] Query: ${query}`);
            console.error(`   [DEBUG] Params: ${JSON.stringify(params)}`);
            throw e;
        }
    }

    /**
     * Анализирует gaps для конкретной модели
     */
    async analyzeModelGaps(brand, model, category, discipline) {
        // Build query with proper null handling for discipline
        let disciplineClause = '';
        if (discipline !== undefined) {
            disciplineClause = discipline === null ? 'AND discipline IS NULL' : 'AND discipline = ?';
        }

        const query = `
            SELECT 
                COUNT(*) as count,
                size,
                CAST(price AS INTEGER) / 500 * 500 as price_bucket
            FROM bikes 
            WHERE is_active = 1
              AND brand = ?
              AND model LIKE ?
              AND category = ?
              ${disciplineClause}
            GROUP BY size, price_bucket
        `;

        const params = [brand, `%${model}%`, category];
        if (discipline !== undefined && discipline !== null) {
            params.push(discipline);
        }

        const current = await this.db.query(query, params);
        console.log(`   [DEBUG] analyzeModelGaps query executed successfully for ${brand} ${model}`);

        // Целевая композиция (идеальное распределение)
        const targetComposition = {
            sizes: { 'S': 2, 'M': 3, 'L': 3, 'XL': 2 }, // всего 10
            priceRanges: {
                'low': 2,    // до 1500
                'mid': 4,    // 1500-3000
                'high': 3,   // 3000-5000
                'premium': 1 // 5000+
            }
        };

        // Считаем дефицит
        let totalDeficit = 0;
        const sizeGaps = [];
        const priceGaps = [];

        // Size gaps
        for (const [size, target] of Object.entries(targetComposition.sizes)) {
            const currentCount = current.filter(r => r.size === size).length;
            const deficit = target - currentCount;
            if (deficit > 0) {
                sizeGaps.push({ size, deficit, current: currentCount, target });
                totalDeficit += deficit;
            }
        }

        // Price gaps (упрощённо)
        const totalCurrent = current.length;
        const totalTarget = Object.values(targetComposition.sizes).reduce((a, b) => a + b, 0);
        const generalDeficit = Math.max(0, totalTarget - totalCurrent);

        totalDeficit = Math.max(totalDeficit, generalDeficit);

        return {
            totalDeficit,
            sizeGaps,
            priceGaps,
            currentTotal: totalCurrent,
            targetTotal: totalTarget
        };
    }

    /**
     * Рассчитывает приоритет модели
     */
    calculatePriority(deficit, tier, categoryDeficit) {
        // Дефицит важнее всего
        let priority = deficit * 10;

        // Tier1 важнее (больший приоритет)
        if (tier === 1) priority *= 1.5;
        else if (tier === 2) priority *= 1.2;

        // Category-wide deficit boost
        priority += categoryDeficit * 0.5;

        return priority;
    }

    /**
     * Строит фильтры для сбора на основе gaps
     */
    buildFiltersFromGaps(target) {
        const filters = {
            brand: target.brand,
            model: target.model,
            minPrice: target.minPrice,
            maxPrice: null
        };

        // Если есть price gaps, используем их
        if (target.gaps.priceGaps && target.gaps.priceGaps.length > 0) {
            const topPriceGap = target.gaps.priceGaps.sort((a, b) => b.deficit - a.deficit)[0];
            // Парсим диапазон (если в формате "1500-3000")
            const range = this.parsePriceRange(topPriceGap.range);
            if (range) {
                filters.minPrice = range.min;
                filters.maxPrice = range.max;
            }
        }

        // Если нет max — ставим default на основе tier
        if (!filters.maxPrice) {
            if (target.tier === 1) filters.maxPrice = 8000;
            else if (target.tier === 2) filters.maxPrice = 3000;
            else filters.maxPrice = 1500;
        }

        // Target sizes (если есть size gaps)
        if (target.gaps.sizeGaps && target.gaps.sizeGaps.length > 0) {
            filters.targetSizes = target.gaps.sizeGaps.map(g => g.size);
        }

        return filters;
    }

    /**
     * Парсит price range из строки
     */
    parsePriceRange(priceRangeStr) {
        if (!priceRangeStr) return null;

        const cleaned = priceRangeStr.replace(/[€$£,\s]/g, '');
        const matches = cleaned.match(/(\d+)-?(\d+)/);

        if (matches && matches.length >= 3) {
            return {
                min: parseInt(matches[1]),
                max: parseInt(matches[2])
            };
        }

        // Fallback
        const single = cleaned.match(/(\d+)/);
        if (single) {
            const price = parseInt(single[1]);
            return { min: price, max: price + 1000 };
        }

        return null;
    }
}

module.exports = SmartModelSelector;
