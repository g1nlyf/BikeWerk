/**
 * SmartModelSelector
 * Gap-driven model selection for Unified Hunter.
 */

const BrandsCatalogLoader = require('../utils/BrandsCatalogLoader');

class SmartModelSelector {
    constructor(gapAnalyzer, databaseService) {
        this.gapAnalyzer = gapAnalyzer;
        this.db = databaseService;
        this.catalog = new BrandsCatalogLoader();
        this._sizeSqlExpr = null;
    }

    async resolveSizeSqlExpression() {
        if (this._sizeSqlExpr) return this._sizeSqlExpr;

        try {
            const schema = await this.db.query('PRAGMA table_info(bikes)');
            const cols = new Set((schema || []).map((r) => String(r.name || '').toLowerCase()));
            const hasSize = cols.has('size');
            const hasFrameSize = cols.has('frame_size');

            if (hasSize && hasFrameSize) {
                this._sizeSqlExpr = "COALESCE(NULLIF(TRIM(size), ''), NULLIF(TRIM(frame_size), ''))";
            } else if (hasSize) {
                this._sizeSqlExpr = "NULLIF(TRIM(size), '')";
            } else if (hasFrameSize) {
                this._sizeSqlExpr = "NULLIF(TRIM(frame_size), '')";
            } else {
                this._sizeSqlExpr = 'NULL';
            }
        } catch (e) {
            console.warn(`[SmartSelector] Failed to inspect bikes schema, fallback to frame_size: ${e.message}`);
            this._sizeSqlExpr = "NULLIF(TRIM(frame_size), '')";
        }

        return this._sizeSqlExpr;
    }

    normalizeSizeValue(value) {
        const s = String(value || '').trim().toUpperCase();
        if (!s) return '';

        const compact = s.replace(/\s+/g, '');
        if (compact === 'SMALL') return 'S';
        if (compact === 'MEDIUM') return 'M';
        if (compact === 'LARGE') return 'L';

        return compact;
    }

    /**
     * Select hunt targets by deficit.
     * Guarantees minimum category coverage, then fills by priority.
     */
    async selectModelsForHunting(maxTargets = 10) {
        console.log(`🎯 [SmartSelector] Анализ дефицита для ${maxTargets} целей...`);

        const allTargets = [];
        const categories = this.catalog.getAllCategories();

        for (const categoryKey of categories) {
            const catConfig = this.catalog.getCategoryConfig(categoryKey);
            if (!catConfig) continue;

            console.log(`📊 Проверка категории: ${catConfig.display_name}`);

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

        const targetsWithDeficit = allTargets.filter((t) => t.deficit > 0);
        if (targetsWithDeficit.length === 0) {
            console.log('✅ Каталог заполнен!');
            return [];
        }

        const sorted = targetsWithDeficit.sort((a, b) => b.priority - a.priority);
        const selected = [];
        const selectedKeys = new Set();
        const categoryCovered = new Set();

        // Pass 1: ensure each category gets at least one target.
        for (const target of sorted) {
            if (selected.length >= maxTargets) break;
            if (categoryCovered.has(target.categoryKey)) continue;

            const key = `${target.categoryKey}|${target.brand}|${target.model}`;
            if (selectedKeys.has(key)) continue;

            selected.push(target);
            selectedKeys.add(key);
            categoryCovered.add(target.categoryKey);
        }

        // Pass 2: fill remaining slots strictly by priority.
        for (const target of sorted) {
            if (selected.length >= maxTargets) break;

            const key = `${target.categoryKey}|${target.brand}|${target.model}`;
            if (selectedKeys.has(key)) continue;

            selected.push(target);
            selectedKeys.add(key);
        }

        console.log(`\n🎯 Выбрано ${selected.length} целей:`);
        selected.forEach((t, i) => {
            console.log(`  ${i + 1}. ${t.brand} ${t.model} (${t.discipline}) - deficit: ${t.deficit}, priority: ${t.priority.toFixed(2)}`);
        });

        return selected;
    }

    /**
     * Get current inventory count for category/discipline.
     */
    async getCurrentInventory(category, discipline) {
        let query = 'SELECT COUNT(*) as count FROM bikes WHERE is_active = 1 AND category = ?';
        const params = [category];

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
            return Number(result?.[0]?.count || 0);
        } catch (e) {
            console.error(`   [DEBUG] getCurrentInventory FAILED: ${e.message}`);
            console.error(`   [DEBUG] Query: ${query}`);
            console.error(`   [DEBUG] Params: ${JSON.stringify(params)}`);
            throw e;
        }
    }

    /**
     * Analyze gaps for a specific model.
     */
    async analyzeModelGaps(brand, model, category, discipline) {
        let disciplineClause = '';
        if (discipline !== undefined) {
            disciplineClause = discipline === null ? 'AND discipline IS NULL' : 'AND discipline = ?';
        }

        const sizeExpr = await this.resolveSizeSqlExpression();

        const query = `
            SELECT
                COUNT(*) as count,
                ${sizeExpr} as frame_size,
                CAST(COALESCE(price, price_eur, 0) AS INTEGER) / 500 * 500 as price_bucket
            FROM bikes
            WHERE is_active = 1
              AND brand = ?
              AND model LIKE ?
              AND category = ?
              ${disciplineClause}
            GROUP BY frame_size, price_bucket
        `;

        const params = [brand, `%${model}%`, category];
        if (discipline !== undefined && discipline !== null) {
            params.push(discipline);
        }

        const current = await this.db.query(query, params);
        console.log(`   [DEBUG] analyzeModelGaps query executed successfully for ${brand} ${model}`);

        const targetComposition = {
            sizes: { S: 2, M: 3, L: 3, XL: 2 },
            priceRanges: {
                low: 2,
                mid: 4,
                high: 3,
                premium: 1
            }
        };

        let totalDeficit = 0;
        const sizeGaps = [];
        const priceGaps = [];

        for (const [size, target] of Object.entries(targetComposition.sizes)) {
            const normalizedTargetSize = this.normalizeSizeValue(size);
            const currentCount = current
                .filter((r) => this.normalizeSizeValue(r.frame_size) === normalizedTargetSize)
                .reduce((sum, r) => sum + Number(r.count || 0), 0);

            const deficit = target - currentCount;
            if (deficit > 0) {
                sizeGaps.push({ size, deficit, current: currentCount, target });
                totalDeficit += deficit;
            }
        }

        const totalCurrent = current.reduce((sum, r) => sum + Number(r.count || 0), 0);
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
     * Calculate model priority.
     */
    calculatePriority(deficit, tier, categoryDeficit) {
        let priority = deficit * 10;

        if (tier === 1) priority *= 1.5;
        else if (tier === 2) priority *= 1.2;

        priority += categoryDeficit * 0.5;

        return priority;
    }

    /**
     * Build collector filters based on gaps.
     */
    buildFiltersFromGaps(target) {
        const gaps = target?.gaps || {};
        const priceGaps = Array.isArray(gaps.priceGaps) ? gaps.priceGaps : [];
        const sizeGaps = Array.isArray(gaps.sizeGaps) ? gaps.sizeGaps : [];

        const filters = {
            brand: target.brand,
            model: target.model,
            minPrice: target.minPrice,
            maxPrice: null
        };

        if (priceGaps.length > 0) {
            const topPriceGap = [...priceGaps].sort((a, b) => b.deficit - a.deficit)[0];
            const range = this.parsePriceRange(topPriceGap.range);
            if (range) {
                filters.minPrice = range.min;
                filters.maxPrice = range.max;
            }
        }

        if (!filters.maxPrice) {
            if (target.tier === 1) filters.maxPrice = 8000;
            else if (target.tier === 2) filters.maxPrice = 3000;
            else filters.maxPrice = 1500;
        }

        if (sizeGaps.length > 0) {
            filters.targetSizes = sizeGaps.map((g) => g.size);
        }

        return filters;
    }

    /**
     * Parse price range from string.
     */
    parsePriceRange(priceRangeStr) {
        if (!priceRangeStr) return null;

        const cleaned = priceRangeStr.replace(/[€$£,\s]/g, '');
        const matches = cleaned.match(/(\d+)-?(\d+)/);

        if (matches && matches.length >= 3) {
            return {
                min: parseInt(matches[1], 10),
                max: parseInt(matches[2], 10)
            };
        }

        const single = cleaned.match(/(\d+)/);
        if (single) {
            const price = parseInt(single[1], 10);
            return { min: price, max: price + 1000 };
        }

        return null;
    }
}

module.exports = SmartModelSelector;
