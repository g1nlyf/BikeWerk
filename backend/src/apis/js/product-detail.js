class ProductDetailPage {
    constructor() {
        this.currentProduct = null;
        this.currentImageIndex = 0;
        this.productImages = [];
        this.ratingSystem = new BikeRatingSystem();
        this.productRating = null;
        
        // Price calculation rates (same as in catalog.js)
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

    async init() {
        try { await this.refreshRates(); } catch {}
        this.loadProductFromURL();
        this.setupEventListeners();
        this.setupTabs();
        
        // Initialize FavoritesManager if available
        if (window.favoritesManager) {
            await window.favoritesManager.init();
            this.updateFavoriteButtonState();
        }
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

    updateFavoriteButtonState() {
        if (!window.favoritesManager || !this.currentProduct) return;
        
        const btn = document.getElementById('favorite-btn');
        const icon = btn?.querySelector('i');
        
        if (btn && icon) {
            const isFavorite = window.favoritesManager.isFavorite(this.currentProduct.id);
            btn.classList.toggle('active', isFavorite);
            
            if (isFavorite) {
                icon.classList.remove('far');
                icon.classList.add('fas');
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
            }
        }
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

    loadProductFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        
        if (productId) {
            this.loadProduct(productId);
        } else {
            // Redirect to catalog if no product ID
            window.location.href = 'catalog.html';
        }
    }

    async loadProduct(productId) {
        try {
            // Wait for API client to be available
            let attempts = 0;
            while (!window.apiClient && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.apiClient) {
                console.error('API client not available');
                window.location.href = 'catalog.html';
                return;
            }
            
            console.log('API client available, requesting product:', productId);
            
            // Get product from API
            try {
                const response = await window.apiClient.getBike(productId);
                console.log('API Response:', response);
                const product = response.bike;
                console.log('Product data:', product);
                
                if (!product) {
                    console.error('Product not found:', productId);
                    window.location.href = 'catalog.html';
                    return;
                }

                this.currentProduct = product;
                this.generateProductImages();
                this.renderProduct();
                
                // Check cart state after product is loaded
                this.checkCartStateOnLoad();
                
                console.log(`📄 Загружена страница товара: ${product.name} (ID: ${productId})`);
            } catch (error) {
                console.error('Error fetching product:', error);
                window.location.href = 'catalog.html';
                return;
            }
        } catch (error) {
            console.error('Error loading product:', error);
            window.location.href = 'catalog.html';
        }
    }

    generateProductImages() {
        // Use images array from database if available, otherwise fallback to single image
        if (this.currentProduct.images && this.currentProduct.images.length > 0) {
            this.productImages = this.currentProduct.images;
        } else {
            // Fallback to single image if images array is not available
            const baseImage = this.currentProduct.image;
            this.productImages = [baseImage];
        }
    }

    renderProduct() {
        if (!this.currentProduct) return;

        // Update page title
        document.title = `${this.currentProduct.name} - EUBike`;

        // Update product info
        document.getElementById('product-badge').textContent = this.currentProduct.badge || 'HIT';
        document.getElementById('product-title').textContent = this.currentProduct.name;

        // Calculate and update rating
        this.productRating = this.ratingSystem.calculateOverallRating(this.currentProduct);
        this.renderStars('product-stars', this.productRating.overallStars);
        document.getElementById('rating-score').textContent = this.productRating.overall.toFixed(1);
        
        // Setup rating expand functionality
        this.setupRatingExpand();

        // Update price
        document.getElementById('price-current').textContent = `${this.currentProduct.price.toLocaleString()} ₽`;
        if (this.currentProduct.oldPrice) {
            document.getElementById('price-old').textContent = `${this.currentProduct.oldPrice.toLocaleString()} ₽`;
            const savings = this.currentProduct.oldPrice - this.currentProduct.price;
            document.getElementById('price-savings').textContent = `Экономия ${savings.toLocaleString()} ₽`;
        } else {
            document.getElementById('price-old').style.display = 'none';
            document.getElementById('price-savings').style.display = 'none';
        }

        // Update images
        this.renderImages();

        // Update specs preview
        this.renderSpecsPreview();

        // Update description
        this.renderDescription();

        // Update full specifications
        this.renderFullSpecifications();

        // Update reviews
        this.renderReviews();

        // Load related products
        this.loadRelatedProducts();

        // Initialize product calculator with full logic
         setTimeout(() => {
             if (window.initProductCalculator && this.currentProduct) {
                 window.initProductCalculator(this.currentProduct);
             }
         }, 100);

        // Update favorite button state
        this.updateFavoriteButtonState();
    }

    renderImages() {
        // Update mobile version
        const mobileMainImage = document.getElementById('mobile-main-image');
        if (mobileMainImage) {
            mobileMainImage.src = this.productImages[this.currentImageIndex];
            mobileMainImage.alt = this.currentProduct.name;
        }

        // Update desktop version
        const desktopMainImage = document.getElementById('main-product-image');
        if (desktopMainImage) {
            desktopMainImage.src = this.productImages[this.currentImageIndex];
            desktopMainImage.alt = this.currentProduct.name;
        }

        // Generate thumbnails for desktop
        this.generateThumbnails();

        // Update photo counter
        this.updatePhotoCounter();
    }

    generateThumbnails() {
        const thumbnailsContainer = document.getElementById('product-thumbnails');
        if (!thumbnailsContainer) return;

        thumbnailsContainer.innerHTML = '';

        this.productImages.forEach((imageSrc, index) => {
            const thumbnail = document.createElement('img');
            thumbnail.src = imageSrc;
            thumbnail.alt = `${this.currentProduct.name} - Image ${index + 1}`;
            thumbnail.className = `thumbnail ${index === this.currentImageIndex ? 'active' : ''}`;
            thumbnail.addEventListener('click', () => this.selectImage(index));
            thumbnailsContainer.appendChild(thumbnail);
        });
    }

    selectImage(index) {
        this.currentImageIndex = index;
        this.renderImages();
    }

    navigateImage(direction) {
        if (direction === 'next') {
            this.currentImageIndex = (this.currentImageIndex + 1) % this.productImages.length;
        } else {
            this.currentImageIndex = this.currentImageIndex === 0 
                ? this.productImages.length - 1 
                : this.currentImageIndex - 1;
        }
        this.renderImages();
        this.updatePhotoCounter();
    }

    updatePhotoCounter() {
        const mobileCounter = document.getElementById('mobile-photo-counter');
        if (mobileCounter) {
            mobileCounter.textContent = `${this.currentImageIndex + 1}/${this.productImages.length}`;
        }
    }

    renderStars(containerId, rating) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.className = i <= rating ? 'fas fa-star star' : 'far fa-star star';
            container.appendChild(star);
        }
    }

    renderSpecsPreview() {
        const container = document.getElementById('specs-preview');
        const specs = this.getProductSpecs();
        
        container.innerHTML = '';
        
        // Show only first 4 specs in preview
        const previewSpecs = Object.entries(specs).slice(0, 4);
        
        previewSpecs.forEach(([key, value]) => {
            const specItem = document.createElement('div');
            specItem.className = 'spec-item';
            specItem.innerHTML = `
                <span class="spec-label">${key}:</span>
                <span class="spec-value">${value}</span>
            `;
            container.appendChild(specItem);
        });
    }

    renderDescription() {
        const container = document.getElementById('product-description');
        const description = this.currentProduct.description || this.generateDescription();
        
        let content = `
            <div style="line-height: 1.6; color: #555;">
                <p>${description}</p>
        `;
        
        // Добавляем техническую сводку от Gemini, если она есть
        if (this.currentProduct.technicalSummary && this.currentProduct.technicalSummary !== 'Недостаточно информации для технической оценки') {
            content += `
                <h3 style="margin-top: 30px; margin-bottom: 15px; color: #333;">Техническая оценка состояния:</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff;">
                    <p style="margin: 0; font-style: italic;">${this.currentProduct.technicalSummary}</p>
                    ${this.currentProduct.conditionRating ? `
                        <div style="margin-top: 10px; font-weight: bold; color: #007bff;">
                            Оценка состояния: ${this.currentProduct.conditionRating}/10
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        content += `
                <h3 style="margin-top: 30px; margin-bottom: 15px; color: #333;">Особенности:</h3>
                <ul style="padding-left: 20px;">
                    <li>Высокое качество материалов</li>
                    <li>Современный дизайн</li>
                    <li>Простота в использовании</li>
                    <li>Долговечность и надежность</li>
                    <li>Гарантия производителя</li>
                </ul>
            </div>
        `;
        
        container.innerHTML = content;
    }

    renderFullSpecifications() {
        const container = document.getElementById('product-specifications');
        const specs = this.getProductSpecs();
        
        container.innerHTML = '';
        
        Object.entries(specs).forEach(([key, value]) => {
            const specItem = document.createElement('div');
            specItem.className = 'spec-item';
            specItem.innerHTML = `
                <span class="spec-label">${key}:</span>
                <span class="spec-value">${value}</span>
            `;
            container.appendChild(specItem);
        });
    }

    getProductSpecs() {
        // Generate specifications based on product data
        const baseSpecs = {
            'Артикул': `27720${this.currentProduct.id}50`,
            'Модель': this.currentProduct.name,
            'Гарантийный срок': '1 год',
            'Цвет': 'серебро'
        };

        // Добавляем год выпуска, если он был извлечен Gemini
        if (this.currentProduct.year && this.currentProduct.year !== null) {
            baseSpecs['Год выпуска'] = this.currentProduct.year;
        }

        // Add category-specific specs
        if (this.currentProduct.category === 'electric') {
            return {
                ...baseSpecs,
                'Время работы от аккумулятора': '30 дней',
                'Питание': 'от аккумулятора',
                'Время зарядки аккумулятора': '180 мин',
                'Беспроводные интерфейсы': 'Bluetooth',
                'Количество режимов работы': '3 режима',
                'Количество насадок': '2 шт.',
                'Тип зубной щетки': 'ультразвуковая',
                'Форма чистящей головки': 'овальная',
                'Жесткость щетины': 'средняя',
                'Движение головки': 'пульсирующее',
                'Доп. опции электрической зубной щетки': 'влагозащитный корпус; дисплей; датчик определения зоны чистки',
                'Страна производства': 'Китай'
            };
        }

        return {
            ...baseSpecs,
            'Материал рамы': 'Алюминий',
            'Размер колес': '26 дюймов',
            'Количество скоростей': '21',
            'Тип тормозов': 'Дисковые',
            'Вес': '15 кг',
            'Максимальная нагрузка': '120 кг'
        };
    }

    generateDescription() {
        return `${this.currentProduct.name} - это высококачественный продукт, который сочетает в себе современные технологии и надежность. Идеально подходит для ежедневного использования и обеспечивает отличные результаты. Продукт изготовлен из качественных материалов и имеет стильный дизайн.`;
    }

    renderReviews() {
        const container = document.getElementById('reviews-list');
        const reviewsStars = document.getElementById('reviews-stars');
        const reviewsCount = document.getElementById('reviews-count');

        // Update reviews header
        this.renderStars('reviews-stars', this.currentProduct.rating);
        reviewsCount.textContent = `${this.currentProduct.reviews || 295} отзывов`;

        // Generate sample reviews
        const sampleReviews = [
            {
                name: 'Наталия',
                date: '17 октября',
                rating: 5,
                text: 'Достоинства: Щетка очень качественная. У нас их две и мужа. Всем довольны. Хорошо чистит зубы. Плюсов много достойный футляр с возможностью зарядить щетку'
            },
            {
                name: 'Елена',
                date: '15 октября',
                rating: 5,
                text: 'Достоинства: Красивая щетка, красивый дизайн! Прекрасное изобретение! Плюсов товара удобно пользоваться +2'
            },
            {
                name: 'Мария',
                date: '12 октября',
                rating: 4,
                text: 'Достоинства: Смена насадок, удобно лежит в руке. Хорошо чистит зубы, приятная вибрация, отличная щетка, хорошо чистит, но брак. Комментарий: Не всегда с первого раза включается, что брак'
            }
        ];

        container.innerHTML = '';
        sampleReviews.forEach(review => {
            const reviewElement = document.createElement('div');
            reviewElement.className = 'review-item';
            reviewElement.innerHTML = `
                <div class="review-header">
                    <div>
                        <div class="reviewer-name">${review.name}</div>
                        <div class="stars">
                            ${Array(5).fill(0).map((_, i) => 
                                `<i class="${i < review.rating ? 'fas' : 'far'} fa-star star"></i>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="review-date">${review.date}</div>
                </div>
                <div class="review-text">${review.text}</div>
            `;
            container.appendChild(reviewElement);
        });
    }

    async loadRelatedProducts() {
        const container = document.getElementById('related-products-grid');
        
        try {
            // Get related products from API (exclude current product)
            const response = await window.apiClient.getBikes({ limit: 7 });
            const allProducts = response.bikes || [];
            const relatedProducts = allProducts
                .filter(bike => bike.id !== this.currentProduct.id)
                .slice(0, 6);

            container.innerHTML = '';
            relatedProducts.forEach(product => {
                const productElement = document.createElement('div');
                productElement.className = 'related-item';
                productElement.innerHTML = `
                    <div class="related-image-container">
                        <img src="${product.main_image || product.image}" alt="${product.name}">
                        <button class="related-favorite" onclick="this.parentElement.parentElement.toggleFavorite(event, ${product.id})">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                    <div class="related-info">
                        <div class="related-name">${product.name}</div>
                        <div class="related-price">${product.price.toLocaleString()} ₽</div>
                    </div>
                `;
                
                // Add click handler for the main card (excluding favorite button)
                productElement.addEventListener('click', (e) => {
                    if (!e.target.closest('.related-favorite')) {
                        window.location.href = `product-detail.html?id=${product.id}`;
                    }
                });
                
                // Add favorite toggle method to the element
                productElement.toggleFavorite = (event, productId) => {
                    event.stopPropagation();
                    const button = event.currentTarget;
                    const icon = button.querySelector('i');
                    
                    // Create ripple effect
                    this.createFavoriteRipple(button);
                    
                    // Toggle active state
                    button.classList.toggle('active');
                    icon.classList.toggle('far');
                    icon.classList.toggle('fas');
                    
                    const isActive = button.classList.contains('active');
                    
                    // Add pulse animation
                    button.style.animation = 'favoritePulse 0.4s ease-in-out';
                    setTimeout(() => {
                        button.style.animation = '';
                    }, 400);
                    
                    // Create particle effect when adding to favorites
                    if (isActive) {
                        this.createFavoriteParticles(button);
                    }
                    
                    this.showNotification(
                        isActive ? 'Добавлено в избранное!' : 'Удалено из избранного!',
                        'info'
                    );
                };
                
                container.appendChild(productElement);
            });
        } catch (error) {
            console.error('Error loading related products:', error);
            container.innerHTML = '<p>Не удалось загрузить похожие товары</p>';
        }
    }

    setupRatingExpand() {
        const expandBtn = document.getElementById('rating-expand-btn');
        const analyticsSection = document.getElementById('rating-analytics');
        
        if (expandBtn && analyticsSection) {
            expandBtn.addEventListener('click', () => {
                const isExpanded = analyticsSection.classList.contains('visible');
                
                if (!isExpanded) {
                    // Show analytics section
                    analyticsSection.classList.add('visible');
                    expandBtn.classList.add('expanded');
                    expandBtn.innerHTML = '<i class="fas fa-chevron-up"></i> свернуть';
                    
                    // Populate analytics data
                    this.populateAnalytics();
                    
                    // Auto-scroll to analytics section
                    setTimeout(() => {
                        analyticsSection.scrollIntoView({ 
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }, 100);
                } else {
                    // Hide analytics section
                    analyticsSection.classList.remove('visible');
                    expandBtn.classList.remove('expanded');
                    expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i> развернуть';
                }
            });
        }
        
        // Setup analytics item toggles
        this.setupAnalyticsToggles();
    }

    populateAnalytics() {
        if (!this.productRating) return;
        
        const criteria = ['age', 'condition', 'seller', 'priceQuality', 'savings'];
        
        criteria.forEach(criterion => {
            const rating = this.productRating.criteria[criterion];
            
            // Update stars
            const starsContainer = document.getElementById(`${criterion}-stars`);
            if (starsContainer) {
                starsContainer.innerHTML = this.generateStarsHTML(rating, false);
            }
            
            // Update score
            const scoreElement = document.getElementById(`${criterion}-score`);
            if (scoreElement) {
                scoreElement.textContent = `${rating}/10`;
            }
        });
        
        // Update overall rating
        const overallStars = document.getElementById('overall-stars');
        if (overallStars) {
            overallStars.innerHTML = this.generateStarsHTML(this.productRating.overall, false);
        }
        
        const overallScore = document.getElementById('overall-score');
        if (overallScore) {
            overallScore.textContent = `${this.productRating.overall.toFixed(1)}/10`;
        }
        
        const overallExplanation = document.getElementById('overall-explanation');
        if (overallExplanation) {
            overallExplanation.textContent = this.generateOverallExplanation();
        }
    }

    generateStarsHTML(rating, showNumber = true) {
        const stars = Math.round(rating / 2); // Convert 10-point to 5-star
        let html = '';
        
        for (let i = 1; i <= 5; i++) {
            html += `<i class="${i <= stars ? 'fas' : 'far'} fa-star"></i>`;
        }
        
        return html;
    }

    generateOverallExplanation() {
        const score = this.productRating.overall;
        
        if (score >= 9) {
            return 'Превосходное предложение! Этот байк получил высшие оценки по всем критериям. Настоятельно рекомендуем к покупке.';
        } else if (score >= 8) {
            return 'Отличное предложение с высоким качеством и выгодной ценой. Рекомендуем к покупке.';
        } else if (score >= 7) {
            return 'Хорошее предложение с достойными характеристиками. Стоит рассмотреть для покупки.';
        } else if (score >= 6) {
            return 'Приемлемое предложение, но есть некоторые моменты, требующие внимания.';
        } else if (score >= 5) {
            return 'Средний вариант. Рекомендуем внимательно изучить все детали перед покупкой.';
        } else {
            return 'Предложение требует осторожности. Внимательно изучите все аспекты перед принятием решения.';
        }
    }

    setupAnalyticsToggles() {
        const analyticsItems = document.querySelectorAll('.analytics-item');
        
        analyticsItems.forEach(item => {
            const header = item.querySelector('.analytics-header');
            const toggle = item.querySelector('.analytics-toggle');
            
            if (header && toggle) {
                header.addEventListener('click', () => {
                    const isExpanded = item.classList.contains('expanded');
                    
                    if (isExpanded) {
                        item.classList.remove('expanded');
                    } else {
                        item.classList.add('expanded');
                    }
                });
            }
        });
    }

    setupEventListeners() {
        // Mobile image navigation
        const mobileNextBtn = document.getElementById('mobile-next-image');
        const mobilePrevBtn = document.getElementById('mobile-prev-image');
        
        if (mobileNextBtn) {
            mobileNextBtn.addEventListener('click', () => {
                this.navigateImage('next');
            });
        }

        if (mobilePrevBtn) {
            mobilePrevBtn.addEventListener('click', () => {
                this.navigateImage('prev');
            });
        }

        // Desktop image navigation
        const desktopNextBtn = document.getElementById('next-image');
        const desktopPrevBtn = document.getElementById('prev-image');
        
        if (desktopNextBtn) {
            desktopNextBtn.addEventListener('click', () => {
                this.navigateImage('next');
            });
        }

        if (desktopPrevBtn) {
            desktopPrevBtn.addEventListener('click', () => {
                this.navigateImage('prev');
            });
        }

        // Mobile main image click for fullscreen
        const mobileMainImage = document.getElementById('mobile-main-image');
        if (mobileMainImage) {
            mobileMainImage.addEventListener('click', () => {
                this.openFullscreen();
            });
        }

        // Desktop main image click for fullscreen
        const desktopMainImage = document.getElementById('main-product-image');
        if (desktopMainImage) {
            desktopMainImage.addEventListener('click', () => {
                this.openFullscreen();
            });
        }

        // Mobile overlay buttons
        const mobileBackBtn = document.getElementById('mobile-back-btn');
        if (mobileBackBtn) {
            mobileBackBtn.addEventListener('click', () => {
                window.history.back();
            });
        }

        // Mobile overlay favorite button
        const mobileOverlayFavoriteBtn = document.getElementById('mobile-overlay-favorite-btn');
        if (mobileOverlayFavoriteBtn) {
            mobileOverlayFavoriteBtn.addEventListener('click', () => {
                this.toggleFavorite();
            });
        }

        // Mobile overlay share button
        const mobileOverlayShareBtn = document.getElementById('mobile-overlay-share-btn');
        if (mobileOverlayShareBtn) {
            mobileOverlayShareBtn.addEventListener('click', () => {
                this.shareProduct();
            });
        }

        // Add to cart
        document.getElementById('add-to-cart-btn').addEventListener('click', () => {
            this.addToCart();
        });

        // Buy now
        document.getElementById('buy-now-btn').addEventListener('click', () => {
            this.buyNow();
        });

        // Favorite toggle
        document.getElementById('favorite-btn').addEventListener('click', () => {
            this.toggleFavorite();
        });

        // Compare
        document.getElementById('compare-btn').addEventListener('click', () => {
            this.addToCompare();
        });

        // Share
        document.getElementById('share-btn').addEventListener('click', () => {
            this.shareProduct();
        });

        // Calculations toggle
        document.getElementById('calculations-btn').addEventListener('click', () => {
            this.toggleCalculations();
        });

        // Mobile bottom actions
        document.getElementById('mobile-add-to-cart').addEventListener('click', () => {
            this.addToCart();
        });

        document.getElementById('mobile-add-to-favorite').addEventListener('click', () => {
            this.toggleFavorite();
        });

        // Fullscreen modal events
        document.getElementById('fullscreen-close').addEventListener('click', () => {
            this.closeFullscreen();
        });

        document.getElementById('fullscreen-prev').addEventListener('click', () => {
            this.navigateFullscreen('prev');
        });

        document.getElementById('fullscreen-next').addEventListener('click', () => {
            this.navigateFullscreen('next');
        });

        // Close fullscreen on background click
        document.getElementById('fullscreen-modal').addEventListener('click', (e) => {
            if (e.target.id === 'fullscreen-modal') {
                this.closeFullscreen();
            }
        });

        // Close fullscreen on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeFullscreen();
            }
        });

        // Specifications modal
        document.getElementById('specs-tab-btn').addEventListener('click', () => {
            this.openSpecsModal();
        });

        document.getElementById('specs-modal-close').addEventListener('click', () => {
            this.closeSpecsModal();
        });

        document.getElementById('specs-modal').addEventListener('click', (e) => {
            if (e.target.id === 'specs-modal') {
                this.closeSpecsModal();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.navigateImage('prev');
            } else if (e.key === 'ArrowRight') {
                this.navigateImage('next');
            } else if (e.key === 'Escape') {
                this.closeSpecsModal();
            }
        });

        // Listen for cart item removal events
        window.addEventListener('cartItemRemoved', (e) => {
            const removedProductId = e.detail.productId;
            const currentProductId = this.currentProduct?.id;
            
            // If the removed item is the current product, reset the button
            if (removedProductId == currentProductId) {
                const addToCartBtn = document.getElementById('add-to-cart-btn');
                const mobileAddToCartBtn = document.getElementById('mobile-add-to-cart');
                
                if (addToCartBtn) {
                    this.resetCartButton(addToCartBtn);
                }
                if (mobileAddToCartBtn) {
                    this.resetCartButton(mobileAddToCartBtn);
                }
            }
        });
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Handle specs tab specially
                if (tabId === 'specs') {
                    this.openSpecsModal();
                    return;
                }

                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
    }

    addToCart() {
        if (!this.currentProduct) return;

        // Check if user is logged in first
        if (window.simpleCartManager && !window.simpleCartManager.isUserLoggedIn()) {
            // Show guest overlay instead of notification
            this.showGuestOverlay();
            return;
        }

        // Calculate final price for the product
        const priceData = this.calculateFinalPrice(this.currentProduct.price);
        
        // Prepare product data for cart
        const productData = {
            id: this.currentProduct.id,
            name: this.currentProduct.name,
            brand: this.currentProduct.brand,
            price: Math.round(priceData.totalRub),
            image: this.currentProduct.images && this.currentProduct.images.length > 0 ? this.currentProduct.images[0] : 'src/images/placeholder-bike.jpg',
            type: this.currentProduct.type,
            size: this.currentProduct.size,
            color: this.currentProduct.color,
            originalPrice: this.currentProduct.price,
            priceEur: Math.round(priceData.totalEur)
        };

        // Get all cart buttons for this product
        const buttons = document.querySelectorAll('#add-to-cart-btn, #mobile-add-to-cart');
        
        // Use the global simple cart manager to add the item
        if (window.simpleCartManager) {
            // Animate buttons
            buttons.forEach(button => {
                this.animateCartButton(button, this.currentProduct);
            });

            // Add to cart through simple cart manager
            window.simpleCartManager.addToCart(productData).catch(error => {
                console.error('Error adding to cart:', error);
            });
        } else {
            console.error('Simple cart manager not available');
        }
    }

    animateCartButton(button, product) {
        if (!button) return;

        // Disable button to prevent multiple clicks
        button.disabled = true;
        
        // Start the wow animation sequence
        this.startWowCartAnimation(button);
    }

    startWowCartAnimation(button) {
        const iconEl = button.querySelector('.btn-icon');
        const textElement = button.querySelector('.btn-text');

        // Phase 1: kickoff with advanced visuals
        button.classList.add('wow-start', 'morphing');
        
        // Prepare gradient sweep background
        button.style.backgroundImage = 'linear-gradient(135deg, #2c5aa0 0%, #28a745 100%)';
        button.style.backgroundSize = '200% 200%';
        button.style.backgroundPosition = '0% 50%';

        // Subtle ripple wave
        this.createRippleWave(button);

        // Icon slide/spin
        if (iconEl) {
            iconEl.classList.add('animate');
        }
        
        setTimeout(() => {
            // Phase 2: success state
            button.classList.remove('morphing');
            button.classList.add('in-cart');
            
            if (textElement) {
                textElement.textContent = 'В корзине';
            }
            
            // Checkmark reveal via CSS class
            this.showSuccessCheckmark(button);
            
            // Confetti burst
            this.createConfettiBurst(button);
            
            setTimeout(() => {
                    // Phase 3: CTA to go to cart - permanent state
                    if (textElement) {
                        textElement.textContent = 'Перейти в корзину';
                    }
                    
                    button.disabled = false;
                    
                    const goToCartHandler = (e) => {
                        e.preventDefault();
                        window.location.href = 'cart.html';
                    };
                    
                    // Remove old add to cart handler and add new go to cart handler
                    button.removeEventListener('click', this.addToCart.bind(this));
                    button.addEventListener('click', goToCartHandler);
                    
                    // No auto-reset - button stays in "В корзине" state permanently
                }, 1500);
        }, 1200);
    }

    createParticleExplosion(button) {
        const particlesContainer = button.querySelector('.particles-container');
        if (!particlesContainer) return;
        
        // Clear existing particles
        particlesContainer.innerHTML = '';
        
        // Create 12 particles
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Random position and animation
            const angle = (i / 12) * 360;
            const distance = 50 + Math.random() * 30;
            
            particle.style.cssText = `
                position: absolute;
                width: 6px;
                height: 6px;
                background: #28a745;
                border-radius: 50%;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                animation: particleExplode${i} 0.8s ease-out forwards;
                z-index: 10;
            `;
            
            // Create unique keyframe for each particle
            const keyframes = `
                @keyframes particleExplode${i} {
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
            if (!document.getElementById(`particle-style-${i}`)) {
                const style = document.createElement('style');
                style.id = `particle-style-${i}`;
                style.textContent = keyframes;
                document.head.appendChild(style);
            }
            
            particlesContainer.appendChild(particle);
        }
        
        // Clean up particles after animation
        setTimeout(() => {
            particlesContainer.innerHTML = '';
        }, 1000);
    }

    createRippleWave(button) {
        const rippleWave = button.querySelector('.ripple-wave');
        if (!rippleWave) return;
        
        rippleWave.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(40, 167, 69, 0.2);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: rippleWave 0.6s ease-out forwards;
            z-index: 1;
        `;
    }

    createGlowEffect(button) {
        const glowEffect = button.querySelector('.glow-effect');
        if (!glowEffect) return;
        
        glowEffect.style.cssText = `
            position: absolute;
            top: -5px;
            left: -5px;
            right: -5px;
            bottom: -5px;
            background: linear-gradient(45deg, #28a745, #20c997, #28a745);
            border-radius: 15px;
            opacity: 0;
            animation: glowPulse 2s ease-in-out infinite;
            z-index: -1;
        `;
        
        // Add glow keyframes if not exists
        if (!document.getElementById('glow-style')) {
            const style = document.createElement('style');
            style.id = 'glow-style';
            style.textContent = `
                @keyframes glowPulse {
                    0%, 100% {
                        opacity: 0;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.6;
                        transform: scale(1.05);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    showSuccessCheckmark(button) {
        const successIcon = button.querySelector('.success-icon');
        if (!successIcon) return;
        
        // Switch to CSS-driven animation
        successIcon.classList.add('show');
    }

    createConfettiBurst(button) {
        let container = button.querySelector('.particles-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'particles-container';
            button.appendChild(container);
        }
        
        const colors = ['#28a745', '#20c997', '#2c5aa0', '#f59e0b', '#ef4444', '#6366f1'];
        const pieces = 24;
        
        // Clear any existing pieces
        container.innerHTML = '';
        
        for (let i = 0; i < pieces; i++) {
            const el = document.createElement('div');
            el.className = 'confetti';
            
            const angle = Math.random() * 360;
            const distance = 30 + Math.random() * 60;
            const dx = Math.cos(angle * Math.PI / 180) * distance + 'px';
            const dy = Math.sin(angle * Math.PI / 180) * distance + 'px';
            const rot = (Math.random() * 180 - 90) + 'deg';
            
            el.style.cssText = `
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: ${colors[i % colors.length]};
                --dx: ${dx};
                --dy: ${dy};
                --rot: ${rot};
                z-index: 20;
            `;
            container.appendChild(el);
        }
        
        setTimeout(() => {
            container.innerHTML = '';
        }, 1200);
    }

    createFloatingCart(button) {
        const floatingCart = button.querySelector('.floating-cart');
        if (!floatingCart) return;
        
        floatingCart.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0;
            animation: floatUp 1.5s ease-out forwards;
            z-index: 15;
        `;
        
        // Add floating keyframes if not exists
        if (!document.getElementById('floating-style')) {
            const style = document.createElement('style');
            style.id = 'floating-style';
            style.textContent = `
                @keyframes floatUp {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) translateY(0) scale(0);
                    }
                    30% {
                        opacity: 1;
                        transform: translate(-50%, -50%) translateY(-20px) scale(1.2);
                    }
                    60% {
                        opacity: 1;
                        transform: translate(-50%, -50%) translateY(-30px) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-50%, -50%) translateY(-50px) scale(0.8);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Check if product is in cart on page load
    async checkCartStateOnLoad() {
        if (!this.currentProduct) return;
        
        // Wait for cart manager to be available
        let attempts = 0;
        while (!window.simpleCartManager && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.simpleCartManager) return;
        
        // Wait for cart manager to be initialized and cart loaded
        attempts = 0;
        while (attempts < 50) {
            // Check if user is logged in and cart is loaded, or if it's a guest with localStorage cart
            const isLoggedIn = window.simpleCartManager.isUserLoggedIn();
            const hasCart = window.simpleCartManager.cart && Array.isArray(window.simpleCartManager.cart);
            
            if ((isLoggedIn && hasCart) || (!isLoggedIn && hasCart)) {
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // Check if current product is in cart
        const isInCart = window.simpleCartManager.isInCart(this.currentProduct.id);
        
        if (isInCart) {
            // Set buttons to "В корзине" state
            const buttons = document.querySelectorAll('#add-to-cart-btn, #mobile-add-to-cart');
            buttons.forEach(button => {
                this.setInCartState(button);
            });
        }
    }
    
    // Set button to "В корзине" state without animation
    setInCartState(button) {
        const textElement = button.querySelector('.btn-text');
        const successIcon = button.querySelector('.success-icon');
        
        // Set visual state
        button.classList.add('in-cart');
        
        // Update text
        if (textElement) {
            textElement.textContent = 'Перейти в корзину';
        }
        
        // Show success icon
        if (successIcon) {
            successIcon.classList.add('show');
        }
        
        // Set up click handler to go to cart
        const goToCartHandler = (e) => {
            e.preventDefault();
            window.location.href = 'cart.html';
        };
        
        // Remove any existing click handlers and add new one
        button.removeEventListener('click', this.addToCart.bind(this));
        button.addEventListener('click', goToCartHandler);
        
        button.disabled = false;
    }

    resetCartButton(button, goToCartHandler) {
        // Remove all animation classes
        button.classList.remove('morphing', 'in-cart', 'wow-start');
        
        // Reset icon and checkmark classes
        const iconEl = button.querySelector('.btn-icon');
        if (iconEl) iconEl.classList.remove('animate');
        const successIcon = button.querySelector('.success-icon');
        if (successIcon) successIcon.classList.remove('show');
        
        // Reset background sweep
        button.style.backgroundImage = '';
        button.style.backgroundSize = '';
        button.style.backgroundPosition = '';
        
        // Reset text
        const textElement = button.querySelector('.btn-text');
        if (textElement) {
            textElement.textContent = 'Добавить в корзину';
        }
        
        // Reset button state
        button.disabled = false;
        
        // Remove event handler
        if (goToCartHandler) {
            button.removeEventListener('click', goToCartHandler);
        }
        
        // Restore original add to cart handler
        button.addEventListener('click', this.addToCart.bind(this));
        
        // Clear animation elements
        const particlesContainer = button.querySelector('.particles-container');
        const rippleWave = button.querySelector('.ripple-wave');
        const glowEffect = button.querySelector('.glow-effect');
        
        if (particlesContainer) particlesContainer.innerHTML = '';
        if (rippleWave) rippleWave.style.cssText = '';
        if (glowEffect) glowEffect.style.cssText = '';
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

    buyNow() {
        this.addToCart();
        // Redirect to checkout or cart page
        window.location.href = 'cart.html';
    }

    async toggleFavorite() {
        // Check if user is authenticated
        if (!window.favoritesManager || !window.favoritesManager.isAuthenticated()) {
            this.showGuestOverlay();
            return;
        }

        const btn = document.getElementById('favorite-btn');
        const icon = btn.querySelector('i');
        
        // Create ripple effect
        this.createFavoriteRipple(btn);
        
        try {
            const result = await window.favoritesManager.toggleFavorite(this.currentProduct.id);
            
            // Update UI based on result
            btn.classList.toggle('active', result.isFavorite);
            if (result.isFavorite) {
                icon.classList.remove('far');
                icon.classList.add('fas');
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
            }
            
            // Add pulse animation
            btn.style.animation = 'favoritePulse 0.4s ease-in-out';
            setTimeout(() => {
                btn.style.animation = '';
            }, 400);
            
            // Create particle effect when adding to favorites
            if (result.isFavorite) {
                this.createFavoriteParticles(btn);
            }
            
            this.showNotification(
                result.isFavorite ? 'Добавлено в избранное!' : 'Удалено из избранного!',
                'info'
            );
        } catch (error) {
            console.error('Error toggling favorite:', error);
            this.showNotification('Ошибка при добавлении в избранное', 'error');
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
        button.appendChild(particlesContainer);
        
        // Create 6 particles
        for (let i = 0; i < 6; i++) {
            const particle = document.createElement('div');
            particle.classList.add('favorite-particle');
            
            // Random position around the button
            const angle = (i * 60) + Math.random() * 30 - 15; // Spread particles in a circle
            const distance = 15 + Math.random() * 10;
            const x = Math.cos(angle * Math.PI / 180) * distance;
            const y = Math.sin(angle * Math.PI / 180) * distance;
            
            particle.style.left = `calc(50% + ${x}px)`;
            particle.style.top = `calc(50% + ${y}px)`;
            particle.style.animationDelay = `${i * 0.1}s`;
            
            particlesContainer.appendChild(particle);
        }
        
        // Remove particles after animation
        setTimeout(() => {
            if (particlesContainer.parentNode) {
                particlesContainer.parentNode.removeChild(particlesContainer);
            }
        }, 1000);
    }

    addToCompare() {
        this.showNotification('Добавлено к сравнению!', 'info');
    }

    shareProduct() {
        if (navigator.share) {
            navigator.share({
                title: this.currentProduct.name,
                text: `Посмотрите на этот товар: ${this.currentProduct.name}`,
                url: window.location.href
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showNotification('Ссылка скопирована в буфер обмена!', 'success');
            });
        }
    }

    toggleCalculations() {
        const calculationsSection = document.getElementById('calculations-section');
        const calculationsBtn = document.getElementById('calculations-btn');
        
        if (calculationsSection.style.display === 'none' || calculationsSection.style.display === '') {
            calculationsSection.style.display = 'block';
            calculationsBtn.classList.add('active');
            this.updateCalculations();
            this.showNotification('Показаны подробные расчеты', 'info');
        } else {
            calculationsSection.style.display = 'none';
            calculationsBtn.classList.remove('active');
        }
    }

    updateCalculations() {
        if (!this.currentProduct) return;

        const basePrice = this.currentProduct.price;
        const shipping = 49.00;
        const taxRate = 0.10; // 10% tax
        const insuranceRate = 0.015; // 1.5% insurance
        
        const taxes = basePrice * taxRate;
        const insurance = basePrice * insuranceRate;
        const total = basePrice + shipping + taxes + insurance;

        // Update the calculation values
        document.getElementById('base-price').textContent = `€${basePrice.toFixed(2)}`;
        document.getElementById('shipping-cost').textContent = `€${shipping.toFixed(2)}`;
        document.getElementById('taxes').textContent = `€${taxes.toFixed(2)}`;
        document.getElementById('insurance').textContent = `€${insurance.toFixed(2)}`;
        document.getElementById('total-price').textContent = `€${total.toFixed(2)}`;
    }

    openSpecsModal() {
        const modal = document.getElementById('specs-modal');
        const modalBody = document.getElementById('specs-modal-body');
        
        // Generate detailed specifications
        modalBody.innerHTML = this.generateDetailedSpecs();
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeSpecsModal() {
        const modal = document.getElementById('specs-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    generateDetailedSpecs() {
        const specs = this.getProductSpecs();
        const sections = {
            'Основная информация': {
                'Цвет': specs['Цвет'] || 'серебро'
            },
            'Общие характеристики': {
                'Модель': specs['Модель'],
                'Гарантийный срок': specs['Гарантийный срок']
            }
        };

        // Add category-specific sections
        if (this.currentProduct.category === 'electric') {
            sections['Питание'] = {
                'Время работы от аккумулятора, до': specs['Время работы от аккумулятора'],
                'Питание': specs['Питание'],
                'Время зарядки аккумулятора': specs['Время зарядки аккумулятора']
            };

            sections['Связь'] = {
                'Беспроводные интерфейсы': specs['Беспроводные интерфейсы']
            };

            sections['Технические особенности'] = {
                'Количество режимов работы': specs['Количество режимов работы']
            };

            sections['Насадки'] = {
                'Количество насадок': specs['Количество насадок']
            };

            sections['Дополнительная информация'] = {
                'Тип зубной щетки': specs['Тип зубной щетки'],
                'Форма чистящей головки': specs['Форма чистящей головки'],
                'Жесткость щетины': specs['Жесткость щетины'],
                'Движение головки': specs['Движение головки'],
                'Доп. опции электрической зубной щетки': specs['Доп. опции электрической зубной щетки'],
                'Страна производства': specs['Страна производства']
            };

            sections['Габариты'] = {
                'Высота предмета': '24 см',
                'Ширина предмета': '2.5 см',
                'Глубина предмета': '2.5 см',
                'Вес товара с упаковкой (г)': '650 г',
                'Длина упаковки': '14 см',
                'Высота упаковки': '23 см',
                'Ширина упаковки': '4 см'
            };
        } else {
            sections['Технические характеристики'] = {
                'Материал рамы': specs['Материал рамы'],
                'Размер колес': specs['Размер колес'],
                'Количество скоростей': specs['Количество скоростей'],
                'Тип тормозов': specs['Тип тормозов'],
                'Вес': specs['Вес'],
                'Максимальная нагрузка': specs['Максимальная нагрузка']
            };
        }

        let html = '';
        Object.entries(sections).forEach(([sectionTitle, sectionSpecs]) => {
            html += `
                <div class="specs-section">
                    <h3 class="specs-section-title">${sectionTitle}</h3>
                    <div class="specs-list">
                        ${Object.entries(sectionSpecs).map(([key, value]) => `
                            <div class="specs-list-item">
                                <span class="specs-list-label">${key}</span>
                                <span class="specs-list-value">${value}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        return html;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 500;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    openFullscreen(imageIndex = null) {
        const modal = document.getElementById('fullscreen-modal');
        const fullscreenImage = document.getElementById('fullscreen-image');
        
        if (imageIndex !== null) {
            this.currentImageIndex = imageIndex;
        }
        
        const currentImageSrc = this.productImages[this.currentImageIndex];
        fullscreenImage.src = currentImageSrc;
        fullscreenImage.alt = this.currentProduct.name;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeFullscreen() {
        const modal = document.getElementById('fullscreen-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    navigateFullscreen(direction) {
        if (direction === 'next') {
            this.currentImageIndex = (this.currentImageIndex + 1) % this.productImages.length;
        } else {
            this.currentImageIndex = this.currentImageIndex === 0 ? this.productImages.length - 1 : this.currentImageIndex - 1;
        }
        
        const fullscreenImage = document.getElementById('fullscreen-image');
        const currentImageSrc = this.productImages[this.currentImageIndex];
        fullscreenImage.src = currentImageSrc;
        fullscreenImage.alt = this.currentProduct.name;
    }
}

// Guest overlay management functions
function closeGuestOverlay() {
    const overlay = document.getElementById('guest-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

function redirectToLogin() {
    closeGuestOverlay();
    // Redirect to login page or show login modal
    window.location.href = 'login.html';
}

function redirectToRegister() {
    closeGuestOverlay();
    // Redirect to registration page
    window.location.href = 'register.html';
}

function redirectToOrder() {
    closeGuestOverlay();
    // Redirect to order form for guests
    window.location.href = 'order.html';
}

// Close overlay when clicking outside
document.addEventListener('click', function(e) {
    const overlay = document.getElementById('guest-overlay');
    const notification = document.querySelector('.guest-notification');
    
    if (overlay && overlay.classList.contains('show')) {
        if (e.target === overlay && !notification.contains(e.target)) {
            closeGuestOverlay();
        }
    }
});

// Product calculator integration is now handled by ProductCalculator class in product-calculator.js

// Product Card Enhancement Class
class ProductCardEnhancement {
    constructor() {
        this.init();
    }

    init() {
        this.setupColorSelection();
        this.setupActionButtons();
    }

    setupColorSelection() {
        const colorOptions = document.querySelectorAll('.color-option');
        
        colorOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                // Remove active class from all options
                colorOptions.forEach(opt => opt.classList.remove('active'));
                
                // Add active class to clicked option
                option.classList.add('active');
                
                // Update main product image if needed
                const colorImage = option.querySelector('.color-preview');
                if (colorImage) {
                    this.updateMainProductImage(colorImage.src);
                }
            });
        });
    }



    setupActionButtons() {
        // Enhanced button interactions
        const actionButtons = document.querySelectorAll('.action-btn');
        
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Add click animation
                button.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    button.style.transform = '';
                }, 150);
                
                // Handle specific button actions
                const buttonId = button.id;
                this.handleActionButton(buttonId, button);
            });
        });

        // Enhanced main action buttons
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        const buyNowBtn = document.getElementById('buy-now-btn');

        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', (e) => {
                this.animateButtonClick(addToCartBtn);
            });
        }

        if (buyNowBtn) {
            buyNowBtn.addEventListener('click', (e) => {
                this.animateButtonClick(buyNowBtn);
            });
        }
    }

    animateButtonClick(button) {
        button.style.transform = 'scale(0.98)';
        button.style.boxShadow = '0 2px 8px rgba(44, 90, 160, 0.2)';
        
        setTimeout(() => {
            button.style.transform = '';
            button.style.boxShadow = '';
        }, 200);
    }

    handleActionButton(buttonId, button) {
        switch(buttonId) {
            case 'favorite-btn':
                this.toggleFavorite(button);
                break;
            case 'compare-btn':
                this.toggleCompare(button);
                break;
            case 'share-btn':
                this.shareProduct();
                break;
            case 'calculations-btn':
                this.toggleCalculations();
                break;
        }
    }

    toggleFavorite(button) {
        button.classList.toggle('active');
        const icon = button.querySelector('i');
        
        if (button.classList.contains('active')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    }

    toggleCompare(button) {
        button.classList.toggle('active');
    }

    shareProduct() {
        if (navigator.share) {
            navigator.share({
                title: document.title,
                url: window.location.href
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            this.showToast('Ссылка скопирована в буфер обмена');
        }
    }

    toggleCalculations() {
        const calculationsSection = document.getElementById('calculations-section');
        if (calculationsSection) {
            const isVisible = calculationsSection.style.display !== 'none';
            calculationsSection.style.display = isVisible ? 'none' : 'block';
        }
    }

    updateMainProductImage(newImageSrc) {
        const mainImage = document.querySelector('.product-image-main img');
        if (mainImage) {
            mainImage.src = newImageSrc;
        }
    }

    showToast(message) {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2c5aa0;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.opacity = '1', 100);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

// Initialize the product detail page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const productPage = new ProductDetailPage();
    const cardEnhancement = new ProductCardEnhancement();
    
    // Product calculator is now initialized in renderProduct method
});