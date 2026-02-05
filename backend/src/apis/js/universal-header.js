/**
 * Universal Header Loader
 * Загружает хедер и интегрирует его с системой аутентификации
 * Автор: Senior UI/UX Designer & Backend Lead
 */

class UniversalHeaderLoader {
    constructor() {
        this.basePath = this.getBasePath();
        this.isLoaded = false;
        this.currentUser = null;
        this.authManager = null;
        
        console.log('🏗️ Universal Header Loader initialized');
        this.init();
    }

    getBasePath() {
        const currentPath = window.location.pathname;
        const depth = (currentPath.match(/\//g) || []).length - 1;
        
        if (depth === 0 || currentPath.includes('index.html') || currentPath === '/') {
            return './';
        } else {
            return '../'.repeat(depth);
        }
    }

    async init() {
        if (this.isLoaded) return;

        try {
            console.log('🔄 Initializing header...');
            
            // Ждем готовности DOM
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Создаем хедер напрямую в placeholder
            await this.createHeader();
            
            // Подключаемся к системе аутентификации
            this.setupAuthIntegration();
            
            this.isLoaded = true;
            console.log('✅ Universal header loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading universal header:', error);
            this.createFallbackHeader();
        }
    }

    async createHeader() {
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (!headerPlaceholder) {
            console.warn('⚠️ Header placeholder not found');
            return;
        }

        const headerHTML = this.generateHeaderHTML();
        headerPlaceholder.innerHTML = headerHTML;
        
        // Добавляем отступ для основного контента
        this.adjustMainContentMargin();
        
        // Настраиваем обработчики событий
        this.setupHeaderEventListeners();
        
        console.log('✅ Header created successfully');
    }

    generateHeaderHTML() {
        return `
            <header class="header" id="main-header">
                <div class="header-container">
                    <div class="header-logo">
                        <a href="${this.basePath}index.html" class="logo-link">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="16" cy="16" r="16" fill="#007bff"/>
                                <path d="M8 16h16M16 8v16" stroke="white" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            <span class="logo-text">BikeEU</span>
                        </a>
                    </div>
                    
                    <nav class="header-nav" aria-label="Основная навигация">
                        <a href="${this.basePath}index.html" class="nav-link">Главная</a>
                        <a href="${this.basePath}catalog.html" class="nav-link">Каталог</a>
                        <a href="${this.basePath}bike-selection.html" class="nav-link">Подбор</a>
                        <a href="${this.basePath}calculator.html" class="nav-link">Калькулятор</a>
                        <a href="${this.basePath}cart.html" class="nav-link">
                            <span>Корзина</span>
                            <span class="cart-count" id="cart-count" style="display: none;">0</span>
                        </a>
                    </nav>
                    
                    <div class="header-actions">
                        <div class="auth-section" id="auth-section">
                            <button class="btn btn-primary login-btn" id="login-btn" onclick="showLoginModal()">
                                Войти
                            </button>
                            <div class="user-menu" id="user-menu" style="display: none;">
                                <button class="user-menu-trigger" id="user-menu-trigger">
                                    <span class="user-name" id="user-name">Пользователь</span>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    </svg>
                                </button>
                                <div class="user-dropdown" id="user-dropdown">
                                    <a href="${this.basePath}profile.html" class="dropdown-item">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>
                                            <path d="M2 14c0-3.5 2.5-6 6-6s6 2.5 6 6" stroke="currentColor" stroke-width="1.5"/>
                                        </svg>
                                        Профиль
                                    </a>
                                    <a href="${this.basePath}favorites.html" class="dropdown-item">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M8 2.5l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-.5L8 2.5z" stroke="currentColor" stroke-width="1.5"/>
                                        </svg>
                                        Избранное
                                    </a>
                                    <a href="${this.basePath}cart.html" class="dropdown-item">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M2 2h2l1.5 7h7l1.5-4H5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                                            <circle cx="6" cy="13" r="1" stroke="currentColor" stroke-width="1.5"/>
                                            <circle cx="12" cy="13" r="1" stroke="currentColor" stroke-width="1.5"/>
                                        </svg>
                                        Корзина
                                    </a>
                                    <hr class="dropdown-divider">
                                    <button class="dropdown-item logout-btn" id="logout-btn">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 6l4 2-4 2M14 8H6" stroke="currentColor" stroke-width="1.5"/>
                                        </svg>
                                        Выйти
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Открыть меню">
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>
                    </div>
                </div>
                
                <!-- Мобильное меню -->
                <div class="mobile-menu" id="mobile-menu">
                    <nav class="mobile-nav">
                        <a href="${this.basePath}index.html" class="mobile-nav-link">Главная</a>
                        <a href="${this.basePath}catalog.html" class="mobile-nav-link">Каталог</a>
                        <a href="${this.basePath}bike-selection.html" class="mobile-nav-link">Подбор</a>
                        <a href="${this.basePath}calculator.html" class="mobile-nav-link">Калькулятор</a>
                        <a href="${this.basePath}cart.html" class="mobile-nav-link">Корзина</a>
                    </nav>
                </div>
            </header>
        `;
    }

    setupHeaderEventListeners() {
        // Мобильное меню
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (mobileToggle && mobileMenu) {
            mobileToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('active');
                mobileToggle.classList.toggle('active');
            });
        }

        // Выпадающее меню пользователя
        const userMenuTrigger = document.getElementById('user-menu-trigger');
        const userDropdown = document.getElementById('user-dropdown');
        
        if (userMenuTrigger && userDropdown) {
            userMenuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });

            // Закрытие при клике вне меню
            document.addEventListener('click', () => {
                userDropdown.classList.remove('active');
            });
        }

        // Кнопка выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        console.log('✅ Header event listeners setup complete');
    }

    setupAuthIntegration() {
        // Слушаем события системы аутентификации
        document.addEventListener('unifiedSystemReady', () => {
            if (window.unifiedAuth) {
                this.authManager = window.unifiedAuth;
                this.authManager.addListener((event, data) => {
                    this.handleAuthStateChange(event, data);
                });
                
                // Обновляем UI на основе текущего состояния
                this.updateAuthUI();
                console.log('✅ Auth integration setup complete');
            }
        });

        // Если система уже готова
        if (window.unifiedAuth) {
            this.authManager = window.unifiedAuth;
            this.authManager.addListener((event, data) => {
                this.handleAuthStateChange(event, data);
            });
            this.updateAuthUI();
        }
    }

    handleAuthStateChange(event, data) {
        console.log('🔄 Auth state changed:', event, data);
        
        switch (event) {
            case 'login':
                this.currentUser = data;
                this.showUserMenu();
                this.showNotification('Добро пожаловать!', 'success');
                break;
            case 'logout':
                this.currentUser = null;
                this.showLoginButton();
                this.showNotification('Вы вышли из аккаунта', 'info');
                break;
            case 'error':
                this.showNotification(data.message || 'Произошла ошибка', 'error');
                break;
        }
    }

    updateAuthUI() {
        if (this.authManager && this.authManager.user) {
            this.currentUser = this.authManager.user;
            this.showUserMenu();
        } else {
            this.showLoginButton();
        }
    }

    showLoginButton() {
        const loginBtn = document.getElementById('login-btn');
        const userMenu = document.getElementById('user-menu');
        
        if (loginBtn && userMenu) {
            loginBtn.style.display = 'block';
            userMenu.style.display = 'none';
        }
    }

    showUserMenu() {
        const loginBtn = document.getElementById('login-btn');
        const userMenu = document.getElementById('user-menu');
        const userName = document.getElementById('user-name');
        
        if (loginBtn && userMenu && userName && this.currentUser) {
            loginBtn.style.display = 'none';
            userMenu.style.display = 'block';
            userName.textContent = this.currentUser.name || 'Пользователь';
        }
    }

    async handleLogout() {
        if (this.authManager) {
            try {
                await this.authManager.logout();
            } catch (error) {
                console.error('Logout error:', error);
                this.showNotification('Ошибка при выходе', 'error');
            }
        }
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Добавляем стили если их нет
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 100px;
                    right: 20px;
                    z-index: 10000;
                    padding: 12px 16px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    animation: slideIn 0.3s ease-out;
                    max-width: 300px;
                }
                .notification-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .notification-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .notification-info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
                .notification-content { display: flex; justify-content: space-between; align-items: center; }
                .notification-close { background: none; border: none; font-size: 18px; cursor: pointer; margin-left: 10px; }
                @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    async loadLoginOverlayHTML() {
        try {
            const response = await fetch(this.basePath + 'src/components/ui/login-overlay.html');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const overlayHTML = await response.text();
            
            // Insert overlay at the end of body
            document.body.insertAdjacentHTML('beforeend', overlayHTML);
            
        } catch (error) {
            console.error('Error loading login overlay HTML:', error);
            throw error;
        }
    }

    async loadJavaScript() {
        const jsFiles = [
            'src/js/api-client.js',
            'src/js/global-auth.js',
            'src/js/login-overlay.js',
            'src/js/header.js'
        ];

        for (const jsFile of jsFiles) {
            if (!document.querySelector(`script[src*="${jsFile}"]`)) {
                await this.loadScript(this.basePath + jsFile);
            }
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    adjustMainContentMargin() {
        // Add margin to main content to account for fixed header
        const mainContent = document.querySelector('#main-content, main, .main-content');
        if (mainContent) {
            mainContent.style.marginTop = '80px';
        } else {
            // If no main content found, add margin to body
            document.body.style.paddingTop = '80px';
        }
    }

    createFallbackHeader() {
        const fallbackHTML = `
            <header class="header" style="background: #fff; padding: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: fixed; top: 0; left: 0; right: 0; z-index: 1000;">
                <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <a href="${this.basePath}index.html" style="font-size: 1.5rem; font-weight: bold; text-decoration: none; color: #333;">BikeEU</a>
                    <nav style="display: flex; gap: 2rem;">
                        <a href="${this.basePath}index.html" style="text-decoration: none; color: #333;">Главная</a>
                        <a href="${this.basePath}catalog.html" style="text-decoration: none; color: #333;">Каталог</a>
                        <a href="${this.basePath}calculator.html" style="text-decoration: none; color: #333;">Калькулятор</a>
                        <a href="${this.basePath}cart.html" style="text-decoration: none; color: #333;">Корзина</a>
                    </nav>
                    <button style="padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="alert('Функция входа временно недоступна')">Войти</button>
                </div>
            </header>
        `;
        
        const skipLink = document.querySelector('.skip-link');
        if (skipLink) {
            skipLink.insertAdjacentHTML('afterend', fallbackHTML);
        } else {
            document.body.insertAdjacentHTML('afterbegin', fallbackHTML);
        }
        
        this.adjustMainContentMargin();
    }
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.universalHeaderLoader = new UniversalHeaderLoader();
    });
} else {
    window.universalHeaderLoader = new UniversalHeaderLoader();
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalHeaderLoader;
}