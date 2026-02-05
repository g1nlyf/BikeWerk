/**
 * Modern Header Loader
 * Универсальный загрузчик для нового современного хедера
 */

class ModernHeaderLoader {
    constructor() {
        this.basePath = this.getBasePath();
        this.isLoaded = false;
    }

    getBasePath() {
        const currentPath = window.location.pathname;
        const depth = (currentPath.match(/\//g) || []).length - 1;
        return depth > 0 ? '../'.repeat(depth) : './';
    }

    async loadHeader() {
        if (this.isLoaded) {
            console.log('🔄 Modern header already loaded');
            return;
        }

        try {
            console.log('🏗️ Loading modern header...');
            
            const headerPlaceholder = document.getElementById('modern-header-placeholder');
            if (!headerPlaceholder) {
                console.error('❌ Modern header placeholder not found');
                return;
            }

            // Загружаем HTML хедера
            const response = await fetch(this.basePath + 'src/components/ui/modern-header.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const headerHTML = await response.text();
            headerPlaceholder.innerHTML = headerHTML;

            // Инициализируем хедер после загрузки
            if (window.ModernHeaderManager) {
                // Если класс уже доступен, создаем экземпляр
                window.modernHeaderManager = new window.ModernHeaderManager();
                console.log('✅ Modern header loaded and initialized successfully');
            } else {
                // Если класс еще не загружен, ждем его загрузки
                const checkForManager = setInterval(() => {
                    if (window.ModernHeaderManager) {
                        window.modernHeaderManager = new window.ModernHeaderManager();
                        console.log('✅ Modern header loaded and initialized successfully (delayed)');
                        clearInterval(checkForManager);
                    }
                }, 100);
                
                // Таймаут на случай, если класс не загрузится
                setTimeout(() => {
                    clearInterval(checkForManager);
                    console.warn('⚠️ ModernHeaderManager class not found after timeout');
                }, 5000);
            }

            this.isLoaded = true;

        } catch (error) {
            console.error('❌ Error loading modern header:', error);
        }
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.loadHeader());
        } else {
            this.loadHeader();
        }
    }
}

// Создаем глобальный экземпляр
window.modernHeaderLoader = new ModernHeaderLoader();

// Автоматическая инициализация
window.modernHeaderLoader.init();

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernHeaderLoader;
}