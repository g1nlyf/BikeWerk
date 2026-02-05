// Catalog functionality for BikeEU
class BikesCatalog {
    constructor() {
        this.bikes = [];
        this.filteredBikes = [];
        this.currentPage = 1;
        this.bikesPerPage = 12;
        this.currentView = 'grid';
        this.activeFilters = {
            category: [],
            brand: [],
            price: [],
            size: [],
            bikeType: [],
            frameMaterial: [],
            suspension: [],
            gearCount: [],
            brakeType: [],
            gender: [],
            wheelDiameter: [],
            year: [],
            discipline: [],
            isElectric: []
        };
        this.currentSort = 'popular';
        this.carouselIntervals = {};
        
        // Price calculation rates (same as in calculator.js)
        this.rates = {
            eur_to_rub: 98.5, // Курс EUR к RUB
            real_delivery: 220, // Реальная стоимость доставки в EUR
            marketing_service_rate: 0.08, // Маркетинговая комиссия сервиса 8%
            // Таблица реальных наценок
            markup_table: [
                { min: 500, max: 1500, markup: 320 },
                { min: 1500, max: 2500, markup: 400 },
                { min: 2500, max: 3500, markup: 500 },
                { min: 3500, max: 5000, markup: 650 },
                { min: 5000, max: 7000, markup: 800 },
                { min: 7000, max: Infinity, markup: 1000 }
            ]
        };
        
        this.init();
    }

    // Определяет реальную наценку по таблице
    getRealMarkup(bikePrice) {
        for (const range of this.rates.markup_table) {
            if (bikePrice >= range.min && bikePrice < range.max) {
                return range.markup;
            }
        }
        // Если цена меньше 500€, возвращаем минимальную наценку
        return this.rates.markup_table[0].markup;
    }

    // Рассчитывает маркетинговые (отображаемые) расходы
    calculateFinalPrice(bikePrice) {
        const realMarkup = this.getRealMarkup(bikePrice);
        const marketingService = bikePrice * this.rates.marketing_service_rate;
        
        // Остаток наценки для распределения
        const markupRemainder = realMarkup - marketingService;
        
        // Распределение остатка:
        // 40% к доставке, 40% в прочие сборы, 20% в логистические сборы
        const deliveryAddition = markupRemainder * 0.4;
        const otherFees = markupRemainder * 0.4;
        const logisticsFees = markupRemainder * 0.2;
        
        const marketingDelivery = this.rates.real_delivery + deliveryAddition;
        
        const totalEur = bikePrice + marketingService + marketingDelivery + logisticsFees + otherFees;
        const totalRub = totalEur * this.rates.eur_to_rub;
        
        return {
            bikePrice: bikePrice,
            serviceCost: marketingService,
            deliveryCost: marketingDelivery,
            logisticsFees: logisticsFees,
            otherFees: otherFees,
            totalEur: totalEur,
            totalRub: totalRub
        };
    }

    async init() {
        try { await this.refreshRates(); } catch {}
        await this.loadBikes();
        this.renderPagination();
        this.setupEventListeners();
        this.initMobileView();
        this.initBrandSearch();
        
        // Check cart state and update button states
        setTimeout(() => {
            this.checkCartStateOnLoad();
            this.updateFavoriteButtonStates();
        }, 500);
    }

    async refreshRates() {
        try {
            const res = await fetch('/api/rates/eur', { method: 'GET', headers: { 'Accept': 'application/json' } });
            const data = await res.json();
            const v = Number(data && data.value);
            if (Number.isFinite(v) && v > 0) {
                this.rates.eur_to_rub = v;
                try { localStorage.setItem('eur_to_rub', String(v)); } catch {}
            } else {
                const fallback = localStorage.getItem('eur_to_rub');
                const n = Number(fallback);
                if (Number.isFinite(n) && n > 0) this.rates.eur_to_rub = n;
            }
        } catch (_) {
            try {
                const v = localStorage.getItem('eur_to_rub');
                const n = Number(v);
                if (Number.isFinite(n) && n > 0) this.rates.eur_to_rub = n;
            } catch {}
        }
    }

    async loadBikes() {
        try {
            // Load bikes from API
            const response = await window.apiClient.getBikes();
            this.bikes = response.bikes || [];
            
            // Load user favorites if authenticated
            if (window.favoritesManager && window.favoritesManager.isAuthenticated()) {
                try {
                    await window.favoritesManager.syncWithServer();
                    const favoriteIds = window.favoritesManager.getFavoriteIds();
                    
                    // Mark bikes as favorites
                    this.bikes.forEach(bike => {
                        bike.isFavorite = favoriteIds.includes(bike.id);
                    });
                } catch (error) {
                    console.warn('Could not load favorites:', error);
                }
            }
            
            this.filteredBikes = [...this.bikes];
            this.generateDynamicFilters();
            this.sortBikes();
            this.renderBikes();
            this.updateResultsCount();
            console.log(`📊 Каталог загружен: ${this.bikes.length} велосипедов`);
        } catch (error) {
            console.error('Error loading bikes:', error);
            // Fallback to empty state
            this.bikes = [];
            this.filteredBikes = [];
            this.renderBikes();
            this.updateResultsCount();
        }
    }

    updateFavoriteButtonStates() {
        if (!window.favoritesManager || !window.favoritesManager.isAuthenticated()) {
            return;
        }

        const favoriteIds = window.favoritesManager.getFavoriteIds();
        this.bikes.forEach(bike => {
            bike.isFavorite = favoriteIds.includes(bike.id);
            const favoriteBtn = document.querySelector(`[data-bike-id="${bike.id}"] .bike-favorite`);
            if (favoriteBtn) {
                favoriteBtn.classList.toggle('active', bike.isFavorite);
            }
        });
    }

    generateDynamicFilters() {
        // Extract unique values from bikes data
        const categories = [...new Set(this.bikes.map(bike => bike.category))].filter(Boolean).sort();
        const brands = [...new Set(this.bikes.map(bike => bike.brand))].filter(Boolean).sort();
        const sizes = [...new Set(this.bikes.map(bike => bike.size))].filter(Boolean).sort();
        
        // Extract new filtering fields
        const bikeTypes = [...new Set(this.bikes.map(bike => bike.bikeType))].filter(Boolean).sort();
        const frameMaterials = [...new Set(this.bikes.map(bike => bike.frameMaterial))].filter(Boolean).sort();
        const suspensions = [...new Set(this.bikes.map(bike => bike.suspension))].filter(Boolean).sort();
        const gearCounts = [...new Set(this.bikes.map(bike => bike.gearCount))].filter(Boolean).sort((a, b) => a - b);
        const brakeTypes = [...new Set(this.bikes.map(bike => bike.brakeType))].filter(Boolean).sort();
        const genders = [...new Set(this.bikes.map(bike => bike.gender))].filter(Boolean).sort();
        const wheelDiameters = [...new Set(this.bikes.map(bike => bike.wheelDiameter))].filter(Boolean).sort((a, b) => a - b);
        const years = [...new Set(this.bikes.map(bike => bike.year))].filter(Boolean).sort((a, b) => b - a);

        // Generate filter groups for existing fields
        this.generateFilterGroup('category', categories, 'Категория', 'fas fa-bicycle');
        this.generateFilterGroup('brand', brands, 'Бренд', 'fas fa-tag');
        this.generateFilterGroup('size', sizes, 'Размер рамы', 'fas fa-ruler');
        
        // Generate filter groups for new fields
        if (bikeTypes.length > 0) {
            this.generateFilterGroup('bikeType', bikeTypes, 'Тип велосипеда', 'fas fa-bicycle');
        }
        if (frameMaterials.length > 0) {
            this.generateFilterGroup('frameMaterial', frameMaterials, 'Материал рамы', 'fas fa-cogs');
        }
        if (suspensions.length > 0) {
            this.generateFilterGroup('suspension', suspensions, 'Подвеска', 'fas fa-compress-arrows-alt');
        }
        if (gearCounts.length > 0) {
            this.generateFilterGroup('gearCount', gearCounts, 'Количество передач', 'fas fa-cog');
        }
        if (brakeTypes.length > 0) {
            this.generateFilterGroup('brakeType', brakeTypes, 'Тип тормозов', 'fas fa-stop-circle');
        }
        if (genders.length > 0) {
            this.generateFilterGroup('gender', genders, 'Пол', 'fas fa-user');
        }
        if (wheelDiameters.length > 0) {
            this.generateFilterGroup('wheelDiameter', wheelDiameters, 'Диаметр колес', 'fas fa-circle');
        }
        if (years.length > 0) {
            this.generateFilterGroup('year', years, 'Год выпуска', 'fas fa-calendar');
        }
        
        // Generate electric bike filter
        const electricBikes = this.bikes.filter(bike => bike.isElectric).length;
        if (electricBikes > 0) {
            this.generateBooleanFilter('isElectric', 'Электровелосипеды', 'fas fa-bolt');
        }
    }

    generateFilterGroup(filterType, values, title, icon) {
        // Find filter container by title text
        const filterGroups = document.querySelectorAll('.filter-group');
        let filterContainer = null;
        
        filterGroups.forEach(group => {
            const titleElement = group.querySelector('.filter-group-title');
            if (titleElement && titleElement.textContent.trim().includes(title)) {
                filterContainer = group;
            }
        });

        if (!filterContainer) {
            console.warn(`Filter container for ${title} not found`);
            return;
        }

        // Clear existing filter options (keep only the title)
        const existingOptions = filterContainer.querySelectorAll('.filter-option');
        existingOptions.forEach(option => option.remove());

        // Generate new filter options
        values.forEach(value => {
            const count = this.bikes.filter(bike => bike[filterType] === value).length;
            const optionElement = this.createFilterOption(filterType, value, value, count);
            filterContainer.appendChild(optionElement);
        });
    }

    createFilterOption(filterType, value, label, count) {
        const option = document.createElement('div');
        option.className = 'filter-option';
        option.onclick = () => this.toggleFilter(filterType, value);
        
        option.innerHTML = `
            <div class="filter-checkbox" data-filter="${filterType}-${value}"></div>
            <span class="filter-label">${label}</span>
            <span class="filter-count">${count}</span>
        `;
        
        return option;
    }

    generateBooleanFilter(filterType, title, icon) {
        // Find filter container by title text
        const filterGroups = document.querySelectorAll('.filter-group');
        let filterContainer = null;
        
        filterGroups.forEach(group => {
            const titleElement = group.querySelector('.filter-group-title');
            if (titleElement && titleElement.textContent.trim().includes(title)) {
                filterContainer = group;
            }
        });

        if (!filterContainer) {
            console.warn(`Filter container for ${title} not found`);
            return;
        }

        // Clear existing filter options (keep only the title)
        const existingOptions = filterContainer.querySelectorAll('.filter-option');
        existingOptions.forEach(option => option.remove());

        // Generate boolean filter option
        const trueCount = this.bikes.filter(bike => bike[filterType] === true).length;
        const falseCount = this.bikes.filter(bike => bike[filterType] === false || !bike[filterType]).length;
        
        if (trueCount > 0) {
            const trueOption = this.createFilterOption(filterType, true, 'Да', trueCount);
            filterContainer.appendChild(trueOption);
        }
        
        if (falseCount > 0) {
            const falseOption = this.createFilterOption(filterType, false, 'Нет', falseCount);
            filterContainer.appendChild(falseOption);
        }
    }

    setupEventListeners() {
        // New price filter setup
        this.setupPriceFilter();
        
        // Old price range inputs (fallback)
        const priceMin = document.getElementById('price-min');
        const priceMax = document.getElementById('price-max');
        
        if (priceMin && priceMax) {
            priceMin.addEventListener('input', () => this.handlePriceFilter());
            priceMax.addEventListener('input', () => this.handlePriceFilter());
        }

        // Sort select
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.sortBikes();
                this.renderBikes();
                this.renderPagination();
                
                // Sync mobile sort selection
                if (typeof selectedMobileSort !== 'undefined' && typeof updateMobileSortRadios === 'function') {
                    selectedMobileSort = e.target.value;
                    updateMobileSortRadios();
                }
            });
        }
    }

    setupPriceFilter() {
        // Currency toggle
        const currencyBtns = document.querySelectorAll('.currency-btn');
        const currencyIcon = document.getElementById('price-currency-icon');
        const currencySymbols = document.querySelectorAll('.currency-symbol');
        
        // Price inputs
        const priceFrom = document.getElementById('price-from');
        const priceTo = document.getElementById('price-to');
        
        // Price sliders
        const sliderMin = document.getElementById('price-slider-min');
        const sliderMax = document.getElementById('price-slider-max');
        const sliderRange = document.querySelector('.slider-range');
        
        // Price value displays
        const priceValueMin = document.getElementById('price-value-min');
        const priceValueMax = document.getElementById('price-value-max');
        
        // Mobile elements
        const mobileCurrencyBtns = document.querySelectorAll('.mobile-currency-btn');
        const mobilePriceFrom = document.getElementById('mobile-price-from');
        const mobilePriceTo = document.getElementById('mobile-price-to');
        const mobileSliderMin = document.getElementById('mobile-price-slider-min');
        const mobileSliderMax = document.getElementById('mobile-price-slider-max');
        const mobilePriceValueMin = document.getElementById('mobile-price-value-min');
        const mobilePriceValueMax = document.getElementById('mobile-price-value-max');
        
        // Current currency and exchange rate
        this.currentCurrency = 'rub';
        this.exchangeRate = 100; // 1 EUR = 100 RUB (approximate)
        
        // Currency toggle handlers
        currencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currencyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const newCurrency = btn.dataset.currency;
                this.switchCurrency(newCurrency);
            });
        });
        
        // Input handlers
        if (priceFrom) {
            priceFrom.addEventListener('input', () => this.updatePriceFromInput());
        }
        if (priceTo) {
            priceTo.addEventListener('input', () => this.updatePriceToInput());
        }
        
        // Slider handlers
        if (sliderMin) {
            sliderMin.addEventListener('input', () => this.updateSliderMin());
        }
        if (sliderMax) {
            sliderMax.addEventListener('input', () => this.updateSliderMax());
        }
        
        // Mobile currency toggle handlers
        mobileCurrencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                mobileCurrencyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const newCurrency = btn.dataset.currency;
                this.switchCurrency(newCurrency);
            });
        });
        
        // Mobile input handlers
        if (mobilePriceFrom) {
            mobilePriceFrom.addEventListener('input', () => this.updateMobilePriceFromInput());
        }
        if (mobilePriceTo) {
            mobilePriceTo.addEventListener('input', () => this.updateMobilePriceToInput());
        }
        
        // Mobile slider handlers
        if (mobileSliderMin) {
            mobileSliderMin.addEventListener('input', () => this.updateMobileSliderMin());
        }
        if (mobileSliderMax) {
            mobileSliderMax.addEventListener('input', () => this.updateMobileSliderMax());
        }
        
        // Initialize values
        this.updateSliderRange();
        this.updatePriceValues();
    }

    switchCurrency(currency) {
        const currencyIcon = document.getElementById('price-currency-icon');
        const currencySymbols = document.querySelectorAll('.currency-symbol');
        const priceFrom = document.getElementById('price-from');
        const priceTo = document.getElementById('price-to');
        const sliderMin = document.getElementById('price-slider-min');
        const sliderMax = document.getElementById('price-slider-max');
        
        const oldCurrency = this.currentCurrency;
        this.currentCurrency = currency;
        
        // Update icons and symbols
        if (currency === 'rub') {
            currencyIcon.className = 'fas fa-ruble-sign';
            currencySymbols.forEach(symbol => symbol.textContent = '₽');
            
            // Convert from EUR to RUB
            if (oldCurrency === 'eur') {
                if (priceFrom.value) priceFrom.value = Math.round(priceFrom.value * this.exchangeRate);
                if (priceTo.value) priceTo.value = Math.round(priceTo.value * this.exchangeRate);
                
                sliderMin.max = 500000;
                sliderMax.max = 500000;
                sliderMin.step = 1000;
                sliderMax.step = 1000;
                
                if (sliderMin.value) sliderMin.value = Math.round(sliderMin.value * this.exchangeRate);
                if (sliderMax.value) sliderMax.value = Math.round(sliderMax.value * this.exchangeRate);
            }
        } else {
            currencyIcon.className = 'fas fa-euro-sign';
            currencySymbols.forEach(symbol => symbol.textContent = '€');
            
            // Convert from RUB to EUR
            if (oldCurrency === 'rub') {
                if (priceFrom.value) priceFrom.value = Math.round(priceFrom.value / this.exchangeRate);
                if (priceTo.value) priceTo.value = Math.round(priceTo.value / this.exchangeRate);
                
                sliderMin.max = 5000;
                sliderMax.max = 5000;
                sliderMin.step = 10;
                sliderMax.step = 10;
                
                if (sliderMin.value) sliderMin.value = Math.round(sliderMin.value / this.exchangeRate);
                if (sliderMax.value) sliderMax.value = Math.round(sliderMax.value / this.exchangeRate);
            }
        }
        
        this.updateSliderRange();
        this.updatePriceValues();
        this.handleNewPriceFilter();
    }

    updatePriceFromInput() {
        const priceFrom = document.getElementById('price-from');
        const sliderMin = document.getElementById('price-slider-min');
        
        if (priceFrom && sliderMin) {
            sliderMin.value = priceFrom.value || 0;
            this.updateSliderRange();
            this.updatePriceValues();
            this.handleNewPriceFilter();
        }
    }

    updatePriceToInput() {
        const priceTo = document.getElementById('price-to');
        const sliderMax = document.getElementById('price-slider-max');
        
        if (priceTo && sliderMax) {
            sliderMax.value = priceTo.value || sliderMax.max;
            this.updateSliderRange();
            this.updatePriceValues();
            this.handleNewPriceFilter();
        }
    }

    updateSliderMin() {
        const sliderMin = document.getElementById('price-slider-min');
        const sliderMax = document.getElementById('price-slider-max');
        const priceFrom = document.getElementById('price-from');
        
        if (sliderMin && sliderMax && priceFrom) {
            if (parseInt(sliderMin.value) >= parseInt(sliderMax.value)) {
                sliderMin.value = parseInt(sliderMax.value) - parseInt(sliderMin.step);
            }
            
            priceFrom.value = sliderMin.value;
            this.updateSliderRange();
            this.updatePriceValues();
            this.handleNewPriceFilter();
        }
    }

    updateSliderMax() {
        const sliderMin = document.getElementById('price-slider-min');
        const sliderMax = document.getElementById('price-slider-max');
        const priceTo = document.getElementById('price-to');
        
        if (sliderMin && sliderMax && priceTo) {
            if (parseInt(sliderMax.value) <= parseInt(sliderMin.value)) {
                sliderMax.value = parseInt(sliderMin.value) + parseInt(sliderMax.step);
            }
            
            priceTo.value = sliderMax.value;
            this.updateSliderRange();
            this.updatePriceValues();
            this.handleNewPriceFilter();
        }
    }

    updateSliderRange() {
        const sliderMin = document.getElementById('price-slider-min');
        const sliderMax = document.getElementById('price-slider-max');
        const sliderRange = document.querySelector('.slider-range');
        
        if (sliderMin && sliderMax && sliderRange) {
            const min = parseInt(sliderMin.value);
            const max = parseInt(sliderMax.value);
            const rangeMin = parseInt(sliderMin.min);
            const rangeMax = parseInt(sliderMin.max);
            
            const leftPercent = ((min - rangeMin) / (rangeMax - rangeMin)) * 100;
            const rightPercent = ((max - rangeMin) / (rangeMax - rangeMin)) * 100;
            
            sliderRange.style.left = leftPercent + '%';
            sliderRange.style.width = (rightPercent - leftPercent) + '%';
        }
    }

    updatePriceValues() {
        const sliderMin = document.getElementById('price-slider-min');
        const sliderMax = document.getElementById('price-slider-max');
        const priceValueMin = document.getElementById('price-value-min');
        const priceValueMax = document.getElementById('price-value-max');
        
        if (sliderMin && sliderMax && priceValueMin && priceValueMax) {
            const symbol = this.currentCurrency === 'rub' ? '₽' : '€';
            const minValue = parseInt(sliderMin.value);
            const maxValue = parseInt(sliderMax.value);
            
            priceValueMin.textContent = this.formatPrice(minValue) + ' ' + symbol;
            priceValueMax.textContent = this.formatPrice(maxValue) + ' ' + symbol;
        }
    }

    formatPrice(price) {
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    // Mobile price filter functions
    updateMobilePriceFromInput() {
        const mobilePriceFrom = document.getElementById('mobile-price-from');
        const mobileSliderMin = document.getElementById('mobile-price-slider-min');
        
        if (mobilePriceFrom && mobileSliderMin) {
            const value = parseInt(mobilePriceFrom.value) || 0;
            mobileSliderMin.value = value;
            this.updateMobilePriceValues();
            this.handleNewPriceFilter();
        }
    }

    updateMobilePriceToInput() {
        const mobilePriceTo = document.getElementById('mobile-price-to');
        const mobileSliderMax = document.getElementById('mobile-price-slider-max');
        
        if (mobilePriceTo && mobileSliderMax) {
            const value = parseInt(mobilePriceTo.value) || parseInt(mobileSliderMax.max);
            mobileSliderMax.value = value;
            this.updateMobilePriceValues();
            this.handleNewPriceFilter();
        }
    }

    updateMobileSliderMin() {
        const mobileSliderMin = document.getElementById('mobile-price-slider-min');
        const mobileSliderMax = document.getElementById('mobile-price-slider-max');
        const mobilePriceFrom = document.getElementById('mobile-price-from');
        
        if (mobileSliderMin && mobileSliderMax && mobilePriceFrom) {
            if (parseInt(mobileSliderMin.value) >= parseInt(mobileSliderMax.value)) {
                mobileSliderMin.value = parseInt(mobileSliderMax.value) - 1000;
            }
            mobilePriceFrom.value = mobileSliderMin.value;
            this.updateMobilePriceValues();
            this.handleNewPriceFilter();
        }
    }

    updateMobileSliderMax() {
        const mobileSliderMin = document.getElementById('mobile-price-slider-min');
        const mobileSliderMax = document.getElementById('mobile-price-slider-max');
        const mobilePriceTo = document.getElementById('mobile-price-to');
        
        if (mobileSliderMin && mobileSliderMax && mobilePriceTo) {
            if (parseInt(mobileSliderMax.value) <= parseInt(mobileSliderMin.value)) {
                mobileSliderMax.value = parseInt(mobileSliderMin.value) + 1000;
            }
            mobilePriceTo.value = mobileSliderMax.value;
            this.updateMobilePriceValues();
            this.handleNewPriceFilter();
        }
    }

    updateMobilePriceValues() {
        const mobileSliderMin = document.getElementById('mobile-price-slider-min');
        const mobileSliderMax = document.getElementById('mobile-price-slider-max');
        const mobilePriceValueMin = document.getElementById('mobile-price-value-min');
        const mobilePriceValueMax = document.getElementById('mobile-price-value-max');
        
        if (mobileSliderMin && mobileSliderMax && mobilePriceValueMin && mobilePriceValueMax) {
            const minValue = parseInt(mobileSliderMin.value);
            const maxValue = parseInt(mobileSliderMax.value);
            
            const symbol = this.currentCurrency === 'rub' ? '₽' : '€';
            const displayMin = this.currentCurrency === 'rub' ? minValue : Math.round(minValue / this.exchangeRate);
            const displayMax = this.currentCurrency === 'rub' ? maxValue : Math.round(maxValue / this.exchangeRate);
            
            mobilePriceValueMin.textContent = `${this.formatPrice(displayMin)} ${symbol}`;
            mobilePriceValueMax.textContent = `${this.formatPrice(displayMax)} ${symbol}`;
        }
    }

    handleNewPriceFilter() {
        // Get desktop price inputs
        const priceFrom = document.getElementById('price-from');
        const priceTo = document.getElementById('price-to');
        
        // Get mobile price inputs
        const mobilePriceFrom = document.getElementById('mobile-price-from');
        const mobilePriceTo = document.getElementById('mobile-price-to');
        
        let min = 0;
        let max = Infinity;
        
        // Use desktop inputs if available, otherwise use mobile inputs
        if (priceFrom && priceTo) {
            min = parseInt(priceFrom.value) || 0;
            max = parseInt(priceTo.value) || Infinity;
        } else if (mobilePriceFrom && mobilePriceTo) {
            min = parseInt(mobilePriceFrom.value) || 0;
            max = parseInt(mobilePriceTo.value) || Infinity;
        }
        
        // Convert to rubles if needed for filtering
        if (this.currentCurrency === 'eur') {
            min = min * this.exchangeRate;
            max = max === Infinity ? Infinity : max * this.exchangeRate;
        }
        
        this.activeFilters.customPrice = { min, max };
        this.applyFilters();
    }

    handlePriceFilter() {
        const priceMin = document.getElementById('price-min');
        const priceMax = document.getElementById('price-max');
        
        if (priceMin && priceMax) {
            const min = parseInt(priceMin.value) || 0;
            const max = parseInt(priceMax.value) || Infinity;
            
            this.activeFilters.customPrice = { min, max };
            this.applyFilters();
        }
    }

    toggleFilter(type, value) {
        const checkbox = document.querySelector(`[data-filter="${type}-${value}"]`);
        const filterOption = checkbox?.closest('.filter-option');
        
        // Prevent toggling disabled filters (unless they're already selected)
        if (filterOption?.classList.contains('disabled') && !checkbox.classList.contains('checked')) {
            return;
        }
        
        if (!this.activeFilters[type].includes(value)) {
            this.activeFilters[type].push(value);
            checkbox.classList.add('checked');
        } else {
            this.activeFilters[type] = this.activeFilters[type].filter(item => item !== value);
            checkbox.classList.remove('checked');
        }
        
        // Add animation
        checkbox.classList.add('filter-animation');
        setTimeout(() => checkbox.classList.remove('filter-animation'), 300);
        
        this.applyFilters();
    }

    applyFilters() {
        // Применяем все активные фильтры
        this.filteredBikes = this.bikes.filter(bike => this.bikeMatchesAllActiveFilters(bike));
        
        // Обновляем интерфейс
        this.currentPage = 1;
        this.sortBikes();
        this.renderBikes();
        this.renderPagination();
        this.updateResultsCount();
        this.updateFilterCounts();
    }

    bikeMatchesAllActiveFilters(bike) {
        // Проверяем каждый тип фильтра
        return this.bikeMatchesFilterType(bike, 'category') &&
               this.bikeMatchesFilterType(bike, 'brand') &&
               this.bikeMatchesFilterType(bike, 'size') &&
               this.bikeMatchesFilterType(bike, 'bikeType') &&
               this.bikeMatchesFilterType(bike, 'frameMaterial') &&
               this.bikeMatchesFilterType(bike, 'suspension') &&
               this.bikeMatchesFilterType(bike, 'gearCount') &&
               this.bikeMatchesFilterType(bike, 'brakeType') &&
               this.bikeMatchesFilterType(bike, 'gender') &&
               this.bikeMatchesFilterType(bike, 'wheelDiameter') &&
               this.bikeMatchesFilterType(bike, 'year') &&
               this.bikeMatchesFilterType(bike, 'discipline') &&
               this.bikeMatchesFilterType(bike, 'isElectric') &&
               this.bikeMatchesPriceFilters(bike);
    }

    bikeMatchesFilterType(bike, filterType) {
        const activeValues = this.activeFilters[filterType];
        
        // Если фильтр не активен, байк проходит проверку
        if (!activeValues || activeValues.length === 0) {
            return true;
        }

        // Проверяем соответствие байка хотя бы одному значению фильтра
        return activeValues.some(value => this.bikeMatchesFilterValue(bike, filterType, value));
    }

    bikeMatchesPriceFilters(bike) {
        const finalPrice = this.calculateFinalPrice(bike.price).totalRub;
        
        // Проверяем фиксированные ценовые диапазоны
        if (this.activeFilters.price && this.activeFilters.price.length > 0) {
            const priceMatch = this.activeFilters.price.some(range => this.checkPriceRange(finalPrice, range));
            if (!priceMatch) return false;
        }
        
        // Проверяем кастомный ценовой диапазон
        if (this.activeFilters.customPrice) {
            const { min, max } = this.activeFilters.customPrice;
            if (finalPrice < min || finalPrice > max) {
                return false;
            }
        }
        
        return true;
    }

    updateFilterCounts() {
        // Получаем все опции фильтров
        const filterOptions = document.querySelectorAll('.filter-option');
        
        filterOptions.forEach(option => {
            const checkbox = option.querySelector('.filter-checkbox');
            const countElement = option.querySelector('.filter-count');
            
            if (!checkbox || !countElement) return;
            
            // Извлекаем тип фильтра и значение из атрибута data-filter
            const filterData = checkbox.getAttribute('data-filter');
            if (!filterData) return;
            
            const [filterType, ...valueParts] = filterData.split('-');
            const value = valueParts.join('-');
            
            // Подсчитываем количество байков для этой опции
            const count = this.countBikesForFilterOption(filterType, value);
            
            // Обновляем отображение количества
            countElement.textContent = count;
            
            // Проверяем, активна ли эта опция
            const isSelected = checkbox.classList.contains('checked');
            
            // Скрываем или отключаем опции с нулевым количеством
            if (count === 0 && !isSelected) {
                if (filterType === 'brand') {
                    // Для брендов - скрываем полностью
                    option.style.display = 'none';
                } else {
                    // Для остальных - делаем серыми и некликабельными
                    option.classList.add('disabled');
                    option.style.pointerEvents = 'none';
                    option.style.opacity = '0.5';
                }
            } else {
                // Показываем и активируем опцию
                option.style.display = 'block';
                option.classList.remove('disabled');
                option.style.pointerEvents = '';
                option.style.opacity = '';
            }
        });
    }

    countBikesForFilterOption(filterType, filterValue) {
        // Создаем временное состояние фильтров без текущего типа фильтра
        const tempFilters = this.createFiltersWithoutType(filterType);
        
        // Подсчитываем байки, которые:
        // 1. Соответствуют всем остальным активным фильтрам
        // 2. Соответствуют данной опции фильтра
        return this.bikes.filter(bike => {
            return this.bikeMatchesFilters(bike, tempFilters) && 
                   this.bikeMatchesFilterValue(bike, filterType, filterValue);
        }).length;
    }

    createFiltersWithoutType(excludeType) {
        const tempFilters = {};
        
        // Копируем все активные фильтры, кроме исключаемого типа
        Object.keys(this.activeFilters).forEach(type => {
            if (type !== excludeType && this.activeFilters[type] && this.activeFilters[type].length > 0) {
                tempFilters[type] = [...this.activeFilters[type]];
            }
        });
        
        // Добавляем кастомный ценовой фильтр, если он активен
        if (this.activeFilters.customPrice && excludeType !== 'customPrice') {
            tempFilters.customPrice = this.activeFilters.customPrice;
        }
        
        return tempFilters;
    }

    bikeMatchesFilters(bike, filters) {
        // Проверяем соответствие байка заданному набору фильтров
        for (const [filterType, values] of Object.entries(filters)) {
            if (filterType === 'customPrice') {
                // Проверяем кастомный ценовой диапазон
                const { min, max } = values;
                const finalPrice = this.calculateFinalPrice(bike.price).totalRub;
                if (finalPrice < min || finalPrice > max) {
                    return false;
                }
            } else if (filterType === 'price') {
                // Проверяем фиксированные ценовые диапазоны
                const finalPrice = this.calculateFinalPrice(bike.price).totalRub;
                const priceMatch = values.some(range => this.checkPriceRange(finalPrice, range));
                if (!priceMatch) {
                    return false;
                }
            } else if (values && values.length > 0) {
                // Проверяем обычные фильтры
                if (!values.some(value => this.bikeMatchesFilterValue(bike, filterType, value))) {
                    return false;
                }
            }
        }
        return true;
    }

    bikeMatchesFilterValue(bike, filterType, value) {
        switch (filterType) {
            case 'category':
                return bike.category && bike.category.toLowerCase() === value.toLowerCase();
            case 'brand':
                return bike.brand && bike.brand.toLowerCase() === value.toLowerCase();
            case 'size':
                return bike.size && bike.size.toLowerCase() === value.toLowerCase();
            case 'bikeType':
                return bike.bikeType && bike.bikeType.toLowerCase() === value.toLowerCase();
            case 'frameMaterial':
                return bike.frameMaterial && bike.frameMaterial.toLowerCase() === value.toLowerCase();
            case 'suspension':
                return bike.suspension && bike.suspension.toLowerCase() === value.toLowerCase();
            case 'gearCount':
                return bike.gearCount && bike.gearCount == value;
            case 'brakeType':
                return bike.brakeType && bike.brakeType.toLowerCase() === value.toLowerCase();
            case 'gender':
                return bike.gender && bike.gender.toLowerCase() === value.toLowerCase();
            case 'wheelDiameter':
                return bike.wheelDiameter && bike.wheelDiameter == value;
            case 'year':
                return bike.year && bike.year == value;
            case 'discipline':
                return (bike.discipline || 'Другое') === value;
            case 'isElectric':
                if (value === 'true' || value === true) {
                    return bike.isElectric === true;
                } else {
                    return bike.isElectric === false || !bike.isElectric;
                }
            default:
                return false;
        }
    }

    testBikeAgainstFilters(bike, filters) {
        // Test bike against all filters except the one being tested
        // Category filter
        if (filters.category && filters.category.length > 0 && 
            !filters.category.some(category => category.toLowerCase() === bike.category.toLowerCase())) {
            return false;
        }
        
        // Brand filter
        if (filters.brand && filters.brand.length > 0 && 
            !filters.brand.some(brand => brand.toLowerCase() === bike.brand.toLowerCase())) {
            return false;
        }
        
        // Size filter
        if (filters.size && filters.size.length > 0 && 
            !filters.size.some(size => size.toLowerCase() === bike.size.toLowerCase())) {
            return false;
        }
        
        // Bike type filter
        if (filters.bikeType && filters.bikeType.length > 0 && 
            !filters.bikeType.some(type => type.toLowerCase() === (bike.bikeType || '').toLowerCase())) {
            return false;
        }
        
        // Frame material filter
        if (filters.frameMaterial && filters.frameMaterial.length > 0 && 
            !filters.frameMaterial.some(material => material.toLowerCase() === (bike.frameMaterial || '').toLowerCase())) {
            return false;
        }
        
        // Suspension filter
        if (filters.suspension && filters.suspension.length > 0 && 
            !filters.suspension.some(susp => susp.toLowerCase() === (bike.suspension || '').toLowerCase())) {
            return false;
        }
        
        // Gear count filter
        if (filters.gearCount && filters.gearCount.length > 0 && 
            !filters.gearCount.some(count => count == bike.gearCount)) {
            return false;
        }
        
        // Brake type filter
        if (filters.brakeType && filters.brakeType.length > 0 && 
            !filters.brakeType.some(brake => brake.toLowerCase() === (bike.brakeType || '').toLowerCase())) {
            return false;
        }
        
        // Gender filter
        if (filters.gender && filters.gender.length > 0 && 
            !filters.gender.some(gender => gender.toLowerCase() === (bike.gender || '').toLowerCase())) {
            return false;
        }
        
        // Wheel diameter filter
        if (filters.wheelDiameter && filters.wheelDiameter.length > 0 && 
            !filters.wheelDiameter.some(diameter => diameter == bike.wheelDiameter)) {
            return false;
        }
        
        // Year filter
        if (filters.year && filters.year.length > 0 && 
            !filters.year.some(year => year == bike.year)) {
            return false;
        }
        
        // Electric bike filter
        if (filters.isElectric && filters.isElectric.length > 0) {
            const isElectricFilter = filters.isElectric.some(val => val === true || val === 'true');
            const isNotElectricFilter = filters.isElectric.some(val => val === false || val === 'false');
            
            if (isElectricFilter && !bike.isElectric) return false;
            if (isNotElectricFilter && bike.isElectric) return false;
        }
        
        // Price range filter
        if (filters.price && filters.price.length > 0) {
            let priceMatch = false;
            for (let range of filters.price) {
                if (this.checkPriceRange(bike.price, range)) {
                    priceMatch = true;
                    break;
                }
            }
            if (!priceMatch) return false;
        }
        
        // Custom price filter
        if (filters.customPrice) {
            const { min, max } = filters.customPrice;
            if (bike.price < min || bike.price > max) {
                return false;
            }
        }
        
        return true;
    }

    checkPriceRange(price, range) {
        switch (range) {
            case '0-500':
                return price <= 50000; // 0-50,000 рублей
            case '500-1000':
                return price > 50000 && price <= 100000; // 50,000-100,000 рублей
            case '1000-1500':
                return price > 100000 && price <= 150000; // 100,000-150,000 рублей
            case '1500-2000':
                return price > 150000 && price <= 200000; // 150,000-200,000 рублей
            case '1000-2000':
                return price > 100000 && price <= 200000; // 100,000-200,000 рублей (для совместимости)
            case '2000+':
                return price > 200000; // 200,000+ рублей
            default:
                return true;
        }
    }

    sortBikes() {
        switch (this.currentSort) {
            case 'price-asc':
                this.filteredBikes.sort((a, b) => a.price - b.price);
                break;
            case 'price-desc':
                this.filteredBikes.sort((a, b) => b.price - a.price);
                break;
            case 'name':
                this.filteredBikes.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'newest':
                this.filteredBikes.sort((a, b) => b.id - a.id);
                break;
            case 'discount':
                this.filteredBikes.sort((a, b) => {
                    // Bikes with discounts first, then by discount percentage (highest first)
                    const aDiscount = a.hasDiscount ? (a.discountPercentage || 0) : 0;
                    const bDiscount = b.hasDiscount ? (b.discountPercentage || 0) : 0;
                    return bDiscount - aDiscount;
                });
                break;
            case 'popular':
            default:
                this.filteredBikes.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
                break;
        }
    }

    renderBikes() {
        const grid = document.getElementById('bikes-grid');
        if (!grid) return;
        
        grid.classList.add('loading');
        
        setTimeout(() => {
            const startIndex = (this.currentPage - 1) * this.bikesPerPage;
            const endIndex = startIndex + this.bikesPerPage;
            const bikesToShow = this.filteredBikes.slice(startIndex, endIndex);
            
            // Show placeholder if no bikes available
            if (bikesToShow.length === 0 && this.bikes.length === 0) {
                grid.innerHTML = `
                    <div class="empty-catalog-placeholder" id="empty-placeholder">
                        <div class="icon">
                            <i class="fas fa-bicycle"></i>
                        </div>
                        <h3>Каталог пуст</h3>
                        <p>Скоро тут появится каталог велосипедов!</p>
                    </div>
                `;
            } else {
                grid.innerHTML = bikesToShow.map(bike => this.createBikeCard(bike)).join('');
            }
            
            grid.classList.remove('loading');
            
            // Add fade-in animation
            const cards = grid.querySelectorAll('.bike-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('fade-in');
                }, index * 50);
            });
            
            // Check cart state and update button states
            setTimeout(() => {
                this.checkCartStateOnLoad();
            }, 300);
        }, 200);
    }

    createBikeCard(bike) {
        // Calculate final price with all fees
        const priceCalculation = this.calculateFinalPrice(bike.price);
        
        // Enhanced discount badge with special styling for bot-generated discounts
        let discountBadge = '';
        if (bike.hasDiscount && bike.discountPercentage) {
            // Special discount badge for bot-generated discounts
            discountBadge = `<div class="discount-badge bot-discount">
                <div class="discount-sticker">
                    <span class="discount-text">-${bike.discountPercentage}%</span>
                    <span class="discount-label">🇷🇺 vs 🇪🇺</span>
                </div>
            </div>`;
        } else if (bike.originalPrice && bike.originalPrice > bike.price) {
            // Regular discount badge
            discountBadge = `<div class="discount-badge">-${Math.round((1 - bike.price / bike.originalPrice) * 100)}%</div>`;
        }
        
        const newBadge = bike.isNew ? '<div class="new-badge">NEW</div>' : '';
        
        // Enhanced price display with strikethrough for bot discounts
        let priceDisplay = '';
        if (bike.hasDiscount && bike.originalPrice) {
            priceDisplay = `
                <div class="bike-price discount-price">
                    <div class="price-comparison">
                        <span class="price-old-strikethrough">${Math.round(bike.originalPrice)}€</span>
                        <span class="price-current discount-current">${Math.round(bike.price)}€</span>
                    </div>
                    <div class="price-rub-container">
                        <span class="price-rub">${Math.round(priceCalculation.totalRub).toLocaleString('ru-RU')} ₽</span>
                        <span class="savings-text">Экономия: ${Math.round(bike.originalPrice - bike.price)}€</span>
                    </div>
                </div>
            `;
        } else {
            const oldPrice = bike.originalPrice && bike.originalPrice > bike.price ? 
                `<span class="price-old">${bike.originalPrice}€</span>` : '';
            priceDisplay = `
                <div class="bike-price">
                    <span class="price-current">${Math.round(priceCalculation.totalEur)}€</span>
                    <span class="price-rub">${Math.round(priceCalculation.totalRub).toLocaleString('ru-RU')} ₽</span>
                    ${oldPrice}
                </div>
            `;
        }

        // Generate multiple images for carousel effect
        const additionalImages = this.generateAdditionalImages(bike);
        const allImages = [bike.image, ...additionalImages];

        return `
            <div class="bike-card ${bike.hasDiscount ? 'has-discount' : ''}" data-bike-id="${bike.id}" onmouseenter="catalog.startImageCarousel(${bike.id})" onmouseleave="catalog.stopImageCarousel(${bike.id})" onclick="catalog.goToProductDetail(${bike.id})">
                <div class="bike-image-container">
                    <div class="bike-image-carousel" id="carousel-${bike.id}">
                        ${allImages.map((img, index) => `
                            <img src="${img}" alt="${bike.name}" loading="lazy" class="bike-image ${index === 0 ? 'active' : ''}" data-index="${index}">
                        `).join('')}
                    </div>
                    ${discountBadge}
                    ${newBadge}
                    <button class="bike-favorite ${bike.isFavorite ? 'active' : ''}" 
                            onclick="event.stopPropagation(); catalog.toggleFavorite(${bike.id})">
                        <i class="fas fa-heart"></i>
                    </button>
                    <div class="hover-overlay">
                        <button class="btn-quick-view" onclick="event.stopPropagation(); catalog.quickView(${bike.id})">
                            <i class="fas fa-eye"></i>
                            Быстрый просмотр
                        </button>
                    </div>
                </div>
                <div class="bike-info">
                    <div class="bike-header">
                        <h3 class="bike-title">${bike.name}</h3>
                        <span class="bike-id">ID: ${bike.id}</span>
                    </div>
                    <div class="bike-rating">
                        <div class="stars">
                            ${this.generateStars(this.calculateBikeRating(bike))}
                        </div>
                        <span class="rating-count">${this.calculateBikeRating(bike).toFixed(1)}/10</span>
                    </div>
                    ${bike.technicalSummary && bike.technicalSummary !== 'Недостаточно информации для технической оценки' ? `
                        <div class="bike-technical-summary">
                            <div class="technical-summary-text">${bike.technicalSummary}</div>
                            ${bike.conditionRating ? `<div class="condition-rating">Состояние: ${bike.conditionRating}/10</div>` : ''}
                        </div>
                    ` : ''}
                    ${priceDisplay}
                </div>
                <button class="btn-add-cart-full" onclick="event.stopPropagation(); catalog.addToCart(${bike.id})">
                    <i class="fas fa-shopping-cart"></i>
                    В корзину
                </button>
            </div>
        `;
    }

    generateAdditionalImages(bike) {
        // If bike has multiple images, use them (excluding the first one which is already used as main image)
        if (bike.images && bike.images.length > 1) {
            return bike.images.slice(1); // Return all images except the first one
        }
        
        // Fallback to placeholder images for carousel if no additional images available
        const baseImages = [
            'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            'https://images.unsplash.com/photo-1544191696-15693072e0b5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            'https://images.unsplash.com/photo-1571068316344-75bc76f77890?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            'https://images.unsplash.com/photo-1502744688674-c619d1586c9e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'
        ];
        
        // Return 2-3 additional images
        return baseImages.slice(0, 2 + Math.floor(Math.random() * 2));
    }

    calculateBikeRating(bike) {
        // Используем систему рейтинга для расчета общей оценки
        if (!window.BikeRatingSystem) {
            return 4.5; // Fallback если система рейтинга не загружена
        }
        
        const ratingSystem = new window.BikeRatingSystem();
        const rating = ratingSystem.calculateOverallRating(bike);
        return rating.overall;
    }

    generateStars(rating) {
        // Конвертируем рейтинг из 10-балльной в 5-балльную систему для звезд
        const starsRating = (rating / 10) * 5;
        
        const fullStars = Math.floor(starsRating);
        const hasHalfStar = starsRating % 1 !== 0;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }
        return stars;
    }

    startImageCarousel(bikeId) {
        const carousel = document.getElementById(`carousel-${bikeId}`);
        if (!carousel) return;
        
        const images = carousel.querySelectorAll('.bike-image');
        if (images.length <= 1) return;
        
        let currentIndex = 0;
        
        // Clear any existing interval
        if (this.carouselIntervals && this.carouselIntervals[bikeId]) {
            clearInterval(this.carouselIntervals[bikeId]);
        }
        
        if (!this.carouselIntervals) {
            this.carouselIntervals = {};
        }
        
        this.carouselIntervals[bikeId] = setInterval(() => {
            images[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % images.length;
            images[currentIndex].classList.add('active');
        }, 800); // Change image every 800ms
    }

    stopImageCarousel(bikeId) {
        if (this.carouselIntervals && this.carouselIntervals[bikeId]) {
            clearInterval(this.carouselIntervals[bikeId]);
            delete this.carouselIntervals[bikeId];
            
            // Reset to first image
            const carousel = document.getElementById(`carousel-${bikeId}`);
            if (carousel) {
                const images = carousel.querySelectorAll('.bike-image');
                images.forEach((img, index) => {
                    img.classList.toggle('active', index === 0);
                });
            }
        }
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;
        
        const totalPages = Math.ceil(this.filteredBikes.length / this.bikesPerPage);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button class="pagination-btn" 
                    onclick="catalog.goToPage(${this.currentPage - 1})"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="catalog.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-dots">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                        onclick="catalog.goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="pagination-dots">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn" onclick="catalog.goToPage(${totalPages})">${totalPages}</button>`;
        }
        
        // Next button
        paginationHTML += `
            <button class="pagination-btn" 
                    onclick="catalog.goToPage(${this.currentPage + 1})"
                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredBikes.length / this.bikesPerPage);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.renderBikes();
        this.renderPagination();
        
        // Scroll to top of catalog
        document.querySelector('.catalog-content').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    updateResultsCount() {
        const countElement = document.getElementById('results-count');
        if (countElement) {
            countElement.textContent = this.filteredBikes.length;
        }
    }

    setView(view) {
        this.currentView = view;
        const grid = document.getElementById('bikes-grid');
        const buttons = document.querySelectorAll('.view-btn');
        
        buttons.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[onclick="setView('${view}')"]`).classList.add('active');
        
        if (view === 'list') {
            grid.classList.add('list-view');
        } else {
            grid.classList.remove('list-view');
        }
    }

    setMobileView(view) {
        const grid = document.getElementById('bikes-grid');
        
        // Remove all mobile view classes
        grid.classList.remove('mobile-single', 'mobile-double', 'mobile-triple');
        
        // Add the selected view class
        grid.classList.add(`mobile-${view}`);
        
        // Update view indicator
        this.updateViewIndicator(view);
        
        // Save preference to localStorage
        localStorage.setItem('mobileViewPreference', view);
    }

    updateViewIndicator(view) {
        const indicator = document.querySelector('.view-indicator');
        if (indicator) {
            const viewNumbers = {
                'single': '1',
                'double': '2', 
                'triple': '3'
            };
            indicator.textContent = viewNumbers[view] || '2';
        }
    }

    toggleMobileView() {
        const currentView = localStorage.getItem('mobileViewPreference') || 'double';
        const views = ['single', 'double', 'triple'];
        const currentIndex = views.indexOf(currentView);
        const nextIndex = (currentIndex + 1) % views.length;
        const nextView = views[nextIndex];
        
        this.setMobileView(nextView);
    }

    initMobileView() {
        // Get saved preference or default to 'double'
        const savedView = localStorage.getItem('mobileViewPreference') || 'double';
        
        // Set the initial mobile view
        this.setMobileView(savedView);
    }

    clearAllFilters() {
        // Reset all filters
        this.activeFilters = {
            category: [],
            brand: [],
            price: [],
            size: [],
            bikeType: [],
            frameMaterial: [],
            suspension: [],
            gearCount: [],
            brakeType: [],
            gender: [],
            wheelDiameter: [],
            year: [],
            discipline: [],
            isElectric: []
        };
        
        // Clear custom price
        delete this.activeFilters.customPrice;
        const priceMin = document.getElementById('price-min');
        const priceMax = document.getElementById('price-max');
        if (priceMin) priceMin.value = '';
        if (priceMax) priceMax.value = '';
        
        // Clear new price filter
        const priceFrom = document.getElementById('price-from');
        const priceTo = document.getElementById('price-to');
        const sliderMin = document.getElementById('price-slider-min');
        const sliderMax = document.getElementById('price-slider-max');
        
        if (priceFrom) priceFrom.value = '';
        if (priceTo) priceTo.value = '';
        if (sliderMin) {
            sliderMin.value = sliderMin.min;
        }
        if (sliderMax) {
            sliderMax.value = sliderMax.max;
        }
        
        // Clear mobile price filter
        const mobilePriceFrom = document.getElementById('mobile-price-from');
        const mobilePriceTo = document.getElementById('mobile-price-to');
        const mobileSliderMin = document.getElementById('mobile-price-slider-min');
        const mobileSliderMax = document.getElementById('mobile-price-slider-max');
        
        if (mobilePriceFrom) mobilePriceFrom.value = '';
        if (mobilePriceTo) mobilePriceTo.value = '';
        if (mobileSliderMin) {
            mobileSliderMin.value = mobileSliderMin.min;
        }
        if (mobileSliderMax) {
            mobileSliderMax.value = mobileSliderMax.max;
        }
        
        // Reset currency to RUB
        const currencyBtns = document.querySelectorAll('.currency-btn');
        currencyBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.currency === 'rub') {
                btn.classList.add('active');
            }
        });
        
        if (this.currentCurrency) {
            this.currentCurrency = 'rub';
            this.updateSliderRange();
            this.updatePriceValues();
            this.updateMobilePriceValues();
        }
        
        // Uncheck all checkboxes
        document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
            checkbox.classList.remove('checked');
        });
        
        // Reset sort
        this.currentSort = 'popular';
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) sortSelect.value = 'popular';
        
        // Reset brand search
        const brandSearch = document.getElementById('brand-search');
        if (brandSearch) {
            brandSearch.value = '';
            this.filterBrandList('');
        }
        
        // Reset brand list state
        const brandContainer = document.getElementById('brand-list-container');
        const expandArrow = document.querySelector('.brand-expand-arrow');
        
        if (brandContainer && expandArrow) {
            brandContainer.classList.remove('expanded');
            expandArrow.style.display = 'flex';
        }

        // Reset mobile brand search and list state
        const mobileBrandSearch = document.getElementById('mobile-brand-search');
        const mobileBrandContainer = document.getElementById('mobile-brand-list-container');
        const mobileExpandArrow = document.querySelector('.mobile-brand-expand-arrow');
        
        if (mobileBrandSearch) {
            mobileBrandSearch.value = '';
        }
        
        if (mobileBrandContainer && mobileExpandArrow) {
            mobileBrandContainer.classList.remove('expanded');
            mobileExpandArrow.style.display = 'block';
            
            // Reset mobile brand options to default state
            const mobileBrandOptions = document.querySelectorAll('.mobile-brand-items-wrapper .filter-option');
            mobileBrandOptions.forEach(option => {
                option.style.display = '';
                // Hide options that should be hidden by default
                if (option.classList.contains('mobile-brand-hidden')) {
                    option.style.display = 'none';
                }
            });
        }
        
        // Apply filters
        this.applyFilters();
    }

    async toggleFavorite(bikeId) {
        // Check if user is authenticated
        if (!window.favoritesManager.isAuthenticated()) {
            this.showGuestOverlay();
            return;
        }

        const bike = this.bikes.find(b => b.id === bikeId);
        if (!bike) return;

        const favoriteBtn = document.querySelector(`[data-bike-id="${bikeId}"] .bike-favorite`);
        if (!favoriteBtn) return;

        // Создаем ripple эффект
        this.createFavoriteRipple(favoriteBtn);

        try {
            const result = await window.favoritesManager.toggleFavorite(bikeId);
            bike.isFavorite = result.isFavorite;
            
            if (bike.isFavorite) {
                // Анимация добавления в избранное с частицами
                favoriteBtn.classList.add('pulse');
                this.createFavoriteParticles(favoriteBtn);
                setTimeout(() => favoriteBtn.classList.remove('pulse'), 600);
            } else {
                // Анимация удаления из избранного
                favoriteBtn.classList.add('pulse');
                setTimeout(() => favoriteBtn.classList.remove('pulse'), 600);
            }
            
            // Update UI
            favoriteBtn.classList.toggle('active', bike.isFavorite);
            
        } catch (error) {
            console.error('Error toggling favorite:', error);
            // Show error message to user
            alert('Ошибка при добавлении в избранное. Попробуйте еще раз.');
        }
    }

    createFavoriteRipple(button) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = '50%';
        ripple.style.top = '50%';
        ripple.style.transform = 'translate(-50%, -50%)';
        
        button.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    createFavoriteParticles(button) {
        const particlesContainer = document.createElement('div');
        particlesContainer.classList.add('favorite-particles');
        
        const rect = button.getBoundingClientRect();
        const containerRect = button.closest('.bike-card').getBoundingClientRect();
        
        particlesContainer.style.left = (rect.left - containerRect.left + rect.width / 2) + 'px';
        particlesContainer.style.top = (rect.top - containerRect.top + rect.height / 2) + 'px';
        
        button.closest('.bike-card').appendChild(particlesContainer);
        
        // Создаем 6 частиц-сердечек
        for (let i = 0; i < 6; i++) {
            const particle = document.createElement('i');
            particle.classList.add('favorite-particle', 'fas', 'fa-heart');
            
            // Случайное направление
            const angle = (i * 60) + Math.random() * 30 - 15; // Распределяем по кругу с небольшой случайностью
            const distance = 40 + Math.random() * 20;
            
            particle.style.left = Math.cos(angle * Math.PI / 180) * distance + 'px';
            particle.style.top = Math.sin(angle * Math.PI / 180) * distance + 'px';
            particle.style.animationDelay = (i * 0.1) + 's';
            
            particlesContainer.appendChild(particle);
        }
        
        // Удаляем контейнер после анимации
        setTimeout(() => {
            if (particlesContainer.parentNode) {
                particlesContainer.parentNode.removeChild(particlesContainer);
            }
        }, 1500);
    }

    async addToCart(bikeId) {
        console.log('addToCart called with bikeId:', bikeId, 'type:', typeof bikeId);
        console.log('this.bikes:', this.bikes);
        console.log('this.bikes length:', this.bikes ? this.bikes.length : 'undefined');
        
        // Convert bikeId to number for comparison
        const numericBikeId = parseInt(bikeId);
        const bike = this.bikes.find(b => b.id === numericBikeId);
        console.log('Found bike for cart:', bike);
        
        if (!bike) {
            console.error('Bike not found for cart with id:', bikeId, 'numeric:', numericBikeId);
            return;
        }

        // Find the button that was clicked
        const button = event.target.closest('.btn-add-cart-full');
        if (!button) {
            console.error('Button not found for animation');
            return;
        }

        // Check if user is logged in
        if (window.simpleCartManager && !window.simpleCartManager.isUserLoggedIn()) {
            // Store selected product for application creation
            const priceData = this.calculateFinalPrice(bike.price);
            selectedProductForApplication = {
                id: bike.id,
                name: bike.name,
                brand: bike.brand,
                price: Math.round(priceData.totalRub),
                priceEur: Math.round(priceData.totalEur),
                originalPrice: bike.price,
                image: bike.images && bike.images.length > 0 ? bike.images[0] : 'src/images/placeholder-bike.jpg',
                type: bike.type,
                size: bike.size,
                color: bike.color,
                category: bike.category,
                frameMaterial: bike.frameMaterial,
                suspension: bike.suspension,
                gearCount: bike.gearCount,
                brakeType: bike.brakeType,
                wheelDiameter: bike.wheelDiameter,
                year: bike.year,
                discipline: bike.discipline,
                isElectric: bike.isElectric
            };
            
            // Show guest overlay instead of notification
            this.showGuestOverlay();
            return;
        }

        // Calculate final price for the product
        const priceData = this.calculateFinalPrice(bike.price);
        
        // Prepare product data for cart
        const productData = {
            id: bike.id,
            name: bike.name,
            brand: bike.brand,
            price: Math.round(priceData.totalRub),
            image: bike.images && bike.images.length > 0 ? bike.images[0] : 'src/images/placeholder-bike.jpg',
            type: bike.type,
            size: bike.size,
            color: bike.color,
            category: bike.category,
            frameMaterial: bike.frameMaterial,
            suspension: bike.suspension,
            gearCount: bike.gearCount,
            brakeType: bike.brakeType,
            wheelDiameter: bike.wheelDiameter,
            year: bike.year,
            discipline: bike.discipline,
            isElectric: bike.isElectric,
            originalPrice: bike.price,
            priceEur: Math.round(priceData.totalEur)
        };

        // Animate the button
        this.animateCartButton(button, bike);

        // Use the global simple cart manager to add the item
        if (window.simpleCartManager) {
            window.simpleCartManager.addToCart(productData).catch(error => {
                console.error('Error adding to cart:', error);
            });
        } else {
            console.error('Simple cart manager not available');
        }
    }

    // Animation functions for catalog buttons
    animateCartButton(button, bike) {
        if (!button) return;

        // Disable button to prevent multiple clicks
        button.disabled = true;
        
        // Start the animation sequence
        this.startCartAnimation(button);
    }

    startCartAnimation(button) {
        const iconEl = button.querySelector('i');
        const textContent = button.textContent.trim();

        // Phase 1: Animation start
        button.classList.add('cart-animating');
        button.style.transform = 'scale(0.95)';
        button.style.background = 'linear-gradient(135deg, #2c5aa0 0%, #28a745 100%)';
        
        // Create ripple effect
        this.createCatalogRipple(button);

        // Icon animation
        if (iconEl) {
            iconEl.style.transform = 'scale(1.2) rotate(360deg)';
            iconEl.style.transition = 'transform 0.6s ease';
        }
        
        setTimeout(() => {
            // Phase 2: Success state
            button.classList.remove('cart-animating');
            button.classList.add('in-cart');
            button.style.transform = 'scale(1)';
            button.style.background = '#28a745';
            
            // Update content
            button.innerHTML = `
                <i class="fas fa-check-circle"></i>
                В корзине
            `;
            
            // Create success particles
            this.createCatalogParticles(button);
            
            setTimeout(() => {
                // Phase 3: Final state - go to cart
                button.innerHTML = `
                    <i class="fas fa-shopping-cart"></i>
                    Перейти в корзину
                `;
                
                button.disabled = false;
                
                // Update click handler
                button.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = 'cart.html';
                };
                
            }, 1500);
        }, 800);
    }

    createCatalogRipple(button) {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(40, 167, 69, 0.3);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: catalogRipple 0.6s ease-out forwards;
            pointer-events: none;
            z-index: 1;
        `;
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        // Add ripple animation if not exists
        if (!document.getElementById('catalog-ripple-style')) {
            const style = document.createElement('style');
            style.id = 'catalog-ripple-style';
            style.textContent = `
                @keyframes catalogRipple {
                    0% {
                        width: 0;
                        height: 0;
                        opacity: 1;
                    }
                    100% {
                        width: 100px;
                        height: 100px;
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    createCatalogParticles(button) {
        const colors = ['#28a745', '#20c997', '#2c5aa0', '#f59e0b'];
        const particleCount = 8;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            const angle = (i / particleCount) * 360;
            const distance = 30 + Math.random() * 20;
            
            particle.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 4px;
                height: 4px;
                background: ${colors[i % colors.length]};
                border-radius: 50%;
                transform: translate(-50%, -50%);
                animation: catalogParticle${i} 0.8s ease-out forwards;
                pointer-events: none;
                z-index: 10;
            `;
            
            // Create unique keyframe for each particle
            const keyframes = `
                @keyframes catalogParticle${i} {
                    0% {
                        transform: translate(-50%, -50%) scale(0);
                        opacity: 1;
                    }
                    50% {
                        transform: translate(-50%, -50%) 
                                  translate(${Math.cos(angle * Math.PI / 180) * distance}px, 
                                           ${Math.sin(angle * Math.PI / 180) * distance}px) 
                                  scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) 
                                  translate(${Math.cos(angle * Math.PI / 180) * distance * 1.5}px, 
                                           ${Math.sin(angle * Math.PI / 180) * distance * 1.5}px) 
                                  scale(0);
                        opacity: 0;
                    }
                }
            `;
            
            // Add keyframes to document
            if (!document.getElementById(`catalog-particle-style-${i}`)) {
                const style = document.createElement('style');
                style.id = `catalog-particle-style-${i}`;
                style.textContent = keyframes;
                document.head.appendChild(style);
            }
            
            button.appendChild(particle);
        }
        
        // Clean up particles after animation
        setTimeout(() => {
            const particles = button.querySelectorAll('[style*="catalogParticle"]');
            particles.forEach(particle => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            });
        }, 1000);
    }

    // Cart state management functions
    async checkCartStateOnLoad() {
        try {
            const cartData = await window.simpleCartManager.getCart();
            if (cartData && cartData.items && cartData.items.length > 0) {
                this.updateAllCartButtonStates(cartData.items);
            }
        } catch (error) {
            console.error('Error checking cart state:', error);
        }
    }

    updateAllCartButtonStates(cartItems) {
        const cartItemIds = cartItems.map(item => parseInt(item.id));
        
        // Find all add to cart buttons
        const addToCartButtons = document.querySelectorAll('.btn-add-cart-full');
        
        addToCartButtons.forEach(button => {
            const bikeId = button.getAttribute('data-bike-id') || 
                          button.getAttribute('onclick')?.match(/addToCart\((\d+)\)/)?.[1];
            
            if (bikeId && cartItemIds.includes(parseInt(bikeId))) {
                this.setInCartState(button);
            }
        });
    }

    setInCartState(button) {
        if (!button) return;
        
        button.classList.add('in-cart');
        button.style.background = '#28a745';
        button.innerHTML = `
            <i class="fas fa-shopping-cart"></i>
            Перейти в корзину
        `;
        
        // Update click handler
        button.onclick = (e) => {
            e.stopPropagation();
            window.location.href = 'cart.html';
        };
    }

    resetCartButton(button) {
        if (!button) return;
        
        button.classList.remove('in-cart', 'cart-animating');
        button.style.background = '';
        button.style.transform = '';
        button.disabled = false;
        
        // Reset to original state
        button.innerHTML = `
            <i class="fas fa-shopping-cart"></i>
            Добавить в корзину
        `;
        
        // Reset click handler - will be set by the original bike card creation
        button.onclick = null;
    }

    showGuestOverlay() {
        const overlay = document.getElementById('guest-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            // Force reflow to ensure display change is applied
            overlay.offsetHeight;
            overlay.classList.add('show');
        }
    }

    quickView(bikeId) {
        // Convert bikeId to number for comparison
        const numericBikeId = parseInt(bikeId);
        const bike = this.bikes.find(b => b.id === numericBikeId);
        
        if (bike) {
            this.openBikeModal(bike);
        } else {
            console.error('Bike not found with id:', bikeId);
        }
    }

    openBikeModal(bike) {
        const modal = document.getElementById('bike-modal');
        const modalImage = document.getElementById('modal-bike-image');
        const modalTitle = document.getElementById('modal-bike-title');
        const modalPriceCurrent = document.getElementById('modal-price-current');
        const modalPriceOld = document.getElementById('modal-price-old');
        const modalStars = document.getElementById('modal-stars');
        const modalRatingCount = document.getElementById('modal-rating-count');
        const modalSavings = document.getElementById('modal-savings');
        const modalThumbnails = document.getElementById('modal-thumbnails');

        // Store current bike for navigation
        this.currentModalBike = bike;
        this.currentImageIndex = 0;

        // Generate images array
        this.modalImages = [bike.image, ...this.generateAdditionalImages(bike)];

        // Populate modal content
        modalImage.src = this.modalImages[0];
        modalImage.alt = bike.name;
        
        // Add click handler to open detailed product page in gallery mode
        this.setupModalImageClickHandler();
        modalTitle.textContent = bike.name;
        
        // Calculate total price with all additional costs
        const priceBreakdown = this.calculateFinalPrice(bike.price);
        modalPriceCurrent.textContent = `${Math.round(priceBreakdown.totalEur)}€`;
        
        if (bike.originalPrice && bike.originalPrice > bike.price) {
            const originalBreakdown = this.calculateFinalPrice(bike.originalPrice);
            modalPriceOld.textContent = `${Math.round(originalBreakdown.totalEur)}€`;
            modalPriceOld.style.display = 'inline';
            const savings = Math.round(((originalBreakdown.totalEur - priceBreakdown.totalEur) / originalBreakdown.totalEur) * 100);
            modalSavings.textContent = `Экономия ${savings}%`;
        } else {
            modalPriceOld.style.display = 'none';
            modalSavings.textContent = 'Итоговая цена с доставкой';
        }

        // Populate stars and rating
        const bikeRating = this.calculateBikeRating(bike);
        modalStars.innerHTML = this.generateStars(bikeRating);
        modalRatingCount.textContent = `Наша оценка: ${bikeRating.toFixed(1)}`;

        // Populate thumbnails
        modalThumbnails.innerHTML = '';
        this.modalImages.forEach((image, index) => {
            const thumbnail = document.createElement('img');
            thumbnail.src = image;
            thumbnail.className = `modal-thumbnail ${index === 0 ? 'active' : ''}`;
            thumbnail.addEventListener('click', () => this.selectModalImage(index));
            modalThumbnails.appendChild(thumbnail);
        });

        // Check cart state and update button
        this.updateModalCartButton(bike.id);
        
        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Setup modal event listeners
        this.setupModalEventListeners();
    }

    setupModalImageClickHandler() {
        const modalImage = document.getElementById('modal-bike-image');
        modalImage.style.cursor = 'pointer';
        modalImage.onclick = () => {
            this.closeBikeModal();
            this.goToProductDetail(this.currentModalBike.id);
        };
    }

    selectModalImage(index) {
        this.currentImageIndex = index;
        const modalImage = document.getElementById('modal-bike-image');
        const thumbnails = document.querySelectorAll('.modal-thumbnail');
        
        modalImage.src = this.modalImages[index];
        
        // Maintain click handler when image changes
        this.setupModalImageClickHandler();
        
        thumbnails.forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
    }

    navigateModalImage(direction) {
        const newIndex = direction === 'next' 
            ? (this.currentImageIndex + 1) % this.modalImages.length
            : (this.currentImageIndex - 1 + this.modalImages.length) % this.modalImages.length;
        
        this.selectModalImage(newIndex);
    }

    generateDetailedSpecs(bike) {
        const baseSpecs = [
            { label: 'Бренд', value: bike.brand },
            { label: 'Категория', value: bike.category },
            { label: 'Цена', value: `${bike.price}€` }
        ];

        // Add category-specific specs
        switch (bike.category) {
            case 'Горные':
                return [...baseSpecs,
                    { label: 'Подвеска', value: 'Полная' },
                    { label: 'Колеса', value: '29"' },
                    { label: 'Скорости', value: '21' },
                    { label: 'Материал рамы', value: 'Алюминий' },
                    { label: 'Тормоза', value: 'Дисковые гидравлические' }
                ];
            case 'Шоссейные':
                return [...baseSpecs,
                    { label: 'Колеса', value: '700c' },
                    { label: 'Скорости', value: '16' },
                    { label: 'Материал рамы', value: 'Карбон' },
                    { label: 'Тормоза', value: 'Дисковые' },
                    { label: 'Вес', value: '8.5 кг' }
                ];
            case 'Городские':
                return [...baseSpecs,
                    { label: 'Колеса', value: '26"' },
                    { label: 'Скорости', value: '7' },
                    { label: 'Материал рамы', value: 'Сталь' },
                    { label: 'Тормоза', value: 'V-brake' },
                    { label: 'Корзина', value: 'Включена' }
                ];
            case 'Электро':
                return [...baseSpecs,
                    { label: 'Мотор', value: '250W' },
                    { label: 'Батарея', value: '36V 10Ah' },
                    { label: 'Запас хода', value: '60 км' },
                    { label: 'Время зарядки', value: '4-6 часов' },
                    { label: 'Вес', value: '22 кг' }
                ];
            default:
                return baseSpecs;
        }
    }

    generateDescription(bike) {
        const descriptions = {
            'Горные': `Этот горный велосипед ${bike.brand} идеально подходит для экстремальных поездок по пересеченной местности. Прочная алюминиевая рама и надежная подвеска обеспечивают комфорт и безопасность на любых трассах.`,
            'Шоссейные': `Шоссейный велосипед ${bike.brand} создан для скорости и эффективности. Легкая карбоновая рама и аэродинамический дизайн позволяют развивать высокие скорости на асфальте.`,
            'Городские': `Городской велосипед ${bike.brand} - ваш надежный спутник для ежедневных поездок. Удобная посадка, практичные аксессуары и надежная конструкция делают его идеальным для городских условий.`,
            'Электро': `Электровелосипед ${bike.brand} сочетает в себе традиционную езду на велосипеде с современными технологиями. Мощный электромотор поможет преодолеть любые расстояния без усталости.`
        };
        
        return descriptions[bike.category] || `Качественный велосипед ${bike.brand} для активного отдыха и спорта.`;
    }

    closeBikeModal() {
        const modal = document.getElementById('bike-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    setupModalEventListeners() {
        const modal = document.getElementById('bike-modal');
        const closeBtn = document.getElementById('modal-close');
        const prevBtn = document.getElementById('modal-prev-img');
        const nextBtn = document.getElementById('modal-next-img');
        const addCartBtn = document.getElementById('modal-add-cart');
        const favoriteBtn = document.getElementById('modal-favorite');
        const moreInfoBtn = document.getElementById('modal-more-info');

        // Close modal on close button click
        closeBtn.addEventListener('click', () => {
            this.closeBikeModal();
        });

        // Close modal on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeBikeModal();
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.closeBikeModal();
            }
        });

        // Image navigation
        prevBtn.addEventListener('click', () => {
            this.navigateModalImage('prev');
        });

        nextBtn.addEventListener('click', () => {
            this.navigateModalImage('next');
        });

        // Add to cart
        addCartBtn.addEventListener('click', () => {
            if (this.currentModalBike) {
                this.addToCart(this.currentModalBike.id);
                // Don't close modal immediately to show animation
                // Modal will be closed when user clicks "Перейти в корзину" or manually closes it
            }
        });

        // Toggle favorite
        favoriteBtn.addEventListener('click', () => {
            if (this.currentModalBike) {
                this.toggleFavorite(this.currentModalBike.id);
                const icon = favoriteBtn.querySelector('i');
                icon.classList.toggle('far');
                icon.classList.toggle('fas');
            }
        });

        // More info button - navigate to product detail page
        moreInfoBtn.addEventListener('click', () => {
            if (this.currentModalBike) {
                this.goToProductDetail(this.currentModalBike.id);
            }
        });
    }

    goToProductDetail(bikeId) {
        // Navigate to product detail page with bike ID
        window.location.href = `product-detail.html?id=${bikeId}`;
    }

    // Brand filter functions
    toggleBrandList() {
        const brandContainer = document.getElementById('brand-list-container');
        const toggleBtn = document.querySelector('.brand-toggle-btn');
        
        if (brandContainer && toggleBtn) {
            const isExpanded = brandContainer.classList.contains('expanded');
            
            if (isExpanded) {
                brandContainer.classList.remove('expanded');
                toggleBtn.classList.remove('expanded');
            } else {
                brandContainer.classList.add('expanded');
                toggleBtn.classList.add('expanded');
            }
        }
    }

    initBrandSearch() {
        const searchInput = document.getElementById('brand-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterBrandList(e.target.value.toLowerCase());
            });
        }
    }

    filterBrandList(searchTerm) {
        const brandWrapper = document.querySelector('.brand-items-wrapper');
        const brandContainer = document.getElementById('brand-list-container');
        const expandArrow = document.querySelector('.brand-expand-arrow');
        
        if (!brandWrapper) return;
        
        const allItems = brandWrapper.children;
        let visibleCount = 0;
        
        Array.from(allItems).forEach(item => {
            if (item.classList.contains('filter-option')) {
                const label = item.querySelector('.filter-label');
                if (label) {
                    const brandName = label.textContent.toLowerCase();
                    const matches = brandName.includes(searchTerm);
                    item.style.display = matches ? 'flex' : 'none';
                    if (matches) visibleCount++;
                }
            }
        });
        
        // Hide expand arrow when searching
        if (expandArrow) {
            expandArrow.style.display = searchTerm ? 'none' : 'flex';
        }
        
        // Expand container when searching to show all results
        if (searchTerm && brandContainer) {
            brandContainer.classList.add('expanded');
        }
    }




    resetPriceFilter() {
        // Reset desktop price filter
        const priceFrom = document.getElementById('price-from');
        const priceTo = document.getElementById('price-to');
        const sliderMin = document.getElementById('price-slider-min');
        const sliderMax = document.getElementById('price-slider-max');
        
        if (priceFrom) priceFrom.value = '';
        if (priceTo) priceTo.value = '';
        if (sliderMin) sliderMin.value = sliderMin.min;
        if (sliderMax) sliderMax.value = sliderMax.max;
        
        // Reset mobile price filter
        const mobilePriceFrom = document.getElementById('mobile-price-from');
        const mobilePriceTo = document.getElementById('mobile-price-to');
        const mobileSliderMin = document.getElementById('mobile-price-slider-min');
        const mobileSliderMax = document.getElementById('mobile-price-slider-max');
        
        if (mobilePriceFrom) mobilePriceFrom.value = '';
        if (mobilePriceTo) mobilePriceTo.value = '';
        if (mobileSliderMin) mobileSliderMin.value = mobileSliderMin.min;
        if (mobileSliderMax) mobileSliderMax.value = mobileSliderMax.max;
        
        // Update visual elements
        this.updateSliderRange();
        this.updatePriceValues();
        this.updateMobilePriceValues();
        
        // Apply filters to update the bike list
        this.applyFilters();
    }



    // Show auth modal
    showAuthModal() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.add('show');
        }
    }

    // Update modal cart button state
    updateModalCartButton(productId) {
        if (!window.simpleCartManager) return;
        
        const isInCart = window.simpleCartManager.isInCart(productId);
        const addCartBtn = document.getElementById('modal-add-cart');
        
        if (!addCartBtn) return;
        
        if (isInCart) {
            // Устанавливаем состояние "В корзине"
            addCartBtn.classList.add('in-cart');
            addCartBtn.innerHTML = `
                <div class="btn-content">
                    <i class="fas fa-check-circle"></i>
                    <span class="btn-text">В корзине. Перейти в корзину</span>
                </div>
            `;
            
            // Заменяем обработчик клика
            addCartBtn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = 'cart.html';
            };
        } else {
            // Возвращаем исходное состояние
            addCartBtn.classList.remove('in-cart');
            addCartBtn.innerHTML = `
                <div class="btn-content">
                    <span class="btn-text">Добавить в корзину</span>
                    <i class="fas fa-check success-icon"></i>
                    <i class="fas fa-shopping-cart floating-cart"></i>
                </div>
                <div class="particles-container"></div>
                <div class="ripple-wave"></div>
                <div class="glow-effect"></div>
            `;
            
            // Восстанавливаем исходный обработчик
            addCartBtn.onclick = () => {
                if (this.currentModalBike) {
                    this.addToCart(this.currentModalBike.id);
                }
            };
        }
    }
}

// Global functions for HTML onclick handlers
function resetPriceFilter() {
    if (catalog) {
        catalog.resetPriceFilter();
    }
}

function toggleFilter(type, value) {
    catalog.toggleFilter(type, value);
}

function clearAllFilters() {
    catalog.clearAllFilters();
}

function sortBikes() {
    if (catalog) {
        catalog.sortBikes();
        catalog.renderBikes();
        catalog.renderPagination();
    }
}

function setView(view) {
    catalog.setView(view);
}

function setMobileView(view) {
    catalog.setMobileView(view);
}

function toggleMobileView() {
    catalog.toggleMobileView();
}

function toggleBrandList() {
    catalog.toggleBrandList();
}

// Guest overlay management functions
function closeGuestOverlay() {
    const overlay = document.getElementById('guest-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        // Wait for transition to complete before hiding
        setTimeout(() => {
            if (!overlay.classList.contains('show')) {
                overlay.style.display = 'none';
            }
        }, 300);
    }
}

function showOrderForm() {
    closeGuestOverlay();
    
    // Display selected product information
    if (selectedProductForApplication) {
        displaySelectedProductInfo(selectedProductForApplication);
    }
    
    const orderOverlay = document.getElementById('order-form-overlay');
    if (orderOverlay) {
        orderOverlay.style.display = 'flex';
        setTimeout(() => {
            orderOverlay.classList.add('show');
        }, 10);
    }
}

function displaySelectedProductInfo(bike) {
    const productInfoSection = document.getElementById('selected-product-info');
    const productImage = document.getElementById('product-image');
    const productName = document.getElementById('product-name');
    const productBrand = document.getElementById('product-brand');
    const productPrice = document.getElementById('product-price');
    const productSpecs = document.getElementById('product-specs');
    
    if (productInfoSection && bike) {
        // Set product image
        if (productImage && bike.images && bike.images.length > 0) {
            productImage.src = bike.images[0];
            productImage.alt = bike.name || 'Товар';
        }
        
        // Set product name
        if (productName) {
            productName.textContent = bike.name || 'Название не указано';
        }
        
        // Set product brand
        if (productBrand) {
            productBrand.textContent = bike.brand || 'Бренд не указан';
        }
        
        // Set product price
        if (productPrice) {
            const finalPrice = catalog.calculateFinalPrice(bike.price);
            productPrice.textContent = `${finalPrice.toLocaleString()} ₽`;
        }
        
        // Set product specs
        if (productSpecs) {
            const specs = [];
            if (bike.type) specs.push(`Тип: ${bike.type}`);
            if (bike.frame_material) specs.push(`Рама: ${bike.frame_material}`);
            if (bike.wheel_size) specs.push(`Колеса: ${bike.wheel_size}"`);
            if (bike.gears) specs.push(`Скорости: ${bike.gears}`);
            
            productSpecs.textContent = specs.join(' • ');
        }
        
        // Show the product info section
        productInfoSection.style.display = 'block';
    }
}

function closeOrderForm() {
    const orderOverlay = document.getElementById('order-form-overlay');
    if (orderOverlay) {
        orderOverlay.classList.remove('show');
        setTimeout(() => {
            if (!orderOverlay.classList.contains('show')) {
                orderOverlay.style.display = 'none';
            }
        }, 300);
    }
}

function redirectToLogin() {
    closeGuestOverlay();
    // Show existing login modal
    if (typeof showLoginModal === 'function') {
        showLoginModal();
    } else if (window.authManager && typeof window.authManager.showLoginModal === 'function') {
        window.authManager.showLoginModal();
    } else {
        // Fallback: try to show modal directly
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.style.display = 'flex';
            loginModal.classList.add('show');
        }
    }
}

function showMoreInfo() {
    closeGuestOverlay();
    // Show more information about the service
    alert('Здесь будет подробная информация о сервисе и процессе заказа');
}

async function submitOrderForm(event) {
    event.preventDefault();
    
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    try {
        // Show loading state
        submitButton.textContent = 'Создаем заявку...';
        submitButton.disabled = true;
        
        // Debug logging
        console.log('submitOrderForm: Starting form submission');
        console.log('submitOrderForm: window.crmApi =', window.crmApi);
        console.log('submitOrderForm: selectedProductForApplication =', selectedProductForApplication);
        console.log('submitOrderForm: typeof initializeCRM =', typeof initializeCRM);
        
        // Check if CRM API is initialized
        if (!window.crmApi) {
            console.error('CRM API не инициализирован, попытка повторной инициализации...');
            // Try to reinitialize
            if (typeof initializeCRM === 'function') {
                initializeCRM();
                console.log('submitOrderForm: После повторной инициализации window.crmApi =', window.crmApi);
            }
            
            if (!window.crmApi) {
                throw new Error('CRM API не инициализирован');
            }
        }
        
        // Check if product is selected
        if (!selectedProductForApplication) {
            throw new Error('Товар не выбран');
        }
        
        const formData = new FormData(event.target);
        
        // Prepare application data - simplified to match database schema
        const applicationData = {
            customer_name: formData.get('customerName'),
            contact_method: formData.get('contactMethod'),
            status: 'Новая',
            source: 'Каталог сайта'
        };
        
        console.log('Creating application with data:', applicationData);
        
        // Create application through CRM API
        const result = await window.crmApi.createApplication(applicationData);
        
        console.log('Application created successfully:', result);
        
        // Close form
        closeOrderForm();
        
        // Show success overlay with application number
        showSuccessOverlay(result.application_number);
        
        // Reset form and clear selected product
        event.target.reset();
        selectedProductForApplication = null;
        
    } catch (error) {
        console.error('Error creating application:', error);
        alert('Произошла ошибка при создании заявки. Пожалуйста, попробуйте еще раз или свяжитесь с нами напрямую.');
    } finally {
        // Restore button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Close overlay when clicking outside
document.addEventListener('click', function(e) {
    const overlay = document.getElementById('guest-overlay');
    const orderOverlay = document.getElementById('order-form-overlay');
    const notification = document.querySelector('.guest-notification');
    
    if (overlay && overlay.classList.contains('show')) {
        if (e.target === overlay && !notification.contains(e.target)) {
            closeGuestOverlay();
        }
    }
    
    if (orderOverlay && orderOverlay.classList.contains('show')) {
        const orderNotification = orderOverlay.querySelector('.guest-notification');
        if (e.target === orderOverlay && orderNotification && !orderNotification.contains(e.target)) {
            closeOrderForm();
        }
    }
});

// Global variables for CRM integration
let selectedProductForApplication = null;

// CRM API will be initialized using the global initializeCRM function from crm-api.js

// Initialize catalog when DOM is loaded
let catalog;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded: Starting initialization');
    
    // Initialize simple cart manager
    window.simpleCartManager = new SimpleCartManager();
    console.log('DOMContentLoaded: SimpleCartManager initialized');
    
    // Initialize favorites manager
    if (typeof FavoritesManager !== 'undefined') {
        window.favoritesManager = new FavoritesManager();
        console.log('DOMContentLoaded: FavoritesManager initialized');
    }
    
    // Create catalog instance and make it globally available
    catalog = new BikesCatalog();
    window.catalog = catalog;
    catalog.init();
    console.log('DOMContentLoaded: BikesCatalog initialized');
    
    // Initialize CRM API
    console.log('DOMContentLoaded: typeof initializeCRM =', typeof initializeCRM);
    console.log('DOMContentLoaded: crmApi before init =', crmApi);
    
    if (typeof initializeCRM === 'function') {
        initializeCRM();
        console.log('DOMContentLoaded: CRM API initialized, crmApi =', crmApi);
    } else {
        console.error('DOMContentLoaded: initializeCRM function not found!');
    }
});

// Success overlay functions
function showSuccessOverlay(orderNumber) {
    const overlay = document.getElementById('success-overlay');
    const orderNumberDisplay = document.getElementById('order-number-display');
    
    if (overlay && orderNumberDisplay) {
        orderNumberDisplay.textContent = orderNumber;
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeSuccessOverlay() {
    const overlay = document.getElementById('success-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function goToTracking() {
    // Redirect to order tracking page
    window.location.href = 'order-tracking.html';
}

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BikesCatalog;
}