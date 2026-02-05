/**
 * ListingScorer.js
 * Оценка качества объявлений на этапе pre-selection
 * (до открытия детальной страницы)
 */

class ListingScorer {
    /**
     * Рассчитывает pre-selection score для листинга
     * @param {Object} listing - Данные с listing page
     * @returns {number} Score (0-100)
     */
    calculatePreSelectionScore(listing) {
        let score = 0;

        // 1. ФОТО (40 баллов максимум)
        const photoCount = listing.images?.length || 0;
        if (photoCount >= 5) score += 40;
        else if (photoCount >= 3) score += 25;
        else if (photoCount >= 1) score += 10;
        else score -= 10; // без фото - штраф

        // 2. ЦЕНА (20 баллов)
        const price = parseFloat(listing.price);
        if (!price || price <= 0) {
            score -= 20; // невалидная цена
        } else if (price >= 800 && price <= 8000) {
            score += 20; // разумный диапазон
        } else if (price < 300 || price > 15000) {
            score -= 10; // подозрительно дешево/дорого
        } else {
            score += 10; // граничные значения
        }

        // 3. ПОЛНОТА ДАННЫХ (15 баллов)
        // (Reduced from 30 to make room for Title Quality)
        if (listing.year) score += 5;
        if (listing.frameSize) score += 5;
        if (listing.condition) score += 5;

        // 4. СВЕЖЕСТЬ (10 баллов)
        const daysOld = listing.daysOnMarket || 999;
        if (daysOld <= 7) score += 10;
        else if (daysOld <= 30) score += 5;
        else if (daysOld > 180) score -= 5; // старый листинг

        // 5. TITLE QUALITY (15 баллов) - NEW
        if (listing.title) {
            const t = listing.title.toLowerCase();
            // Длина > 20
            if (t.length > 20) score += 5;
            // Содержит год (2015-2025)
            if (/\b20(1[5-9]|2[0-5])\b/.test(t)) score += 5;
            // Содержит ключевые слова размера
            if (/\b(size|sz|l|m|xl|s)\b/.test(t)) score += 5;
        }

        // 6. PRICE POSITION PREFERENCE (10 баллов) - NEW
        // Prefer sweet spot 1500-4500
        if (price >= 1500 && price <= 4500) {
            score += 10;
        }

        // 7. RANDOM TIEBREAKER (0-5 баллов) - NEW
        score += Math.random() * 5;

        // 8. Condition Bonus (Legacy)
        if (listing.condition) {
            const conditionLower = listing.condition.toLowerCase();
            if (conditionLower.includes('perfect') || conditionLower.includes('new')) {
                score += 5;
            }
        }

        return Math.max(0, Math.min(100, score)); // клампинг 0-100
    }

    /**
     * Сортирует листинги по score (DESC)
     */
    sortByScore(listings) {
        return listings
            .map(listing => ({
                ...listing,
                preSelectionScore: this.calculatePreSelectionScore(listing)
            }))
            .sort((a, b) => b.preSelectionScore - a.preSelectionScore);
    }
}

module.exports = ListingScorer;
