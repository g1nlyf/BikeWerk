// Простой модуль управления корзиной
class SimpleCartManager {
    constructor() {
        this.cart = [];
        // init() теперь вызывается вручную в DOMContentLoaded
        
        // Слушаем события аутентификации
        this.setupAuthListener();
    }
    
    setupAuthListener() {
        // Слушаем события унифицированной системы аутентификации
        if (window.unifiedAuth) {
            window.unifiedAuth.addListener((event, data) => {
                console.log('Cart: Auth state changed:', event, data);
                if (event === 'login' || event === 'logout') {
                    // Перезагружаем корзину при изменении состояния авторизации
                    this.loadCart().then(() => {
                        this.renderCart();
                        this.updateCartCount();
                    });
                }
            });
        }
        
        // Также слушаем глобальные события (fallback)
        document.addEventListener('unifiedAuthStateChanged', (e) => {
            console.log('Cart: Global auth state changed:', e.detail);
            const { event } = e.detail;
            if (event === 'login' || event === 'logout') {
                this.loadCart().then(() => {
                    this.renderCart();
                    this.updateCartCount();
                });
            }
        });
    }

    async init() {
        await this.loadCart();
        this.renderCart();
        this.updateCartCount();
    }

    // Проверка авторизации
    isUserLoggedIn() {
        // Используем унифицированную систему аутентификации
        if (window.unifiedAuth && window.unifiedAuth.isAuthenticated()) {
            return true;
        }
        
        // Fallback: проверяем токен в localStorage
        const authToken = localStorage.getItem('authToken');
        return authToken !== null;
    }

    // Получение текущего пользователя
    getCurrentUser() {
        // Используем унифицированную систему аутентификации
        if (window.unifiedAuth && window.unifiedAuth.isAuthenticated()) {
            return window.unifiedAuth.getCurrentUser();
        }
        
        // Fallback: старая логика для совместимости
        const currentUser = localStorage.getItem('currentUser');
        return currentUser ? JSON.parse(currentUser) : null;
    }

    // Получение данных пользователя для создания заказа
    getCurrentUserData() {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('Пользователь не авторизован');
        }

        return {
            name: user.name || user.username || user.full_name || 'Пользователь',
            email: user.email,
            phone: user.phone || user.telephone || '',
            address: user.address || user.delivery_address || '',
            height: user.height || null,
            weight: user.weight || null
        };
    }

    // Загрузка корзины
    async loadCart() {
        console.log('=== Loading Cart ===');
        console.log('User logged in:', this.isUserLoggedIn());
        console.log('API authenticated:', window.apiClient?.isAuthenticated());
        
        if (this.isUserLoggedIn() && window.apiClient?.isAuthenticated()) {
            try {
                const response = await window.apiClient.getCart();
                console.log('Cart API response:', response);
                
                if (response.success && response.cart) {
                    // Преобразуем данные из API в формат, ожидаемый UI
                    this.cart = response.cart.map(item => ({
                        id: item.bike_id,
                        name: item.name,
                        brand: item.brand,
                        model: item.model,
                        price: item.price,
                        image: item.image,
                        category: item.category,
                        size: item.size,
                        quantity: item.quantity,
                        addedAt: item.added_at
                    }));
                    console.log('Processed cart data:', this.cart);
                } else {
                    this.cart = [];
                }
            } catch (error) {
                console.error('Error loading cart from API:', error);
                // Fallback to localStorage if API fails
                const userData = this.getCurrentUser();
                const userCart = localStorage.getItem(`cart_${userData.id}`);
                if (userCart) {
                    this.cart = JSON.parse(userCart);
                } else {
                    this.cart = [];
                }
            }
        } else {
            // Fallback to localStorage for non-authenticated users
            if (this.isUserLoggedIn()) {
                const userData = this.getCurrentUser();
                const userCart = localStorage.getItem(`cart_${userData.id}`);
                if (userCart) {
                    this.cart = JSON.parse(userCart);
                } else {
                    this.cart = [];
                }
            } else {
                this.cart = [];
            }
        }
    }

    // Сохранение корзины
    saveCart() {
        if (this.isUserLoggedIn()) {
            const userData = this.getCurrentUser();
            localStorage.setItem(`cart_${userData.id}`, JSON.stringify(this.cart));
        }
    }

    // Добавление товара в корзину
    async addToCart(product) {
        console.log('=== Adding to cart ===');
        console.log('Product:', product);
        
        // Sync API client token from localStorage
        if (window.apiClient) {
            window.apiClient.syncTokenFromStorage();
        }
        
        console.log('User logged in:', this.isUserLoggedIn());
        console.log('API authenticated:', window.apiClient?.isAuthenticated());
        
        // Проверка авторизации теперь происходит в catalog.js и product-detail.js
        // перед вызовом этой функции, поэтому здесь проверяем только на всякий случай
        if (!this.isUserLoggedIn()) {
            console.warn('Попытка добавить товар в корзину без авторизации');
            return false;
        }

        // Update local state immediately for better UX
        const existingItem = this.cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                ...product,
                quantity: 1,
                addedAt: new Date().toISOString()
            });
        }

        this.saveCart();
        this.renderCart();
        this.updateCartCount();
        this.showNotification('Велосипед добавлен в корзину');

        // Sync with database if user is authenticated
        console.log('=== Checking API sync conditions ===');
        console.log('User logged in:', this.isUserLoggedIn());
        console.log('API client exists:', !!window.apiClient);
        console.log('API authenticated:', window.apiClient?.isAuthenticated());
        
        if (this.isUserLoggedIn() && window.apiClient?.isAuthenticated()) {
            console.log('=== Starting API sync ===');
            try {
                console.log('=== Calling API addToCart ===');
                console.log('Product ID:', product.id);
                console.log('Product price:', product.price);
                const response = await window.apiClient.addToCart(product.id, 1, product.price);
                console.log('=== Add to cart API response ===');
                console.log('Response:', response);
                
                if (!response.success) {
                    console.error('Failed to add to cart via API');
                    // Reload cart to sync with server state
                    await this.loadCart();
                    this.renderCart();
                    this.updateCartCount();
                }
            } catch (error) {
                console.error('=== Add to cart API error ===');
                console.error('Error:', error);
                // Reload cart to sync with server state
                await this.loadCart();
                this.renderCart();
                this.updateCartCount();
                this.showNotification('Ошибка при добавлении товара', 'error');
            }
        } else {
            console.log('=== Skipping API sync ===');
            console.log('Reason: User not logged in or API not authenticated');
        }

        return true;
    }

    // Удаление товара из корзины
    async removeFromCart(productId) {
        console.log('=== Removing from cart ===');
        console.log('Product ID:', productId);
        console.log('User logged in:', this.isUserLoggedIn());
        console.log('API authenticated:', window.apiClient?.isAuthenticated());

        // Update local state immediately for better UX
        this.cart = this.cart.filter(item => item.id !== productId);
        this.renderCart();
        this.updateCartCount();
        this.showNotification('Товар удален из корзины');

        // Notify product detail page about cart change
        window.dispatchEvent(new CustomEvent('cartItemRemoved', { 
            detail: { productId: productId } 
        }));

        // Sync with database if user is authenticated
        if (this.isUserLoggedIn() && window.apiClient?.isAuthenticated()) {
            try {
                const response = await window.apiClient.removeFromCart(productId);
                console.log('=== Remove from cart API response ===');
                console.log('Response:', response);
                
                if (!response.success) {
                    console.error('Failed to remove from cart via API');
                    // Reload cart to sync with server state
                    await this.loadCart();
                    this.renderCart();
                    this.updateCartCount();
                }
            } catch (error) {
                console.error('=== Remove from cart API error ===');
                console.error('Error:', error);
                // Reload cart to sync with server state
                await this.loadCart();
                this.renderCart();
                this.updateCartCount();
                this.showNotification('Ошибка при удалении товара', 'error');
            }
        } else {
            // Fallback to localStorage for non-authenticated users
            this.saveCart();
        }
    }

    // Wrapper methods for event handlers (to handle async operations)
    handleUpdateQuantity(productId, newQuantity) {
        this.updateQuantity(productId, newQuantity).catch(error => {
            console.error('Error updating quantity:', error);
            this.showNotification('Ошибка при обновлении количества', 'error');
        });
    }

    handleRemoveFromCart(productId) {
        this.removeFromCart(productId).catch(error => {
            console.error('Error removing from cart:', error);
            this.showNotification('Ошибка при удалении товара', 'error');
        });
    }

    // Обновление количества товара
    async updateQuantity(productId, newQuantity) {
        console.log('=== Updating quantity ===');
        console.log('Product ID:', productId);
        console.log('New quantity:', newQuantity);
        console.log('User logged in:', this.isUserLoggedIn());
        console.log('API authenticated:', window.apiClient?.isAuthenticated());
        console.log('Token from localStorage:', localStorage.getItem('authToken') ? 'exists' : 'missing');
        console.log('API client token:', window.apiClient?.token ? 'exists' : 'missing');

        const item = this.cart.find(item => item.id === productId);
        if (!item) {
            console.log('Item not found in cart');
            return;
        }

        if (newQuantity <= 0) {
            // Remove item if quantity is 0 or negative
            await this.removeFromCart(productId);
            return;
        }

        // Update local state immediately for better UX
        item.quantity = newQuantity;
        this.renderCart();
        this.updateCartCount();

        // Sync with database if user is authenticated
        if (this.isUserLoggedIn() && window.apiClient?.isAuthenticated()) {
            try {
                const response = await window.apiClient.updateCartQuantity(productId, newQuantity);
                console.log('=== Update quantity API response ===');
                console.log('Response:', response);
                
                if (!response.success) {
                    console.error('Failed to update quantity via API');
                    // Reload cart to sync with server state
                    await this.loadCart();
                    this.renderCart();
                    this.updateCartCount();
                }
            } catch (error) {
                console.error('=== Update quantity API error ===');
                console.error('Error:', error);
                // Reload cart to sync with server state
                await this.loadCart();
                this.renderCart();
                this.updateCartCount();
                this.showNotification('Ошибка при обновлении количества', 'error');
            }
        } else {
            // Fallback to localStorage for non-authenticated users
            this.saveCart();
        }
    }

    // Очистка корзины
    clearCart() {
        this.cart = [];
        this.saveCart();
        this.renderCart();
        this.updateCartCount();
        this.showNotification('Корзина очищена');
    }

    // Отображение корзины
    renderCart() {
        console.log('=== RENDER CART DEBUG ===');
        const cartContainer = document.getElementById('cart-items-container');
        const cartLayout = document.querySelector('.cart-layout');
        const cartMain = document.querySelector('.cart-main');
        const cartSidebar = document.querySelector('.cart-sidebar');
        
        console.log('Cart container:', cartContainer);
        console.log('Cart layout:', cartLayout);
        console.log('Cart main:', cartMain);
        console.log('Cart sidebar:', cartSidebar);
        
        if (cartLayout) {
            const children = Array.from(cartLayout.children);
            console.log('Cart layout children order:', children.map(child => child.className));
            
            // Проверяем CSS order
            if (cartMain) {
                const mainOrder = window.getComputedStyle(cartMain).order;
                console.log('Cart main CSS order:', mainOrder);
            }
            if (cartSidebar) {
                const sidebarOrder = window.getComputedStyle(cartSidebar).order;
                console.log('Cart sidebar CSS order:', sidebarOrder);
            }
        }
        
        if (!cartContainer) return;

        if (this.cart.length === 0) {
            cartContainer.innerHTML = `
                <div class="cart-main">
                    <div class="empty-cart">
                        <i class="fas fa-shopping-cart"></i>
                        <h3>Корзина пуста</h3>
                        <p>Добавьте товары из каталога</p>
                        <a href="catalog.html" class="btn-primary">Перейти в каталог</a>
                    </div>
                </div>
            `;
            return;
        }

        const cartItemsHTML = this.cart.map(item => {
            const priceInfo = this.getPriceWithCurrency(item.price, item.priceEur);
            return `
            <div class="cart-item" data-id="${item.id}" onclick="simpleCartManager.navigateToProduct(${item.id})" style="cursor: pointer;">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="cart-item-content">
                    <div class="cart-item-info">
                        <h3 class="cart-item-name">${item.name}</h3>
                        <p class="cart-item-details">${item.brand} • ${item.category || 'Велосипед'}</p>
                        <div class="cart-item-price">${priceInfo}</div>
                    </div>
                </div>
                <div class="cart-item-actions" onclick="event.stopPropagation()">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="simpleCartManager.handleUpdateQuantity(${item.id}, ${item.quantity - 1})">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="quantity-input" value="${item.quantity}" 
                               onchange="simpleCartManager.handleUpdateQuantity(${item.id}, parseInt(this.value))" 
                               min="1" max="99">
                        <button class="quantity-btn" onclick="simpleCartManager.handleUpdateQuantity(${item.id}, ${item.quantity + 1})">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="remove-item" onclick="simpleCartManager.handleRemoveFromCart(${item.id})">
                        <i class="fas fa-trash"></i>
                        Удалить
                    </button>
                </div>
            </div>
        `;}).join('');

        const cartHTML = `
            <div class="cart-main">
                <div class="cart-items-header">
                    <h2 class="cart-items-title">Товары в корзине (${this.getTotalItems()})</h2>
                    <button class="clear-cart" onclick="simpleCartManager.clearCart()">
                        <i class="fas fa-trash"></i>
                        Очистить корзину
                    </button>
                </div>
                <div class="cart-items">
                    ${cartItemsHTML}
                </div>
            </div>
        `;

        cartContainer.innerHTML = cartHTML;
        this.renderCartSummary();
    }

    // Отображение итогов корзины
    renderCartSummary() {
        console.log('=== RENDER CART SUMMARY DEBUG ===');
        const summaryContainer = document.getElementById('cart-summary');
        console.log('Summary container:', summaryContainer);
        if (!summaryContainer) return;

        const subtotalInfo = this.calculateSubtotalWithCurrency();
        const itemsCount = this.getTotalItems();

        summaryContainer.innerHTML = `
            <div class="cart-summary-content">
                <h3 class="summary-title">
                    <i class="fas fa-shopping-cart"></i>
                    Итого по заказу
                </h3>
                <div class="summary-details">
                    <div class="summary-line">
                        <span>Товаров:</span>
                        <span class="summary-value">${itemsCount} шт.</span>
                    </div>
                    <div class="summary-line">
                        <span>Сумма:</span>
                        <span class="summary-value">${subtotalInfo}</span>
                    </div>
                    <div class="summary-line delivery-info">
                        <span>Доставка:</span>
                        <span class="summary-value free">Бесплатно</span>
                    </div>
                </div>
                <div class="summary-total">
                    <span>К оплате:</span>
                    <span class="total-amount">${subtotalInfo}</span>
                </div>
                <div class="summary-actions">
                    <button class="checkout-btn" onclick="simpleCartManager.proceedToCheckout()">
                        <i class="fas fa-credit-card"></i>
                        Оформить заказ
                    </button>
                    <button class="continue-shopping-btn" onclick="window.location.href='catalog.html'">
                        <i class="fas fa-arrow-left"></i>
                        Продолжить покупки
                    </button>
                </div>
            </div>
        `;
    }

    // Расчет общей суммы
    calculateSubtotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    // Расчет общей суммы с правильной валютой
    calculateSubtotalWithCurrency() {
        let totalRub = 0;
        let totalEur = 0;
        let hasEurItems = false;

        this.cart.forEach(item => {
            const quantity = item.quantity;
            totalRub += item.price * quantity;
            
            if (item.priceEur && item.priceEur > 0 && item.priceEur < item.price) {
                totalEur += item.priceEur * quantity;
                hasEurItems = true;
            }
        });

        // Если есть товары с ценой в евро, показываем евро
        if (hasEurItems && totalEur > 0) {
            return `${this.formatPrice(totalEur)} €`;
        }
        
        // Иначе показываем рубли
        return `${this.formatPrice(totalRub)} ₽`;
    }

    // Получение общего количества товаров
    getTotalItems() {
        return this.cart.reduce((total, item) => total + item.quantity, 0);
    }

    // Форматирование цены
    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU').format(Math.round(price));
    }

    getPriceWithCurrency(priceRub, priceEur) {
        // Если есть цена в евро и она меньше цены в рублях (что логично), показываем евро
        if (priceEur && priceEur > 0 && priceEur < priceRub) {
            return `${this.formatPrice(priceEur)} €`;
        }
        // Иначе показываем рубли
        return `${this.formatPrice(priceRub)} ₽`;
    }

    navigateToProduct(productId) {
        // Переход на страницу товара
        window.location.href = `product-detail.html?id=${productId}`;
    }

    // Обновление счетчика корзины в шапке
    updateCartCount() {
        const cartCountElements = document.querySelectorAll('.cart-count');
        const count = this.getTotalItems();
        
        cartCountElements.forEach(element => {
            element.textContent = count;
            element.style.display = count > 0 ? 'block' : 'none';
        });
    }

    // Проверка наличия товара в корзине
    isInCart(productId) {
        return this.cart.some(item => item.id === productId);
    }

    // Переход к оформлению заказа
    async proceedToCheckout() {
        if (this.cart.length === 0) {
            this.showNotification('Корзина пуста', 'error');
            return;
        }

        // Проверяем авторизацию пользователя
        if (!this.isUserLoggedIn()) {
            this.showNotification('Для оформления заказа необходимо войти в систему', 'error');
            // Перенаправляем на страницу входа
            window.location.href = 'index.html#login';
            return;
        }

        // Получаем кнопку и сохраняем оригинальный текст
        const checkoutBtn = document.querySelector('.checkout-btn');
        const originalText = checkoutBtn ? checkoutBtn.textContent : 'Оформить заказ';
        
        try {
            // Показываем индикатор загрузки
            if (checkoutBtn) {
                checkoutBtn.textContent = 'Создаем заказ...';
                checkoutBtn.disabled = true;
            }

            // Получаем данные авторизованного пользователя
            const userData = this.getCurrentUserData();
            
            // Подготавливаем данные клиента для CRM API
            const customerData = {
                name: userData.name || userData.username || 'Пользователь',
                email: userData.email,
                phone: userData.phone || '',
                address: userData.address || '',
                height: userData.height || null,
                weight: userData.weight || null,
                notes: '',
                contact_method: 'email',
                delivery_method: 'courier',
                payment_method: 'card',
                delivery_cost: 0
            };

            // Создаем заказ через CRM API (для авторизованных пользователей - без менеджера)
            const result = await this.createOrderFromCart(customerData, false);
            
            if (result && result.success) {
                this.showNotification(`Заказ успешно создан!`, 'success');
                
                // Перенаправляем на страницу подтверждения заказа
                setTimeout(() => {
                    window.location.href = `order-confirmation.html?order_id=${result.unified_id}`;
                }, 1500);
            } else {
                this.showNotification('Ошибка при создании заказа', 'error');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            this.showNotification('Ошибка при создании заказа: ' + error.message, 'error');
        } finally {
            // Восстанавливаем кнопку
            const checkoutBtn = document.querySelector('.checkout-btn');
            if (checkoutBtn) {
                checkoutBtn.textContent = originalText;
                checkoutBtn.disabled = false;
            }
        }
    }

    // ========================================
    // 🛒 АВТОМАТИЗИРОВАННОЕ СОЗДАНИЕ ЗАКАЗОВ
    // ========================================

    // Создание заказа из корзины (новая логика)
    async createOrderFromCart(customerData, needsManager = false) {
        try {
            console.log('🛒 Создаем заказ из корзины...');
            
            // Проверяем корзину
            if (this.cart.length === 0) {
                throw new Error('Корзина пуста');
            }

            // Берем первый товар (пока поддерживаем только один велосипед)
            const cartItem = this.cart[0];
            
            // Подготавливаем данные корзины для API
            const cartData = {
                bike_url: cartItem.url || window.location.href,
                bike_type: cartItem.type || cartItem.category || 'unknown',
                bike_brand: cartItem.brand || 'unknown',
                bike_model: cartItem.model || cartItem.name,
                bike_size: cartItem.size || 'universal',
                bike_color: cartItem.color || 'default',
                bike_price: cartItem.price,
                quantity: cartItem.quantity || 1,
                specifications: cartItem.specifications || {},
                notes: customerData.notes || '',
                delivery_method: customerData.delivery_method || 'courier',
                payment_method: customerData.payment_method || 'card',
                delivery_cost: customerData.delivery_cost || 0,
                bike_weight: cartItem.weight || 15,
                bike_dimensions: cartItem.dimensions || '180x70x30'
            };

            // Инициализируем CRM API
            if (!window.crmApi) {
                if (typeof initializeCRM === 'function') {
                    initializeCRM();
                } else {
                    throw new Error('CRM API not available');
                }
            }

            // Создаем заказ через CRM API
            const result = await window.crmApi.createOrderFromCart(cartData, customerData, needsManager);
            
            if (result.success) {
                console.log('✅ Заказ успешно создан:', result);
                
                // Очищаем корзину
                this.clearCart();
                
                // Показываем уведомление об успехе
                this.showNotification(
                    needsManager ? 
                    'Заказ создан! Менеджер свяжется с вами в ближайшее время.' : 
                    'Заказ создан! Вы можете отслеживать его статус в личном кабинете.',
                    'success'
                );

                // Перенаправляем на страницу подтверждения заказа
                setTimeout(() => {
                    window.location.href = `order-confirmation.html?order_id=${result.unified_id}`;
                }, 2000);

                return result;
            } else {
                throw new Error('Не удалось создать заказ');
            }

        } catch (error) {
            console.error('💥 Ошибка создания заказа:', error);
            this.showNotification('Ошибка создания заказа: ' + error.message, 'error');
            throw error;
        }
    }

    // Обработка формы гостевого заказа
    async handleGuestOrder(formData, needsManager = false) {
        try {
            // Подготавливаем данные клиента
            const customerData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                address: formData.get('address'),
                height: formData.get('height'),
                weight: formData.get('weight'),
                notes: formData.get('notes'),
                contact_method: formData.get('contact_method') || 'email',
                delivery_method: formData.get('delivery_method') || 'courier',
                payment_method: formData.get('payment_method') || 'card',
                delivery_cost: parseFloat(formData.get('delivery_cost')) || 0
            };

            // Создаем заказ
            return await this.createOrderFromCart(customerData, needsManager);

        } catch (error) {
            console.error('Ошибка обработки гостевого заказа:', error);
            throw error;
        }
    }

    // Синхронизация состояния кнопок в каталоге
    syncButtonStates() {
        if (!this.cart || !Array.isArray(this.cart)) return;
        
        // Получаем все кнопки добавления в корзину в каталоге
        const cartButtons = document.querySelectorAll('.btn-add-cart-full');
        
        cartButtons.forEach(button => {
            // Получаем ID товара из onclick атрибута
            const onclickAttr = button.getAttribute('onclick');
            if (!onclickAttr) return;
            
            const match = onclickAttr.match(/catalog\.addToCart\((\d+)\)/);
            if (!match) return;
            
            const productId = parseInt(match[1]);
            const isInCart = this.isInCart(productId);
            
            if (isInCart) {
                // Устанавливаем состояние "В корзине"
                button.classList.add('in-cart');
                button.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    В корзине. Перейти в корзину
                `;
                
                // Заменяем обработчик клика
                button.setAttribute('onclick', `event.stopPropagation(); window.location.href='cart.html'`);
            } else {
                // Возвращаем исходное состояние
                button.classList.remove('in-cart');
                button.innerHTML = `
                    <i class="fas fa-shopping-cart"></i>
                    В корзину
                `;
                
                // Восстанавливаем исходный обработчик
                button.setAttribute('onclick', `event.stopPropagation(); catalog.addToCart(${productId})`);
            }
        });
    }

    // Показ уведомлений
    showNotification(message, type = 'success') {
        // Удаляем существующие уведомления
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Создаем новое уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        // Показываем уведомление
        setTimeout(() => notification.classList.add('show'), 100);

        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Стили для уведомлений
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10000;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 300px;
    }

    .notification.show {
        transform: translateX(0);
        opacity: 1;
    }

    .notification-success {
        border-left: 4px solid #28a745;
    }

    .notification-error {
        border-left: 4px solid #dc3545;
    }

    .notification i {
        font-size: 18px;
    }

    .notification-success i {
        color: #28a745;
    }

    .notification-error i {
        color: #dc3545;
    }

    .empty-cart {
        text-align: center;
        padding: 60px 20px;
        color: #666;
    }

    .empty-cart i {
        font-size: 64px;
        margin-bottom: 20px;
        color: #ddd;
    }

    .empty-cart h3 {
        margin-bottom: 10px;
        font-size: 24px;
    }

    .empty-cart p {
        margin-bottom: 30px;
        font-size: 16px;
    }



    .cart-summary-content {
        background: white;
        padding: 30px;
        border-radius: 8px;
        border: 1px solid #eee;
    }

    .summary-line {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        padding: 5px 0;
    }

    .summary-total {
        display: flex;
        justify-content: space-between;
        font-weight: 600;
        font-size: 18px;
        padding: 15px 0;
        border-top: 1px solid #eee;
        margin: 15px 0;
    }

    .checkout-btn, .clear-cart-btn {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 10px;
    }

    .checkout-btn {
        background: #007bff;
        color: white;
    }

    .checkout-btn:hover {
        background: #0056b3;
    }

    .clear-cart-btn {
        background: #6c757d;
        color: white;
    }

    .clear-cart-btn:hover {
        background: #545b62;
    }
`;

// Добавляем стили
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Создание экземпляра менеджера корзины после загрузки DOM
document.addEventListener('DOMContentLoaded', async function() {
    // Ждем готовности унифицированной системы
    const waitForUnifiedSystem = () => {
        return new Promise((resolve) => {
            if (window.unifiedAuth) {
                resolve();
            } else {
                // Слушаем событие готовности системы
                document.addEventListener('unifiedSystemReady', resolve, { once: true });
                
                // Fallback: проверяем каждые 100ms в течение 5 секунд
                let attempts = 0;
                const maxAttempts = 50;
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (window.unifiedAuth || attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    };
    
    await waitForUnifiedSystem();
    
    const simpleCartManager = new SimpleCartManager();
    window.simpleCartManager = simpleCartManager;
    
    // Инициализация может быть асинхронной, поэтому ждем её завершения
    try {
        await simpleCartManager.init();
    } catch (error) {
        console.error('Error initializing cart manager:', error);
    }
});