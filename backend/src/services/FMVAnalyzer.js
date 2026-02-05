/**
 * FMVAnalyzer.js
 * Анализирует market_history для расчёта Fair Market Value
 */

class FMVAnalyzer {
    constructor(db) {
        this.db = db;
    }

    normalizeText(value) {
        if (!value) return '';
        return String(value)
            .toLowerCase()
            .replace(/[\u2019']/g, '')
            .replace(/[^a-z0-9\s-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    sanitizeModel(model) {
        if (!model) return '';
        let cleaned = this.normalizeText(model);
        cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, ' ');
        cleaned = cleaned.replace(/\b(cf|al|sl|slx|s-works|expert|comp|pro|race|rc|factory|team|ultimate|select|r|rs|gx|sx|nx)\b/g, ' ');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
    }

    buildModelPatterns(model) {
        const cleaned = this.sanitizeModel(model);
        if (!cleaned) return [];
        const tokens = cleaned.split(' ').filter(Boolean);
        const patterns = new Set();
        if (tokens.length >= 2) patterns.add(tokens.slice(0, 2).join(' '));
        if (tokens.length >= 1) patterns.add(tokens[0]);
        patterns.add(cleaned);
        return Array.from(patterns)
            .filter((p) => p.length >= 2)
            .map((p) => `%${p}%`);
    }

    extractYearFromTitle(title) {
        if (!title) return null;
        const match = String(title).match(/\b(19|20)\d{2}\b/);
        if (!match) return null;
        const year = Number(match[0]);
        if (!Number.isFinite(year)) return null;
        const current = new Date().getFullYear();
        if (year < 1990 || year > current + 1) return null;
        return year;
    }

    adjustPriceForYear(price, rowYear, targetYear) {
        if (!price || !targetYear || !rowYear) return price;
        const diff = Math.max(-6, Math.min(6, targetYear - rowYear));
        if (diff === 0) return price;
        const annualDep = 0.12;
        const factor = Math.pow(1 - annualDep, -diff);
        return price * factor;
    }

    selectBestYearSubset(rows, targetYear) {
        if (!targetYear) return rows;
        const exact = rows.filter(r => r.year === targetYear);
        if (exact.length >= 3) return exact;
        const near1 = rows.filter(r => r.year && Math.abs(r.year - targetYear) <= 1);
        if (near1.length >= 5) return near1;
        const near2 = rows.filter(r => r.year && Math.abs(r.year - targetYear) <= 2);
        if (near2.length >= 5) return near2;
        return rows;
    }

    /**
     * Главный метод: получить FMV для модели
     * @param {string} brand - "Specialized"
     * @param {string} model - "Stumpjumper"
     * @param {number} year - 2021
     * @param {object} options - { frameSize: "L", frameMaterial: "carbon" }
     * @returns {object} { fmv, confidence, sample_size, price_range, data_source }
     */
    async getFairMarketValue(brand, model, year, options = {}) {
        console.log(`📊 [FMV] Analyzing: ${brand} ${model} ${year}`);

        // 1. Получаем данные из market_history
        const marketData = await this.getMarketData(brand, model, year, options);

        if (marketData.length === 0) {
            console.log(`   ⚠️ No market data found, using estimation`);
            return this.estimateFMV(brand, model, year, options);
        }

        console.log(`   📈 Found ${marketData.length} comparable listings`);

        // 2. Фильтруем outliers
        const filtered = this.removeOutliers(marketData);
        console.log(`   🔍 After outlier removal: ${filtered.length} listings`);

        // 3. Рассчитываем median (более устойчив чем average)
        const prices = filtered.map(item => item.price_adjusted || item.price);
        const median = this.calculateMedian(prices);

        // 4. Рассчитываем confidence
        const confidence = this.calculateConfidence(filtered.length, filtered);

        // 5. Price range
        const priceRange = {
            min: Math.min(...prices),
            max: Math.max(...prices),
            q1: this.calculatePercentile(prices, 25),
            q3: this.calculatePercentile(prices, 75)
        };

        console.log(`   💰 FMV: €${median} (confidence: ${(confidence * 100).toFixed(0)}%)`);

        return {
            fmv: Math.round(median),
            confidence: confidence,
            sample_size: filtered.length,
            price_range: priceRange,
            data_source: 'market_history',
            last_updated: new Date().toISOString()
        };
    }

    /**
     * Получить market data из БД
     */
    async getMarketData(brand, model, year, options) {
        const patterns = this.buildModelPatterns(model);
        const recentDays = options?.recentDays || 365;

        let results = [];
        if (brand) {
            if (patterns.length > 0) {
                const orClauses = patterns.map(() => '(LOWER(model) LIKE LOWER(?) OR LOWER(title) LIKE LOWER(?))').join(' OR ');
                const query = `
                    SELECT price_eur as price, created_at, frame_size, frame_material, year, model, title
                    FROM market_history
                    WHERE LOWER(brand) = LOWER(?)
                      AND price_eur > 0
                      AND created_at > datetime('now', ?)
                      AND (${orClauses})
                    ORDER BY created_at DESC
                    LIMIT 300
                `;
                const params = [brand, `-${recentDays} days`];
                patterns.forEach(p => params.push(p, p));
                results = await this.db.query(query, params);
            }

            if (results.length < 3) {
                const query = `
                    SELECT price_eur as price, created_at, frame_size, frame_material, year, model, title
                    FROM market_history
                    WHERE LOWER(brand) = LOWER(?)
                      AND price_eur > 0
                      AND created_at > datetime('now', ?)
                    ORDER BY created_at DESC
                    LIMIT 300
                `;
                results = await this.db.query(query, [brand, `-${recentDays} days`]);
            }
        }

        // Filter by frame_size and frame_material if provided
        let filtered = results;

        if (options.frameSize) {
            const sizeFiltered = filtered.filter(item =>
                item.frame_size && item.frame_size.toLowerCase() === String(options.frameSize).toLowerCase()
            );
            if (sizeFiltered.length >= 3) {
                filtered = sizeFiltered;
            }
        }

        if (options.frameMaterial) {
            const materialFiltered = filtered.filter(item =>
                item.frame_material && item.frame_material.toLowerCase().includes(String(options.frameMaterial).toLowerCase())
            );
            if (materialFiltered.length >= 3) {
                filtered = materialFiltered;
            }
        }

        if (filtered.length < 3 && results.length >= 3) {
            console.log(`   [WARN] Too few results with filters (${filtered.length}), using unfiltered (${results.length})`);
            filtered = results;
        }

        const withYears = filtered.map(item => ({
            ...item,
            year: item.year || this.extractYearFromTitle(item.title)
        }));
        const yearFiltered = this.selectBestYearSubset(withYears, year);

        return yearFiltered.map(item => ({
            ...item,
            price_adjusted: this.adjustPriceForYear(item.price, item.year, year)
        }));
    }

    /**
     * Удаляет outliers (IQR метод)
     */
    removeOutliers(data) {
        if (data.length < 4) return data; // Слишком мало данных

        const prices = data.map(item => item.price_adjusted || item.price).sort((a, b) => a - b);
        
        const q1 = this.calculatePercentile(prices, 25);
        const q3 = this.calculatePercentile(prices, 75);
        const iqr = q3 - q1;

        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        return data.filter(item => {
            const p = item.price_adjusted || item.price;
            return p >= lowerBound && p <= upperBound;
        });
    }

    /**
     * Рассчитывает median
     */
    calculateMedian(numbers) {
        if (numbers.length === 0) return 0;

        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            return sorted[mid];
        }
    }

    /**
     * Рассчитывает percentile
     */
    calculatePercentile(numbers, percentile) {
        if (numbers.length === 0) return 0;

        const sorted = [...numbers].sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;

        if (lower === upper) {
            return sorted[lower];
        }

        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }

    /**
     * Рассчитывает confidence на основе sample size и variance
     */
    calculateConfidence(sampleSize, data) {
        // Базовый confidence на основе sample size
        let confidence = 0;

        if (sampleSize >= 20) confidence = 0.95;
        else if (sampleSize >= 10) confidence = 0.85;
        else if (sampleSize >= 5) confidence = 0.75;
        else if (sampleSize >= 3) confidence = 0.60;
        else confidence = 0.40;

        // Корректируем на основе variance (если prices сильно разбросаны = меньше confidence)
        if (data.length >= 3) {
            const prices = data.map(item => item.price_adjusted || item.price);
            const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
            const coefficientOfVariation = Math.sqrt(variance) / mean;

            // Если CV > 0.3 (30% разброс), снижаем confidence
            if (coefficientOfVariation > 0.3) {
                confidence *= 0.9;
            }
            if (coefficientOfVariation > 0.5) {
                confidence *= 0.8;
            }
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * Estimation fallback если нет market data
     */
    estimateFMV(brand, model, year, options) {
        console.log(`   🔮 Using estimation (no market data)`);

        // Базовая цена по бренду
        const brandTier = this.getBrandTier(brand);
        let basePriceNew = brandTier.basePrice;

        // Корректируем по материалу
        if (options.frameMaterial === 'carbon') {
            basePriceNew *= 1.5;
        }

        // Depreciation
        const age = new Date().getFullYear() - year;
        let depreciationFactor;

        if (age <= 1) depreciationFactor = 0.80;
        else if (age <= 2) depreciationFactor = 0.70;
        else if (age <= 3) depreciationFactor = 0.60;
        else if (age <= 5) depreciationFactor = 0.45;
        else if (age <= 7) depreciationFactor = 0.30;
        else depreciationFactor = 0.20;

        let fmv = Math.round(basePriceNew * depreciationFactor);
        const listingPrice = options?.listingPrice;
        if (listingPrice && Number.isFinite(listingPrice) && listingPrice > 0) {
            const floor = Math.round(listingPrice * 0.8);
            if (fmv < floor) {
                fmv = floor;
            }
        }

        return {
            fmv: fmv,
            confidence: 0.50, // Низкий confidence для estimation
            sample_size: 0,
            price_range: {
                min: Math.round(fmv * 0.8),
                max: Math.round(fmv * 1.2)
            },
            data_source: 'estimation',
            last_updated: new Date().toISOString()
        };
    }

    /**
     * Возвращает кривую амортизации для бренда/модели
     */
    getDepreciationCurve(brand, model, years) {
        return years.map(year => {
            const age = new Date().getFullYear() - year;
            let depreciationFactor;

            if (age <= 1) depreciationFactor = 0.80;
            else if (age <= 2) depreciationFactor = 0.70;
            else if (age <= 3) depreciationFactor = 0.60;
            else if (age <= 5) depreciationFactor = 0.45;
            else if (age <= 7) depreciationFactor = 0.30;
            else depreciationFactor = 0.20;

            return {
                year,
                age,
                factor: depreciationFactor,
                estimated_value_retention: (depreciationFactor * 100) + '%'
            };
        });
    }

    /**
     * Определяет tier бренда
     */
    getBrandTier(brand) {
        const tiers = {
            'specialized': { tier: 1, basePrice: 3500 },
            'trek': { tier: 1, basePrice: 3500 },
            'santa cruz': { tier: 1, basePrice: 4500 },
            'yt': { tier: 1, basePrice: 3200 },
            'canyon': { tier: 1, basePrice: 3000 },
            'scott': { tier: 1, basePrice: 3000 },
            'giant': { tier: 2, basePrice: 2000 },
            'cube': { tier: 2, basePrice: 2000 },
            'focus': { tier: 2, basePrice: 2000 },
            'merida': { tier: 2, basePrice: 1800 },
            'ghost': { tier: 2, basePrice: 1800 },
            'bulls': { tier: 3, basePrice: 1500 },
            'kellys': { tier: 3, basePrice: 1200 }
        };

        const brandLower = brand.toLowerCase();
        return tiers[brandLower] || { tier: 3, basePrice: 1500 };
    }

    /**
     * Определяет market comparison
     */
    getMarketComparison(price, fmv) {
        if (!fmv || fmv === 0) return 'unknown';

        const diff = ((price - fmv) / fmv) * 100;

        if (diff <= -20) return 'well_below_market';
        if (diff <= -10) return 'below_market';
        if (diff <= 10) return 'at_market';
        if (diff <= 25) return 'above_market';
        return 'well_above_market';
    }
}

module.exports = FMVAnalyzer;
