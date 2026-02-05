// BikeEU - Cost Calculator
// Мгновенный расчёт стоимости доставки велосипедов из Европы

class BikeCalculator {
    constructor() {
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
        // Состояние расчёта и данных велосипеда
        this.lastCosts = null;
        this.currentBikeData = null;
        this.listingUrl = '';
        
        this.init();
    }
    
    async init() {
        this.createCalculatorHTML();
        this.bindEvents();
        try {
            await this.refreshRates();
        } catch {}
        this.updateCalculation();
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
    
    createCalculatorHTML() {
        const calculatorContainer = document.getElementById('calculator-widget');
        if (!calculatorContainer) return;
        
        calculatorContainer.innerHTML = `
            <div class="calculator-card">
                <div class="calculator-header">
                    <h3>Калькулятор стоимости</h3>
                    <p>Узнайте точную стоимость доставки</p>
                </div>
                
                <div class="mobile-stages" aria-live="polite">
                    <div class="stage stage-input" aria-label="Ввод данных">
                        <div class="calculator-form">
                            <div class="input-group">
                                <label for="bike-link">Ссылка на объявление</label>
                                <div class="input-wrapper input-split">
                                    <input type="url" id="bike-link" placeholder="https://www.kleinanzeigen.de/s-anzeige/..." aria-label="Ссылка на объявление" style="width: 100%;">
                                </div>
                                <div class="actions-row">
                                    <button type="button" id="parse-link-btn" class="btn btn-primary" aria-label="Получить данные по объявлению">
                                        <i data-lucide="search"></i>
                                        Получить данные
                                    </button>
                                </div>
                                <div class="parse-progress" aria-hidden="true">
                                    <div class="parse-bar">
                                        <div class="parse-fill" id="parse-progress-fill"></div>
                                    </div>
                                    <div class="parse-stage" id="parse-progress-stage">Готово к парсингу</div>
                                </div>
                            </div>
                            
                            <div class="input-group">
                                <label for="bike-price">Стоимость велосипеда</label>
                                <div class="input-wrapper">
                                    <input type="number" id="bike-price" placeholder="1500" min="100" max="10000" value="1500">
                                    <span class="currency">€</span>
                                </div>
                            </div>
                            
                            <div class="input-group">
                                <label for="delivery-city">Город доставки</label>
                                <select id="delivery-city">
                                    <option value="moscow">Москва</option>
                                    <option value="spb">Санкт-Петербург</option>
                                    <option value="ekb">Екатеринбург</option>
                                    <option value="nsk">Новосибирск</option>
                                    <option value="kzn">Казань</option>
                                    <option value="other">Другой город</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="stage stage-result" aria-label="Результаты расчёта">
                        <div class="calculation-result">
                            <div class="result-header">
                                <h4>Итоговая стоимость</h4>
                                <div class="total-price">
                                    <span class="price-eur">0 €</span>
                                    <span class="price-rub">0 ₽</span>
                                </div>
                            </div>
                            
                            <div class="breakdown">
                                <div class="breakdown-item">
                                    <span>Стоимость велосипеда:</span>
                                    <span class="breakdown-value" id="bike-cost">0 €</span>
                                </div>
                                <div class="breakdown-item">
                                    <span>Доставка:</span>
                                    <span class="breakdown-value" id="delivery-cost">0 €</span>
                                </div>
                                <div class="breakdown-item">
                                    <span>Комиссия сервиса (8%):</span>
                                    <span class="breakdown-value" id="service-cost">0 €</span>
                                </div>
                                <div class="breakdown-item">
                                    <span>Логистические сборы:</span>
                                    <span class="breakdown-value" id="logistics-cost">0 €</span>
                                </div>
                                <div class="breakdown-item">
                                    <span>Прочие сборы:</span>
                                    <span class="breakdown-value" id="other-cost">0 €</span>
                                </div>
                                <!-- Скрытые старые поля -->
                                <div class="breakdown-item" style="display: none;">
                                    <span>Таможенная пошлина:</span>
                                    <span class="breakdown-value" id="customs-cost">0 €</span>
                                </div>
                                <div class="breakdown-item" style="display: none;">
                                    <span>Страховка:</span>
                                    <span class="breakdown-value" id="insurance-cost">0 €</span>
                                </div>
                            </div>
                            
                            <div class="calculator-actions">
                                <button class="btn-primary" id="order-request">
                                    <i data-lucide="shopping-cart"></i>
                                    Оформить заказ
                                </button>
                                <button class="btn-secondary" id="save-calculation">
                                    <i data-lucide="bookmark"></i>
                                    Сохранить расчёт
                                </button>
                                <button class="btn-secondary btn-back" id="back-to-input">
                                    <i data-lucide="arrow-left"></i>
                                    Вернуться к ссылке
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Настраиваем мобильный режим стадий
        this.setupMobileMode();
    }
    
    bindEvents() {
        const linkInput = document.getElementById('bike-link');
        const parseBtn = document.getElementById('parse-link-btn');
        const priceInput = document.getElementById('bike-price');
        const citySelect = document.getElementById('delivery-city');
        const orderBtn = document.getElementById('order-request');
        const saveBtn = document.getElementById('save-calculation');
        const backBtn = document.getElementById('back-to-input');
        
        if (linkInput) {
            linkInput.addEventListener('input', this.debounce(() => this.validateLink(), 300));
        }
        
        if (parseBtn) {
            parseBtn.addEventListener('click', () => this.parseLink());
        }
        
        if (priceInput) {
            priceInput.addEventListener('input', this.debounce(() => this.updateCalculation(), 300));
            priceInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.updateCalculation();
                    this.goToResultStage();
                }
            });
            priceInput.addEventListener('blur', () => {
                const val = parseFloat(priceInput.value || '0');
                if (val > 0) {
                    this.goToResultStage();
                }
            });
        }
        
        if (citySelect) {
            citySelect.addEventListener('change', () => this.updateCalculation());
        }

        if (orderBtn) {
            orderBtn.addEventListener('click', () => this.handleOrderRequest());
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.goToInputStage();
                const linkInputEl = document.getElementById('bike-link');
                if (linkInputEl) {
                    // Даем времени переключиться стадии и затем скроллим к полю
                    setTimeout(() => {
                        linkInputEl.focus({ preventScroll: false });
                        linkInputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 60);
                }
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCalculation());
        }

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (orderBtn && !prefersReducedMotion) {
            orderBtn.classList.add('pulse-cta');
        }
    }
    
    updateCalculation() {
        const bikePrice = parseFloat(document.getElementById('bike-price')?.value) || 0;
        const deliveryCity = document.getElementById('delivery-city')?.value || 'moscow';
        
        if (bikePrice <= 0) return;
        
        // Рассчитываем реальную итоговую цену
        const realTotalPrice = this.calculateRealPrice(bikePrice);
        
        // Получаем маркетинговую разбивку для отображения
        const marketingBreakdown = this.calculateMarketingBreakdown(bikePrice);
        
        // Обновление интерфейса с маркетинговой разбивкой
        this.updateUI({
            bikePrice: marketingBreakdown.bikePrice,
            deliveryCost: marketingBreakdown.deliveryCost,
            serviceCost: marketingBreakdown.serviceCost,
            logisticsFees: marketingBreakdown.logisticsFees,
            otherFees: marketingBreakdown.otherFees,
            totalEur: marketingBreakdown.totalEur, // Это должно равняться realTotalPrice
            totalRub: marketingBreakdown.totalRub
        });
        
        // Сохраняем последнюю разбивку для заявки
        this.lastCosts = {
            bikePrice,
            deliveryCity,
            deliveryCost: marketingBreakdown.deliveryCost,
            serviceCost: marketingBreakdown.serviceCost,
            logisticsFees: marketingBreakdown.logisticsFees,
            otherFees: marketingBreakdown.otherFees,
            totalEur: marketingBreakdown.totalEur,
            totalRub: marketingBreakdown.totalRub,
            realTotalPrice: realTotalPrice // Сохраняем реальную цену для справки
        };
        
        // Анимация обновления
        this.animateUpdate();
    }
    
    calculateDelivery(weight, city) {
        let baseCost = this.rates.delivery_base;
        
        // Коэффициент веса
        if (weight > 20) {
            baseCost += (weight - 20) * 5;
        }
        
        // Коэффициент города
        const cityMultipliers = {
            'moscow': 1.0,
            'spb': 1.1,
            'ekb': 1.3,
            'nsk': 1.5,
            'kzn': 1.2,
            'other': 1.4
        };
        
        return baseCost * (cityMultipliers[city] || 1.0);
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

    // Рассчитывает реальную итоговую цену
    calculateRealPrice(bikePrice) {
        const realMarkup = this.getRealMarkup(bikePrice);
        const realDelivery = this.rates.real_delivery;
        return bikePrice + realMarkup + realDelivery;
    }

    // Рассчитывает маркетинговые (отображаемые) расходы
    calculateMarketingBreakdown(bikePrice) {
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
        
        return {
            bikePrice: bikePrice,
            serviceCost: marketingService,
            deliveryCost: marketingDelivery,
            logisticsFees: logisticsFees,
            otherFees: otherFees,
            totalEur: bikePrice + marketingService + marketingDelivery + logisticsFees + otherFees,
            totalRub: (bikePrice + marketingService + marketingDelivery + logisticsFees + otherFees) * this.rates.eur_to_rub
        };
    }
    
    updateUI(costs) {
        // Обновление разбивки с новыми полями
        const bikeElement = document.getElementById('bike-cost');
        const deliveryElement = document.getElementById('delivery-cost');
        const serviceElement = document.getElementById('service-cost');
        
        if (bikeElement) bikeElement.textContent = `${costs.bikePrice.toFixed(0)} €`;
        if (deliveryElement) deliveryElement.textContent = `${costs.deliveryCost.toFixed(0)} €`;
        if (serviceElement) serviceElement.textContent = `${costs.serviceCost.toFixed(0)} €`;
        
        // Обновляем или создаем элементы для новых полей
        const logisticsElement = document.getElementById('logistics-cost');
        const otherElement = document.getElementById('other-cost');
        
        if (logisticsElement) logisticsElement.textContent = `${costs.logisticsFees.toFixed(0)} €`;
        if (otherElement) otherElement.textContent = `${costs.otherFees.toFixed(0)} €`;
        
        // Скрываем старые поля если они есть
        const customsElement = document.getElementById('customs-cost');
        const insuranceElement = document.getElementById('insurance-cost');
        if (customsElement) customsElement.parentElement.style.display = 'none';
        if (insuranceElement) insuranceElement.parentElement.style.display = 'none';
        
        // Обновление итоговой стоимости
        const priceEur = document.querySelector('.price-eur');
        const priceRub = document.querySelector('.price-rub');
        
        if (priceEur) {
            priceEur.textContent = `${costs.totalEur.toFixed(0)} €`;
        }
        
        if (priceRub) {
            priceRub.textContent = `${costs.totalRub.toLocaleString('ru-RU')} ₽`;
        }
    }
    
    animateUpdate() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const resultCard = document.querySelector('.calculation-result');
        const priceEur = document.querySelector('.price-eur');
        const priceRub = document.querySelector('.price-rub');
        if (!prefersReducedMotion) {
            if (resultCard) {
                resultCard.classList.add('calc-recompute');
                setTimeout(() => {
                    resultCard.classList.remove('calc-recompute');
                }, 500);
            }
            if (priceEur) {
                priceEur.classList.add('anim-change');
                setTimeout(() => priceEur.classList.remove('anim-change'), 520);
            }
            if (priceRub) {
                priceRub.classList.add('anim-change');
                setTimeout(() => priceRub.classList.remove('anim-change'), 520);
            }
        }
    }
    
    handleOrderRequest() {
        const bikePrice = parseFloat(document.getElementById('bike-price')?.value) || 0;
        const deliveryCity = document.getElementById('delivery-city')?.value || 'moscow';
        const listingUrl = (document.getElementById('bike-link')?.value?.trim()) || this.listingUrl || '';
        
        if (!bikePrice || bikePrice <= 0) {
            this.showToast('Пожалуйста, укажите стоимость велосипеда', 'error');
            return;
        }
        
        const breakdown = this.lastCosts ? {
            bikePrice: this.lastCosts.bikePrice,
            deliveryCost: this.lastCosts.deliveryCost,
            customsCost: this.lastCosts.customsCost,
            serviceCost: this.lastCosts.serviceCost,
            insuranceCost: this.lastCosts.insuranceCost,
            totalEur: this.lastCosts.totalEur,
            totalRub: this.lastCosts.totalRub
        } : null;
        
        const orderData = {
            bikePrice,
            deliveryCity,
            weightKg: 15,
            listingUrl,
            breakdown,
            bike: this.currentBikeData || {},
            timestamp: Date.now()
        };
        
        localStorage.setItem('bikeOrderData', JSON.stringify(orderData));
        this.showOrderModal(orderData);
    }
    
    saveCalculation() {
        const calculation = {
            bikePrice: document.getElementById('bike-price')?.value,
            bikeWeight: document.getElementById('bike-weight')?.value,
            deliveryCity: document.getElementById('delivery-city')?.value,
            timestamp: Date.now()
        };
        
        // Сохранение в localStorage
        const savedCalculations = JSON.parse(localStorage.getItem('savedCalculations') || '[]');
        savedCalculations.push(calculation);
        localStorage.setItem('savedCalculations', JSON.stringify(savedCalculations));
        
        this.showToast('Расчёт сохранён', 'success');
    }
    
    showOrderModal(orderData) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content order-modal">
                <div class="modal-header">
                    <h3>Оформление заказа</h3>
                    <button class="modal-close" aria-label="Закрыть">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="order-bike-info">
                        <h4>Информация о велосипеде</h4>
                        <div class="summary-grid">
                            <div><span class="label">Бренд:</span> <span class="value">${orderData.bike?.brand || 'Не указан'}</span></div>
                            <div><span class="label">Модель:</span> <span class="value">${orderData.bike?.model || 'Не указана'}</span></div>
                            <div><span class="label">Год:</span> <span class="value">${orderData.bike?.year || 'Не указан'}</span></div>
                            <div><span class="label">Размер рамы:</span> <span class="value">${orderData.bike?.frameSize || 'Не указан'}</span></div>
                        </div>
                    </div>
                    
                    <form class="order-form">
                        <div class="input-group">
                            <label for="customer-name">Ваше имя *</label>
                            <input type="text" id="customer-name" required>
                        </div>
                        
                        <div class="input-group">
                            <label for="customer-phone">Телефон *</label>
                            <input type="tel" id="customer-phone" placeholder="+7 (999) 123-45-67" required>
                        </div>
                        
                        <div class="input-group">
                            <label for="customer-email">Email</label>
                            <input type="email" id="customer-email">
                        </div>

                        <div class="input-group">
                            <label for="telegram-id">Telegram ID</label>
                            <input type="text" id="telegram-id" placeholder="@username">
                        </div>
                        
                        <div class="input-group">
                            <label for="bike-details">Комментарии к заказу</label>
                            <textarea id="bike-details" placeholder="Все, что написано тут, мы передадим нашему менеджеру!"></textarea>
                        </div>
                    </form>

                    <div class="order-summary">
                        <h4>Сводка заявки</h4>
                        <div class="summary-item"><span>Ссылка на объявление:</span><span>${orderData.listingUrl ? `<a href="${orderData.listingUrl}" target="_blank" rel="noopener">Открыть</a>` : '—'}</span></div>
                        <div class="summary-item"><span>Город доставки:</span><span>${this.getCityName(orderData.deliveryCity)}</span></div>
                        ${orderData.breakdown ? `
                        <div class="summary-item total"><span>Финальная стоимость:</span><span>${orderData.breakdown.totalEur.toFixed(0)} € / ${this.formatRubToNearest990(orderData.breakdown.totalRub).toLocaleString('ru-RU')} ₽</span></div>
                        <div class="summary-item"><span>Доставка:</span><span>${orderData.breakdown.deliveryCost.toFixed(0)} €</span></div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Отмена</button>
                    <button class="btn btn-primary submit-order">Отправить заявку</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        // Lock body scroll while modal is open
        document.body.classList.add('modal-active');
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Bind modal events
        this.bindModalEvents(modal);
        
        // Animate modal appearance
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }
    
    bindModalEvents(modal) {
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');
        const submitBtn = modal.querySelector('.submit-order');
        
        const closeModal = () => {
            modal.classList.remove('active');
            document.body.classList.remove('modal-active');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        };
        
        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        submitBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.submitOrder(modal);
        });
    }
    
    submitOrder(modal) {
        const form = modal.querySelector('.order-form');
        const formData = new FormData(form);
        
        const name = modal.querySelector('#customer-name').value;
        const phone = modal.querySelector('#customer-phone').value;
        const email = modal.querySelector('#customer-email').value;
        const telegramId = modal.querySelector('#telegram-id')?.value || '';
        const details = modal.querySelector('#bike-details').value;
        const submitBtn = modal.querySelector('.submit-order');
        
        if (!name || !phone) {
            this.showToast('Пожалуйста, заполните обязательные поля', 'error');
            return;
        }
        
        // Формируем объект заявки
        const application = {
            id: `REQ-${Date.now()}`,
            createdAt: new Date().toISOString(),
            customer: { name, phone, email, telegramId },
            details,
            order: JSON.parse(localStorage.getItem('bikeOrderData') || '{}')
        };
        
        // Сохраняем в localStorage список заявок
        const key = 'bikeOrderApplications';
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        list.push(application);
        localStorage.setItem(key, JSON.stringify(list));
        
        // Имитация отправки и подтверждение в модальном окне
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2"></i> Отправка...';
        
        setTimeout(() => {
            const body = modal.querySelector('.modal-body');
            const totalEur = application.order?.breakdown?.totalEur;
            const totalRub = application.order?.breakdown?.totalRub;
            const totalText = totalEur ? `${totalEur.toFixed(0)} €${totalRub ? ` / ${this.formatRubToNearest990(totalRub).toLocaleString('ru-RU')} ₽` : ''}` : '—';

            const renderSuccess = () => {
                body.innerHTML = `
                    <div class="order-success success-enter" id="order-success">
                        <div class="success-icon"><i data-lucide="check-circle"></i></div>
                        <h3>Заявка успешно отправлена</h3>
                        <p class="order-number">Номер заявки: <strong>${application.id}</strong></p>
                        <p class="order-total">Финальная стоимость: <strong>${totalText}</strong></p>
                        <div class="order-success-actions">
                            <button class="btn btn-primary" id="track-status">Отследить статус</button>
                            <button class="btn btn-secondary" id="return-home">Вернуться на главную</button>
                        </div>
                    </div>
                `;
                const footer = modal.querySelector('.modal-footer');
                footer.innerHTML = '';
                this.showToast('Заявка отправлена! Мы свяжемся с вами в течение часа.', 'success');
                
                // Обновляем обработчики закрытия
                this.bindModalEvents(modal);
                // Инициализируем иконки
                if (window.lucide && window.lucide.createIcons) {
                    window.lucide.createIcons();
                }
                // Частицы успеха
                const successEl = document.getElementById('order-success');
                if (successEl) {
                    this.createSuccessParticles(successEl);
                }
                // Действия: отслеживание и возврат
                const trackBtn = document.getElementById('track-status');
                const homeBtn = document.getElementById('return-home');
                trackBtn?.addEventListener('click', () => {
                    this.showToast('Скоро добавим страницу отслеживания статуса заявки.', 'info');
                });
                homeBtn?.addEventListener('click', () => {
                    window.location.href = 'index.html';
                });
            };

            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!prefersReducedMotion) {
                // Плавно «схлопываем» текущий контент
                body.classList.add('transition-out');
                const onAnimEnd = (e) => {
                    if (e.animationName !== 'collapseFadeOut') return;
                    body.removeEventListener('animationend', onAnimEnd);
                    body.classList.remove('transition-out');
                    renderSuccess();
                };
                body.addEventListener('animationend', onAnimEnd);
            } else {
                renderSuccess();
            }
        }, 1200);
    }
    
    getCityName(cityCode) {
        const cities = {
            'moscow': 'Москва',
            'spb': 'Санкт-Петербург',
            'ekb': 'Екатеринбург',
            'nsk': 'Новосибирск',
            'kzn': 'Казань',
            'other': 'Другой город'
        };
        return cities[cityCode] || 'Не указан';
    }

    // Округление рублей до ближайших 990 (значение вида XXX,990)
    formatRubToNearest990(value) {
        const num = Number(value) || 0;
        const floor990 = Math.floor(num / 1000) * 1000 - 10;
        const ceil990 = Math.ceil(num / 1000) * 1000 - 10;
        // Если floor990 ушёл в отрицательное, берём верхний кандидат
        const candidateFloor = floor990 > 0 ? floor990 : ceil990;
        // Выбираем ближайший из двух кандидатов
        const diffFloor = Math.abs(candidateFloor - num);
        const diffCeil = Math.abs(ceil990 - num);
        return diffFloor <= diffCeil ? candidateFloor : ceil990;
    }

    // Эффект «зеленых партиклов» с ускорением–замедлением и выходом за пределы модального окна
    createSuccessParticles(container) {
        try {
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            // Оверлей на весь вьюпорт, чтобы частицы могли выходить за пределы модального окна
            const overlay = document.createElement('div');
            overlay.className = 'success-particles success-particles-global';
            document.body.appendChild(overlay);

            const rect = container.getBoundingClientRect();
            const originX = rect.left + rect.width / 2;
            const originY = rect.top + rect.height * 0.4; // чуть выше центра для красоты

            const count = 40; // более насыщенно
            const particles = [];

            // Быстрая функция ускорения–замедления (easeInOutQuad)
            const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p);

            for (let i = 0; i < count; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                const angle = Math.random() * Math.PI * 2; // 0..2π
                // Дистанция, чтобы гарантированно уйти за пределы модального окна
                const distance = (window.innerWidth + window.innerHeight) * (0.15 + Math.random() * 0.25); // ~ 15–40% диагонали вьюпорта
                const size = 5 + Math.floor(Math.random() * 7); // 5..12px
                const hue = 140 + Math.floor(Math.random() * 30); // зелёные тона
                const sat = 62 + Math.floor(Math.random() * 14);
                const light = 42 + Math.floor(Math.random() * 12);

                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.background = `hsl(${hue} ${sat}% ${light}%)`;
                particle.style.position = 'fixed';
                particle.style.left = `${originX}px`;
                particle.style.top = `${originY}px`;
                particle.style.transform = 'translate(-50%, -50%)';
                particle.style.opacity = '0';
                particle.style.boxShadow = '0 0 0 rgba(34,197,94,0)';
                particle.style.willChange = 'transform, opacity';

                overlay.appendChild(particle);

                // Настройки анимации
                const total = 1600 + Math.floor(Math.random() * 600); // 1600..2200ms
                const startDelay = Math.floor(Math.random() * 180); // 0..180ms
                particles.push({ el: particle, angle, distance, total, startDelay });
            }

            if (prefersReducedMotion) {
                // Лёгкий пульс и без разлёта
                particles.forEach(({ el }) => {
                    el.style.opacity = '1';
                    el.style.transform = 'translate(-50%, -50%) scale(1.1)';
                });
                setTimeout(() => {
                    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
                }, 900);
                return;
            }

            const start = performance.now();
            const linger = 2000; // задержка после долёта

            const animate = (now) => {
                const tGlobal = now - start;
                let active = false;

                for (const p of particles) {
                    const t = tGlobal - p.startDelay;
                    if (t < 0) { active = true; continue; }
                    if (t <= p.total) {
                        active = true;
                        const progress = Math.min(Math.max(t / p.total, 0), 1);
                        const traveled = p.distance * easeInOutQuad(progress);
                        const x = originX + Math.cos(p.angle) * traveled;
                        const y = originY + Math.sin(p.angle) * traveled;
                        const fade = progress < 0.1 ? progress * 10 : progress > 0.85 ? (1 - progress) * 6 : 1;
                        const glow = progress < 0.5 ? progress : (1 - progress);
                        p.el.style.opacity = String(Math.max(0, Math.min(1, fade)));
                        p.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
                        p.el.style.boxShadow = `0 0 ${Math.round(16 * glow)}px rgba(34, 197, 94, ${0.35 * glow})`;
                    } else {
                        // Долёт завершён — оставляем частицу «зависать» на 2 секунды
                        p.el.style.opacity = '0.9';
                    }
                }

                if (active) {
                    requestAnimationFrame(animate);
                } else {
                    // Все частицы завершили полёт — ждём linger, потом удаляем оверлей
                    setTimeout(() => {
                        if (overlay && overlay.parentNode) {
                            overlay.parentNode.removeChild(overlay);
                        }
                    }, linger);
                }
            };

            requestAnimationFrame(animate);
        } catch (err) {
            console.warn('Particle animation error:', err);
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    validateLink() {
        const linkInput = document.getElementById('bike-link');
        const parseBtn = document.getElementById('parse-link-btn');
        
        if (!linkInput || !parseBtn) return;
        
        const url = linkInput.value.trim();
        const isValid = this.isValidBikeUrl(url);
        
        parseBtn.disabled = !isValid;
        parseBtn.style.opacity = isValid ? '1' : '0.5';
        
        if (isValid) {
            linkInput.style.borderColor = '#22c55e';
        } else if (url.length > 0) {
            linkInput.style.borderColor = '#ef4444';
        } else {
            linkInput.style.borderColor = '';
        }
    }
    
    isValidBikeUrl(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const protocolOk = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            const host = urlObj.hostname.toLowerCase();
            const isLocal = host === 'localhost' || host === '127.0.0.1';
            return protocolOk && !isLocal;
        } catch {
            return false;
        }
    }
    
    async parseLink() {
        const linkInput = document.getElementById('bike-link');
        const parseBtn = document.getElementById('parse-link-btn');
        const inputWrapper = linkInput?.closest('.input-wrapper');
        const progressFill = document.getElementById('parse-progress-fill');
        const progressStage = document.getElementById('parse-progress-stage');
        const setProgress = (pct, stage) => {
            if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
            if (progressStage && typeof stage === 'string') progressStage.textContent = stage;
        };
        
        if (!linkInput || !parseBtn) return;
        
        const url = linkInput.value.trim();
        if (!this.isValidBikeUrl(url)) {
            this.showToast('Пожалуйста, введите корректную ссылку на объявление', 'error');
            return;
        }
        
        // Показываем индикатор загрузки
        const originalText = parseBtn.innerHTML;
        parseBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-loader-2"></i> Парсинг...';
        parseBtn.disabled = true;
        const prefersReducedMotion2 = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (inputWrapper && !prefersReducedMotion2) {
            inputWrapper.classList.add('parsing-active');
        }
        setProgress(6, 'Инициализация...');
        
        try {
            const bikeData = await this.fetchBikeData(url, (pct, stage) => setProgress(pct, stage));
            this.populateBikeData(bikeData);
            this.showToast('Данные успешно извлечены!', 'success');
            setProgress(100, 'Готово');
            // Запуск волны обновления цен после успешного парсинга
            this.triggerPriceWave();
            // Переход к стадии результата на мобильном
            this.goToResultStage();
        } catch (error) {
            console.error('Ошибка парсинга:', error);
            this.showToast('Ошибка при извлечении данных. Попробуйте позже.', 'error');
            setProgress(100, 'Ошибка парсинга');
        } finally {
            parseBtn.innerHTML = originalText;
            parseBtn.disabled = false;
            if (inputWrapper) {
                inputWrapper.classList.remove('parsing-active');
            }
            
            // Обновляем иконки Lucide
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            setTimeout(() => {
                setProgress(0, 'Готово к парсингу');
            }, 1500);
        }
    }
    
    async fetchBikeData(url, progressUpdate) {
        try {
            // Используем конфигурацию из config.js
            const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;
            const GEMINI_API_URL = CONFIG.GEMINI_API_URL;
            
            // Сначала получаем HTML содержимое страницы через CORS proxy
            console.log('Получаем HTML содержимое страницы:', url);
            if (typeof progressUpdate === 'function') progressUpdate(20, 'Старт загрузки HTML...');
            
            // Список CORS proxy сервисов для fallback
            const proxyServices = [
                {
                    name: 'corsproxy.io',
                    url: `https://corsproxy.io/?${encodeURIComponent(url)}`,
                    parseResponse: (response) => response.text()
                },
                {
                    name: 'cors-anywhere',
                    url: `https://cors-anywhere.herokuapp.com/${url}`,
                    parseResponse: (response) => response.text()
                },
                {
                    name: 'r.jina.ai',
                    url: (() => {
                        try {
                            const u = new URL(url);
                            return `https://r.jina.ai/${u.protocol}//${u.hostname}${u.pathname}${u.search}`;
                        } catch (e) {
                            return `https://r.jina.ai/${url}`;
                        }
                    })(),
                    parseResponse: (response) => response.text()
                }
            ];
            
            let htmlContent = null;
            let lastError = null;
            
            // Пробуем каждый proxy сервис
            for (const proxy of proxyServices) {
                try {
                    console.log(`Пробуем ${proxy.name}:`, proxy.url);
                    if (typeof progressUpdate === 'function') progressUpdate(25, `Пробуем ${proxy.name}...`);
                    
                    const htmlResponse = await fetch(proxy.url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (!htmlResponse.ok) {
                        throw new Error(`HTTP ${htmlResponse.status}: ${htmlResponse.statusText}`);
                    }
                    
                    htmlContent = await proxy.parseResponse(htmlResponse);
                    
                    if (htmlContent && htmlContent.length > 100) {
                        console.log(`✅ Успешно получен HTML через ${proxy.name}, длина:`, htmlContent.length);
                        if (typeof progressUpdate === 'function') progressUpdate(50, `HTML получен через ${proxy.name}`);
                        break;
                    } else {
                        throw new Error('Получен пустой или слишком короткий ответ');
                    }
                    
                } catch (error) {
                    console.warn(`❌ Ошибка с ${proxy.name}:`, error.message);
                    lastError = error;
                    if (typeof progressUpdate === 'function') progressUpdate(35, `Ошибка ${proxy.name}`);
                    continue;
                }
            }
            
            if (!htmlContent) {
                if (typeof progressUpdate === 'function') progressUpdate(40, 'Proxy недоступны');
                throw new Error(`Не удалось загрузить страницу через все доступные proxy сервисы. Последняя ошибка: ${lastError?.message}`);
            }
            
            console.log('HTML содержимое получено, длина:', htmlContent.length);
            if (typeof progressUpdate === 'function') progressUpdate(60, 'HTML получен, отправляем в Gemini...');
            
            // Промпт для извлечения данных о велосипеде из HTML
            const prompt = `
                Проанализируй HTML содержимое страницы объявления о велосипеде с сайта kleinanzeigen.de:
                
                ${htmlContent}
                
                Извлеки следующую информацию и верни в формате JSON:
                {
                    "price": число (цена в евро, найди в HTML элементах с ценой),
                    "year": число (год выпуска, если указан),
                    "brand": строка (бренд велосипеда),
                    "model": строка (модель велосипеда),
                    "frameSize": строка (размер рамы, если указан),
                    "wheelDiameter": строка (диаметр колес, если указан),
                    "isNegotiable": boolean (есть ли "VB" после цены - означает возможность торга),
                    "deliveryOption": строка ("available" если доставка доступна, "pickup-only" если только самовывоз),
                    "description": строка (краткое описание из заголовка и описания)
                }
                
                Внимательно ищи цену в HTML - она может быть в разных элементах.
                Если какая-то информация недоступна, используй null для чисел и строк, false для boolean.
                Верни только JSON без дополнительного текста.
            `;
            
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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
            if (typeof progressUpdate === 'function') progressUpdate(72, 'Отправили запрос в Gemini');
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            const data = await response.json();
            console.log('API Response:', data);
            if (typeof progressUpdate === 'function') progressUpdate(80, 'Получили ответ от Gemini');
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Неожиданная структура ответа API');
            }
            
            let generatedText = data.candidates[0].content.parts[0].text;
            console.log('Generated text:', generatedText);
            
            // Убираем markdown форматирование если есть
            generatedText = generatedText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            
            // Парсим JSON из ответа Gemini
            const bikeData = JSON.parse(generatedText);
            if (typeof progressUpdate === 'function') progressUpdate(88, 'Структурируем данные');
            
            // Домашняя логика: самовывоз разрешён только на kleinanzeigen.de и pinkbike.com
            try {
                const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
                const allowPickup = host.endsWith('kleinanzeigen.de') || host.endsWith('pinkbike.com');
                if (!allowPickup) {
                    bikeData.deliveryOption = 'available';
                }
            } catch {}

            return bikeData;
            
        } catch (error) {
            console.error('Ошибка при получении данных о велосипеде:', error);
            console.error('Детали ошибки:', error.message);
            
            // Проверяем тип ошибки для более точной диагностики
            if (error.message.includes('Не удалось загрузить страницу через все доступные proxy сервисы')) {
                console.warn('Все CORS proxy недоступны, пробуем извлечь данные из URL');
                
                // Fallback: пытаемся извлечь данные из самого URL
                try {
                    const urlData = this.extractDataFromUrl(url);
                    if (urlData) {
                        console.log('Данные извлечены из URL:', urlData);
                        return urlData;
                    }
                } catch (urlError) {
                    console.error('Не удалось извлечь данные из URL:', urlError);
                }
                
                throw new Error('Не удалось загрузить содержимое страницы. Все proxy сервисы недоступны.');
            }
            
            // Fallback: возвращаем тестовые данные если API недоступен
            if (error.message.includes('YOUR_GEMINI_API_KEY') || !CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
                console.warn('Используются тестовые данные. Настройте Gemini API ключ для реального парсинга.');
                await new Promise(resolve => setTimeout(resolve, 1500)); // Имитация запроса
                if (typeof progressUpdate === 'function') progressUpdate(75, 'Используем тестовые данные');
                
                return {
                    price: 1200,
                    year: 2019,
                    brand: "Trek",
                    model: "FX 3",
                    frameSize: "L (56cm)",
                    wheelDiameter: "28\"",
                    isNegotiable: true,
                    deliveryOption: "available",
                    description: "Гибридный велосипед в отличном состоянии"
                };
            }
            
            throw new Error(`Не удалось получить данные о велосипеде: ${error.message}`);
        }
    }
    
    populateBikeData(data) {
        // Заполняем поле цены
        const priceInput = document.getElementById('bike-price');
        if (priceInput && data.price) {
            priceInput.value = data.price;
        }
        
        // Сохраняем ключевые данные велосипеда для заявки
        this.currentBikeData = {
            brand: data.brand || '',
            model: data.model || '',
            year: data.year || '',
            frameSize: data.frameSize || ''
        };

        // Показываем информацию о велосипеде
        this.displayBikeInfo(data);
        
        // Обновляем расчёты
        this.updateCalculation();
    }
    
    displayBikeInfo(data) {
        // Создаём или обновляем блок с информацией о велосипеде
        let infoBlock = document.getElementById('bike-info-display');
        
        if (!infoBlock) {
            infoBlock = document.createElement('div');
            infoBlock.id = 'bike-info-display';
            infoBlock.className = 'bike-info-block';
            const card = document.querySelector('.calculator-card');
            const stages = card?.querySelector('.mobile-stages');
            // Вставляем инфо-блок сразу под заголовок калькулятора, перед стадиями
            if (card && stages) {
                card.insertBefore(infoBlock, stages);
            } else if (card) {
                card.insertAdjacentElement('afterbegin', infoBlock);
            }
        }
        // Гарантируем правильную позицию, если блок уже существовал
        const card = document.querySelector('.calculator-card');
        const stages = card?.querySelector('.mobile-stages');
        if (infoBlock && card && stages && infoBlock.parentElement !== card) {
            card.insertBefore(infoBlock, stages);
        }
        
        const negotiableText = data.isNegotiable ? 
            '<span class="negotiable-badge">Торг уместен</span>' : 
            '<span class="final-price-badge">Финальная цена</span>';
        const deliveryText = data.deliveryOption === 'pickup-only' ? 
            '<span class="final-price-badge">Только самовывоз</span>' : 
            '<span class="negotiable-badge">Доставка доступна</span>';
        
        infoBlock.innerHTML = `
            <div class="bike-info-header">
                <h4>Информация о велосипеде</h4>
                <div class="bike-badges">
                    ${negotiableText}
                    ${deliveryText}
                </div>
            </div>
            <div class="bike-details-grid">
                <div class="bike-detail">
                    <span class="label">Бренд:</span>
                    <span class="value">${data.brand || 'Не указан'}</span>
                </div>
                <div class="bike-detail">
                    <span class="label">Модель:</span>
                    <span class="value">${data.model || 'Не указана'}</span>
                </div>
                <div class="bike-detail">
                    <span class="label">Год:</span>
                    <span class="value">${data.year || 'Не указан'}</span>
                </div>
                <div class="bike-detail">
                    <span class="label">Размер рамы:</span>
                    <span class="value">${data.frameSize || 'Не указан'}</span>
                </div>
            </div>
        `;
        const prefersReducedMotion3 = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReducedMotion3) {
            infoBlock.classList.add('liquid-enter');
            const details = infoBlock.querySelectorAll('.bike-detail');
            details.forEach((el, idx) => {
                el.style.animationDelay = `${idx * 130}ms`;
                el.classList.add('reveal');
            });
        }
    }

    // Запускает «волновое» обновление цен с каскадной анимацией
    triggerPriceWave() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const container = document.querySelector('.calculation-result');
        if (!container) return;
        if (prefersReducedMotion) return;

        // Волновой оверлей по контейнеру
        container.classList.add('price-wave');
        setTimeout(() => {
            container.classList.remove('price-wave');
        }, 1000);

        // Каскад по ключевым полям
        const targets = [
            document.querySelector('.price-eur'),
            document.querySelector('.price-rub'),
            document.getElementById('bike-cost'),
            document.getElementById('delivery-cost'),
            document.getElementById('customs-cost'),
            document.getElementById('service-cost'),
            document.getElementById('insurance-cost')
        ].filter(Boolean);

        targets.forEach((el, idx) => {
            setTimeout(() => {
                el.classList.add('wave-update');
                setTimeout(() => {
                    el.classList.remove('wave-update');
                }, 800);
            }, idx * 120);
        });
    }

    // Мобильный режим: подготовка стадий
    setupMobileMode() {
        const card = document.querySelector('.calculator-card');
        const stages = document.querySelector('.mobile-stages');
        if (!card || !stages) return;

        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.classList.toggle('mobile-mode', isMobile);

        const inputStage = stages.querySelector('.stage-input');
        const resultStage = stages.querySelector('.stage-result');
        if (!inputStage || !resultStage) return;

        if (isMobile) {
            // Начальная стадия — ввод
            inputStage.classList.add('stage-active');
            resultStage.classList.remove('stage-active');
            resultStage.classList.add('stage-hidden');
        } else {
            // Десктоп: обе стадии видимы, без анимационных классов
            inputStage.classList.remove('stage-active', 'stage-exit', 'stage-hidden');
            resultStage.classList.remove('stage-active', 'stage-exit', 'stage-hidden');
        }

        // Реакция на ресайз
        window.addEventListener('resize', this.debounce(() => {
            const mobileNow = window.matchMedia('(max-width: 768px)').matches;
            card.classList.toggle('mobile-mode', mobileNow);
            if (mobileNow) {
                inputStage.classList.add('stage-active');
                resultStage.classList.remove('stage-active');
                resultStage.classList.add('stage-hidden');
            } else {
                inputStage.classList.remove('stage-active', 'stage-exit', 'stage-hidden');
                resultStage.classList.remove('stage-active', 'stage-exit', 'stage-hidden');
            }
        }, 200));

        // Отключение сложной анимации при reduce motion
        if (prefersReducedMotion) {
            card.classList.add('rm');
        }
    }

    // Переключение на стадию результата с параболической анимацией
    goToResultStage() {
        const card = document.querySelector('.calculator-card');
        const stages = document.querySelector('.mobile-stages');
        if (!card || !stages || !card.classList.contains('mobile-mode')) return;

        const inputStage = stages.querySelector('.stage-input');
        const resultStage = stages.querySelector('.stage-result');
        if (!inputStage || !resultStage) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        inputStage.classList.remove('stage-active');
        inputStage.classList.add('stage-exit');
        resultStage.classList.remove('stage-hidden');
        resultStage.classList.add('stage-active');

        // Параболическая «занавеска»
        if (!prefersReducedMotion) {
            card.classList.add('parabolic-swap');
            setTimeout(() => card.classList.remove('parabolic-swap'), 1200);
        }
    }

    // Возврат на стадию ввода
    goToInputStage() {
        const card = document.querySelector('.calculator-card');
        const stages = document.querySelector('.mobile-stages');
        if (!card || !stages) return;

        const inputStage = stages.querySelector('.stage-input');
        const resultStage = stages.querySelector('.stage-result');
        if (!inputStage || !resultStage) return;

        const isMobileMode = card.classList.contains('mobile-mode');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (isMobileMode) {
            resultStage.classList.remove('stage-active');
            resultStage.classList.add('stage-exit');
            inputStage.classList.remove('stage-hidden');
            inputStage.classList.add('stage-active');
            if (!prefersReducedMotion) {
                card.classList.add('parabolic-swap');
                setTimeout(() => card.classList.remove('parabolic-swap'), 1200);
            }
        } else {
            // На десктопе просто прокручиваем к форме ввода
            const linkInputEl = document.getElementById('bike-link');
            if (linkInputEl) {
                linkInputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                linkInputEl.focus({ preventScroll: false });
            }
        }
    }
    
    // Fallback метод для извлечения данных из URL kleinanzeigen.de
    extractDataFromUrl(url) {
        try {
            console.log('Пытаемся извлечь данные из URL:', url);
            
            // Проверяем что это kleinanzeigen.de
            if (!url.includes('kleinanzeigen.de')) {
                throw new Error('URL не является ссылкой на kleinanzeigen.de');
            }
            
            // Извлекаем ID объявления из URL
            const adIdMatch = url.match(/\/(\d+)-/);
            const adId = adIdMatch ? adIdMatch[1] : null;
            
            // Пытаемся извлечь информацию из URL
            const urlParts = url.split('/');
            const titlePart = urlParts.find(part => part.includes('-')) || '';
            
            // Базовые данные на основе URL
            const extractedData = {
                price: null, // Не можем извлечь из URL
                year: null,  // Не можем извлечь из URL
                brand: this.extractBrandFromTitle(titlePart),
                model: this.extractModelFromTitle(titlePart),
                frameSize: null,
                wheelDiameter: null,
                isNegotiable: false, // По умолчанию
                deliveryOption: "pickup-only", // По умолчанию для kleinanzeigen
                description: `Объявление ${adId ? `#${adId}` : ''} с kleinanzeigen.de`
            };
            
            console.log('Извлеченные данные из URL:', extractedData);
            return extractedData;
            
        } catch (error) {
            console.error('Ошибка извлечения данных из URL:', error);
            return null;
        }
    }
    
    // Вспомогательный метод для извлечения бренда из заголовка URL
    extractBrandFromTitle(title) {
        const commonBrands = ['canyon', 'trek', 'specialized', 'giant', 'scott', 'cube', 'ktm', 'bulls', 'focus', 'ghost', 'haibike', 'merida'];
        const lowerTitle = title.toLowerCase();
        
        for (const brand of commonBrands) {
            if (lowerTitle.includes(brand)) {
                return brand.charAt(0).toUpperCase() + brand.slice(1);
            }
        }
        
        return null;
    }
    
    // Вспомогательный метод для извлечения модели из заголовка URL
    extractModelFromTitle(title) {
        // Убираем ID и разделители, оставляем только название
        const cleanTitle = title.replace(/^\d+-\d+-/, '').replace(/-/g, ' ');
        
        // Берем первые несколько слов как модель
        const words = cleanTitle.split(' ').filter(word => word.length > 0);
        return words.slice(0, 3).join(' ') || null;
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    new BikeCalculator();
});