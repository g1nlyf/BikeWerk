/**
 * Bike Rating System
 * Calculates comprehensive bike ratings based on 5 criteria
 */
class BikeRatingSystem {
    constructor() {
        this.criteria = {
            age: { weight: 0.15, name: 'Возраст' },
            condition: { weight: 0.30, name: 'Состояние' },
            seller: { weight: 0.20, name: 'Продавец' },
            priceQuality: { weight: 0.25, name: 'Цена-Качество' },
            savings: { weight: 0.10, name: 'Экономия' }
        };
    }

    /**
     * Calculate age rating based on bike year
     */
    calculateAgeRating(year) {
        // Если год неизвестен или отсутствует, ставим 8
        if (!year || year === 0 || isNaN(year)) return 8;
        
        const currentYear = new Date().getFullYear();
        
        // 2024-2025 - 10
        if (year >= 2024) return 10;
        // 2022-2023 - 9
        if (year >= 2022) return 9;
        // 2021-2022 - 8 (уже покрыто выше)
        if (year >= 2021) return 8;
        // 2019-2020 - 7
        if (year >= 2019) return 7;
        // 2018-2019 - 6 (уже покрыто выше)
        if (year >= 2018) return 6;
        // <2018 - 5
        return 5;
    }

    /**
     * Calculate condition rating based on description and Gemini AI assessment
     */
    calculateConditionRating(bike) {
        // Если есть оценка от Gemini AI, используем её
        if (bike.conditionRating && typeof bike.conditionRating === 'number' && bike.conditionRating >= 1 && bike.conditionRating <= 10) {
            return Math.round(bike.conditionRating * 10) / 10;
        }
        
        // Fallback к старому алгоритму если нет оценки от Gemini
        const description = (bike.description || '').toLowerCase();
        const title = (bike.name || bike.title || '').toLowerCase();
        const condition = (bike.condition || '').toLowerCase();
        const text = description + ' ' + title + ' ' + condition;
        
        let score = 8; // Повышенный базовый балл
        
        // Positive indicators
        if (text.includes('новый') || text.includes('new')) score += 1.5;
        if (text.includes('отличное состояние') || text.includes('excellent')) score += 1;
        if (text.includes('хорошее состояние') || text.includes('good')) score += 0.5;
        if (text.includes('обслужен') || text.includes('serviced')) score += 0.5;
        if (text.includes('гарантия') || text.includes('warranty')) score += 0.5;
        
        // Смягченные негативные индикаторы
        if (text.includes('требует ремонта') || text.includes('needs repair')) score -= 1.5;
        if (text.includes('царапины') || text.includes('scratches')) score -= 0.3;
        if (text.includes('потертости') || text.includes('wear')) score -= 0.2;
        if (text.includes('б/у') || text.includes('used')) score -= 0.2;
        if (text.includes('дефект') || text.includes('defect')) score -= 1;
        
        return Math.max(6, Math.min(10, Math.round(score * 10) / 10)); // Минимум 6
    }

    /**
     * Calculate seller rating based on seller info
     */
    calculateSellerRating(bike) {
        // Simulate seller rating based on various factors
        const hasVerification = Math.random() > 0.2; // Больше верифицированных продавцов
        const sellerExperience = Math.floor(Math.random() * 10) + 1;
        const responseTime = Math.random();
        
        let score = 7; // Повышенный базовый балл
        
        if (hasVerification) score += 1.5;
        if (sellerExperience > 5) score += 1;
        if (sellerExperience > 8) score += 0.5;
        if (responseTime > 0.7) score += 0.5;
        
        // Добавляем позитивную случайность
        score += Math.random() * 1.5;
        
        return Math.max(6.5, Math.min(10, Math.round(score * 10) / 10)); // Минимум 6.5
    }

    /**
     * Calculate price-quality rating
     */
    calculatePriceQualityRating(bike) {
        const price = parseFloat(bike.price) || 0;
        const year = bike.year || 2020;
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;
        
        // Expected price based on age and type
        let expectedPrice = 50000; // Base price for new bike
        expectedPrice *= Math.pow(0.85, age); // Depreciation
        
        const priceRatio = expectedPrice / price;
        
        if (priceRatio >= 2.0) return 10; // Excellent deal
        if (priceRatio >= 1.5) return 9.5;
        if (priceRatio >= 1.3) return 9;
        if (priceRatio >= 1.1) return 8.5;
        if (priceRatio >= 0.9) return 8;
        if (priceRatio >= 0.8) return 7.5;
        if (priceRatio >= 0.7) return 7;
        if (priceRatio >= 0.6) return 6.5;
        if (priceRatio >= 0.5) return 6;
        return 5.5; // Минимум 5.5
    }

    /**
     * Calculate savings rating compared to Russian market
     */
    calculateSavingsRating(bike) {
        const price = parseFloat(bike.price) || 0;
        
        // Simulate Russian market price (typically 40-80% higher for better savings)
        const russianMarkup = 1.4 + Math.random() * 0.4; // 40-80% markup
        const russianPrice = price * russianMarkup;
        const savings = russianPrice - price;
        const savingsPercent = (savings / russianPrice) * 100;
        
        if (savingsPercent >= 50) return 10;
        if (savingsPercent >= 45) return 9.5;
        if (savingsPercent >= 40) return 9;
        if (savingsPercent >= 35) return 8.5;
        if (savingsPercent >= 30) return 8;
        if (savingsPercent >= 25) return 7.5;
        if (savingsPercent >= 20) return 7;
        if (savingsPercent >= 15) return 6.5;
        if (savingsPercent >= 10) return 6;
        return 5.5; // Минимум 5.5
    }

    /**
     * Calculate overall rating for a bike
     */
    calculateOverallRating(bike) {
        const ratings = {
            age: this.calculateAgeRating(bike.year),
            condition: this.calculateConditionRating(bike),
            seller: this.calculateSellerRating(bike),
            priceQuality: this.calculatePriceQualityRating(bike),
            savings: this.calculateSavingsRating(bike)
        };

        // Calculate weighted average
        let totalScore = 0;
        let totalWeight = 0;

        for (const [criterion, rating] of Object.entries(ratings)) {
            const weight = this.criteria[criterion].weight;
            totalScore += rating * weight;
            totalWeight += weight;
        }

        const overallScore = totalScore / totalWeight;
        
        return {
            overall: Math.round(overallScore * 10) / 10, // Round to 1 decimal
            overallStars: Math.round(overallScore / 2), // Convert to 1-5 stars
            criteria: ratings,
            details: this.generateRatingDetails(bike, ratings)
        };
    }

    /**
     * Generate detailed explanations for each rating
     */
    generateRatingDetails(bike, ratings) {
        return {
            age: {
                score: ratings.age
            },
            condition: {
                score: ratings.condition
            },
            seller: {
                score: ratings.seller
            },
            priceQuality: {
                score: ratings.priceQuality
            },
            savings: {
                score: ratings.savings
            }
        };
    }



    getSavingsExplanation(bike, score) {
        const savings = Math.round((score - 1) * 5 + 15); // Более высокий процент экономии
        if (score >= 9) return `Максимальная экономия ${savings}% - невероятная выгода по сравнению с РФ`;
        if (score >= 8) return `Отличная экономия ${savings}% относительно российского рынка`;
        if (score >= 7) return `Хорошая экономия ${savings}% по сравнению с ценами в России`;
        if (score >= 6) return `Заметная экономия ${savings}% относительно российских цен`;
        return `Экономия ${savings}% по сравнению с рынком РФ`;
    }

    /**
     * Convert 10-point rating to 5-star display
     */
    convertToStars(rating) {
        return Math.round(rating / 2);
    }

    /**
     * Generate star HTML
     */
    generateStarsHTML(rating, showNumber = true) {
        const stars = this.convertToStars(rating);
        let html = '<div class="rating-stars">';
        
        for (let i = 1; i <= 5; i++) {
            html += `<i class="${i <= stars ? 'fas' : 'far'} fa-star"></i>`;
        }
        
        if (showNumber) {
            html += `<span class="rating-number">${rating}/10</span>`;
        }
        
        html += '</div>';
        return html;
    }
}

// Export for use in other modules
window.BikeRatingSystem = BikeRatingSystem;