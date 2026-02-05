/**
 * Unified System Loader
 * Централизованная система загрузки всех компонентов сайта
 * Автор: Senior UI/UX Designer & Backend Lead
 */

class UnifiedSystemLoader {
    constructor() {
        this.isLoaded = false;
        this.components = {
            header: null,
            auth: null,
            loginOverlay: null
        };
        this.basePath = this.getBasePath();
        
        console.log('🚀 Unified System Loader initialized');
        console.log('📁 Base path:', this.basePath);
        
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
        if (this.isLoaded) {
            console.log('⚠️ System already loaded');
            return;
        }

        try {
            console.log('🔄 Loading unified system...');
            
            // 1. Загружаем CSS стили
            await this.loadStyles();
            
            // 2. Загружаем API клиент
            await this.loadAPIClient();
            
            // 3. Загружаем систему аутентификации
            await this.loadAuthSystem();
            
            // 4. Загружаем хедер
            await this.loadHeader();
            
            // 5. Загружаем оверлей входа
            await this.loadLoginOverlay();
            
            // 6. Инициализируем все компоненты
            await this.initializeComponents();
            
            this.isLoaded = true;
            
            // Уведомляем о готовности системы
            this.dispatchSystemReady();
            
            console.log('✅ Unified system loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading unified system:', error);
            this.createFallbackHeader();
        }
    }

    async loadStyles() {
        console.log('🎨 Loading styles...');
        
        const styles = [
            `${this.basePath}src/styles/header.css`,
            `${this.basePath}src/styles/login-overlay.css`
        ];

        for (const styleUrl of styles) {
            try {
                await this.loadCSS(styleUrl);
                console.log(`✅ Loaded: ${styleUrl}`);
            } catch (error) {
                console.warn(`⚠️ Failed to load: ${styleUrl}`, error);
            }
        }
    }

    async loadCSS(url) {
        return new Promise((resolve, reject) => {
            // Проверяем, не загружен ли уже этот CSS
            const existingLink = document.querySelector(`link[href="${url}"]`);
            if (existingLink) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    async loadScript(url) {
        return new Promise((resolve, reject) => {
            // Проверяем, не загружен ли уже этот скрипт по полному пути или относительному
            const scriptName = url.split('/').pop();
            const existingScript = document.querySelector(`script[src*="${scriptName}"]`);
            if (existingScript) {
                console.log(`⚠️ Script ${scriptName} already loaded, skipping`);
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async loadAPIClient() {
        console.log('🔌 Loading API client...');
        try {
            // Проверяем, не загружен ли уже API клиент
            if (window.APIClient && window.apiClient) {
                console.log('✅ API client already loaded');
                return;
            }
            
            await this.loadScript(`${this.basePath}src/js/api-client.js`);
            console.log('✅ API client loaded');
        } catch (error) {
            console.error('❌ Failed to load API client:', error);
            throw error;
        }
    }

    async loadAuthSystem() {
        console.log('🔐 Loading authentication system...');
        try {
            // Проверяем, не загружена ли уже система аутентификации
            if (window.unifiedAuth) {
                console.log('✅ Auth system already loaded');
                return;
            }
            
            await this.loadScript(`${this.basePath}src/js/global-auth.js`);
            console.log('✅ Auth system loaded');
        } catch (error) {
            console.error('❌ Failed to load auth system:', error);
            throw error;
        }
    }

    async loadHeader() {
        console.log('📋 Loading header...');
        try {
            // Загружаем modern header вместо universal
            await this.loadScript(`${this.basePath}src/js/modern-header-loader.js`);
            console.log('✅ Header loaded');
        } catch (error) {
            console.error('❌ Failed to load header:', error);
            throw error;
        }
    }

    async loadLoginOverlay() {
        console.log('🔑 Loading login overlay...');
        try {
            await this.loadScript(`${this.basePath}src/js/login-overlay.js`);
            console.log('✅ Login overlay loaded');
        } catch (error) {
            console.error('❌ Failed to load login overlay:', error);
            throw error;
        }
    }

    async initializeComponents() {
        console.log('⚙️ Initializing components...');
        
        // Ждем, пока DOM будет готов
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Инициализируем API клиент
        if (window.APIClient) {
            window.apiClient = new window.APIClient();
            console.log('✅ API client initialized');
        }

        // Инициализируем систему аутентификации
        if (window.UnifiedAuthManager) {
            window.unifiedAuth = new window.UnifiedAuthManager();
            console.log('✅ Auth manager initialized');
        }

        // Инициализируем хедер
        if (window.modernHeaderLoader) {
            window.unifiedHeader = window.modernHeaderLoader;
            console.log('✅ Header initialized');
        } else if (window.ModernHeaderLoader) {
            window.unifiedHeader = new window.ModernHeaderLoader();
            console.log('✅ Header initialized');
        }

        // Инициализируем оверлей входа
        if (window.LoginOverlayManager) {
            window.unifiedLogin = new window.LoginOverlayManager();
            console.log('✅ Login overlay initialized');
        } else if (window.loginOverlayManager) {
            // Если уже инициализирован в login-overlay.js
            window.unifiedLogin = window.loginOverlayManager;
            console.log('✅ Login overlay found and linked');
        }

        console.log('✅ All components initialized');
    }

    dispatchSystemReady() {
        const event = new CustomEvent('unifiedSystemReady', {
            detail: {
                components: this.components,
                loader: this
            }
        });
        document.dispatchEvent(event);
        console.log('📢 System ready event dispatched');
    }

    createFallbackHeader() {
        console.log('🆘 Creating fallback header...');
        
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = `
                <header class="header fallback-header" style="
                    background: #fff; 
                    padding: 1rem 0; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
                    position: fixed; 
                    top: 0; 
                    left: 0; 
                    right: 0; 
                    z-index: 1000;
                ">
                    <div class="container" style="max-width: 1200px; margin: 0 auto; padding: 0 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div class="logo">
                            <a href="index.html" style="font-size: 1.5rem; font-weight: bold; color: #333; text-decoration: none;">BikeEU</a>
                        </div>
                        <nav style="display: flex; gap: 2rem; align-items: center;">
                            <a href="catalog.html" style="color: #333; text-decoration: none;">Каталог</a>
                            <a href="calculator.html" style="color: #333; text-decoration: none;">Калькулятор</a>
                            <a href="cart.html" style="color: #333; text-decoration: none;">Корзина</a>
                            <button onclick="alert('Система загружается...')" style="
                                background: #007bff; 
                                color: white; 
                                border: none; 
                                padding: 0.5rem 1rem; 
                                border-radius: 4px; 
                                cursor: pointer;
                            ">Войти</button>
                        </nav>
                    </div>
                </header>
            `;
            
            // Добавляем отступ для body
            document.body.style.paddingTop = '80px';
        }
    }
}

// Автоматическая инициализация при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.unifiedSystemLoader = new UnifiedSystemLoader();
    });
} else {
    window.unifiedSystemLoader = new UnifiedSystemLoader();
}

// Экспортируем для использования в других модулях
window.UnifiedSystemLoader = UnifiedSystemLoader;