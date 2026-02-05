// Product Page Calculator Integration
// Интеграция калькулятора для страницы товара

class ProductCalculator {
    constructor(productData) {
        this.productData = productData;
        this.calculator = new BikeCalculator();
        // Отключаем создание HTML для калькулятора, используем только логику
        this.calculator.createCalculatorHTML = () => {};
        this.calculator.bindEvents = () => {};
        this.calculator.init = () => {};
        
        this.rates = this.calculator.rates;
        this.init();
    }
    
    init() {
        this.extractPriceFromProduct();
        this.calculateAndDisplay();
    }
    
    // Извлекаем цену из данных товара (может быть получена через Gemini API)
    extractPriceFromProduct() {
        // Если цена уже есть в данных товара, используем её
        if (this.productData.price) {
            this.bikePrice = this.productData.price;
            return;
        }
        
        // Если цены нет, пытаемся извлечь из описания через Gemini API
        this.extractPriceWithGemini();
    }
    
    async extractPriceWithGemini() {
        try {
            const prompt = `
            Проанализируй данные о велосипеде и извлеки следующую информацию:
            1. Цену велосипеда в евро (только число)
            2. Размер рамы
            3. Год выпуска (если указан)
            4. Другие важные характеристики
            
            Данные велосипеда:
            Название: ${this.productData.name}
            Модель: ${this.productData.model || 'Не указана'}
            Бренд: ${this.productData.brand}
            Характеристики: ${JSON.stringify(this.productData.specs)}
            
            Верни ответ в формате JSON:
            {
                "price": число_в_евро,
                "frameSize": "размер_рамы",
                "year": "год_выпуска",
                "specs": {
                    "ключ": "значение"
                }
            }
            `;
            
            const response = await fetch(`${CONFIG.GEMINI_API_URL}?key=${CONFIG.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });
            
            const data = await response.json();
            const result = JSON.parse(data.candidates[0].content.parts[0].text);
            
            // Обновляем данные товара
            this.bikePrice = result.price || this.productData.price || 1500;
            this.extractedSpecs = result.specs || {};
            
            // Пересчитываем и отображаем
            this.calculateAndDisplay();
            
        } catch (error) {
            console.error('Ошибка при извлечении данных через Gemini API:', error);
            // Используем цену по умолчанию из данных товара
            this.bikePrice = this.productData.price || 1500;
            this.calculateAndDisplay();
        }
    }
    
    // Используем логику калькулятора для расчета стоимости
    calculateCosts(bikePrice, deliveryCity = 'moscow') {
        // Используем новую логику расчетов из BikeCalculator
        const realTotalPrice = this.calculator.calculateRealPrice(bikePrice);
        const marketingBreakdown = this.calculator.calculateMarketingBreakdown(bikePrice);
        
        return {
            bikePrice: marketingBreakdown.bikePrice,
            deliveryCost: marketingBreakdown.deliveryCost,
            serviceCost: marketingBreakdown.serviceCost,
            logisticsFees: marketingBreakdown.logisticsFees,
            otherFees: marketingBreakdown.otherFees,
            totalEur: marketingBreakdown.totalEur,
            totalRub: marketingBreakdown.totalRub,
            realTotalPrice: realTotalPrice
        };
    }
    
    calculateAndDisplay() {
        const costs = this.calculateCosts(this.bikePrice);
        this.displayPrice(costs);
    }
    
    // Отображаем финальную цену на странице
    displayPrice(costs) {
        // Обновляем основную цену с минималистичным дизайном
        const priceCurrent = document.getElementById('price-current');
        const priceOld = document.getElementById('price-old');
        const priceSavings = document.getElementById('price-savings');
        
        if (priceCurrent) {
            priceCurrent.innerHTML = `
                ${Math.round(costs.totalEur)} € 
                <span class="price-rub-inline">(~ ${Math.round(costs.totalRub).toLocaleString()} ₽*)</span>
                <i class="price-breakdown-arrow" data-lucide="chevron-down"></i>
            `;
        }
        
        // Добавляем примечание о курсе, если его еще нет
        const priceContainer = document.querySelector('.product-price');
        if (priceContainer && !priceContainer.querySelector('.exchange-rate-note')) {
            const noteElement = document.createElement('div');
            noteElement.className = 'exchange-rate-note';
            noteElement.textContent = '*пересчет по актуальному курсу банковской покупки - 98.5 руб.';
            priceContainer.appendChild(noteElement);
        }
        
        // Создаем детализацию расчета
        this.createPriceBreakdown(costs);
        
        // Скрываем старую цену и экономию для минималистичного дизайна
        if (priceOld) {
            priceOld.style.display = 'none';
        }
        
        if (priceSavings) {
            priceSavings.style.display = 'none';
        }
        
        // Инициализируем иконки Lucide
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        // Добавляем обработчик клика на стрелку ПОСЛЕ инициализации иконок
        setTimeout(() => {
            const arrow = document.querySelector('.price-breakdown-arrow');
            if (arrow) {
                arrow.addEventListener('click', () => this.toggleBreakdown());
            }
        }, 100);
    }
    
    // Создаем раскрывающийся список с детализацией
    createPriceBreakdown(costs) {
        const priceContainer = document.querySelector('.product-price');
        if (!priceContainer) return;
        
        const breakdownHTML = `
            <div class="price-breakdown">
                <div class="breakdown-item">Стоимость велосипеда: <span>${Math.round(costs.bikePrice)} €</span></div>
                <div class="breakdown-item">Доставка: <span>${Math.round(costs.deliveryCost)} €</span></div>
                <div class="breakdown-item">Комиссия сервиса (8%): <span>${Math.round(costs.serviceCost)} €</span></div>
                <div class="breakdown-item">Логистические сборы: <span>${Math.round(costs.logisticsFees)} €</span></div>
                <div class="breakdown-item">Прочие сборы: <span>${Math.round(costs.otherFees)} €</span></div>
            </div>
        `;
        
        // Удаляем существующую детализацию и добавляем новую
        const existingBreakdown = priceContainer.querySelector('.price-breakdown');
        if (existingBreakdown) {
            existingBreakdown.remove();
        }
        
        priceContainer.insertAdjacentHTML('beforeend', breakdownHTML);
    }
    
    // Переключение видимости детализации
    toggleBreakdown() {
        const breakdown = document.querySelector('.price-breakdown');
        const arrow = document.querySelector('.price-breakdown-arrow');
        
        if (breakdown && arrow) {
            const isVisible = breakdown.classList.contains('active');
            
            if (isVisible) {
                breakdown.classList.remove('active');
                arrow.classList.remove('active');
            } else {
                breakdown.classList.add('active');
                arrow.classList.add('active');
            }
        }
    }
    
    // Обновление характеристик товара с извлеченными данными
    updateProductSpecs() {
        if (!this.extractedSpecs) return;
        
        const specsContainer = document.querySelector('.product-specs');
        if (!specsContainer) return;
        
        // Добавляем извлеченные характеристики
        Object.entries(this.extractedSpecs).forEach(([key, value]) => {
            const specHTML = `
                <div class="spec-item">
                    <span class="spec-label">${key}:</span>
                    <span class="spec-value">${value}</span>
                </div>
            `;
            specsContainer.insertAdjacentHTML('beforeend', specHTML);
        });
    }
}

// Глобальная функция для инициализации калькулятора на странице товара
window.initProductCalculator = function(productData) {
    window.productCalculator = new ProductCalculator(productData);
};