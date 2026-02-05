/**
 * FavoritesManager - Класс для управления системой избранного
 * Обеспечивает синхронизацию между клиентом и сервером, кеширование и обновление UI
 */
class FavoritesManager {
    constructor() {
        this.favorites = new Set();
        this.favoriteCounts = new Map();
        this.isInitialized = false;
        this.eventListeners = new Map();
        this.cache = {
            favorites: null,
            lastUpdate: null,
            ttl: 5 * 60 * 1000 // 5 минут
        };
        
        // Инициализация при создании
        this.init();
    }

    /**
     * Инициализация менеджера избранного
     */
    async init() {
        try {
            // Загружаем данные из localStorage
            this.loadFromCache();
            
            // Если пользователь авторизован, синхронизируем с сервером
            if (this.isUserAuthenticated()) {
                await this.syncWithServer();
            }
            
            this.isInitialized = true;
            this.emit('initialized');
        } catch (error) {
            console.error('Ошибка инициализации FavoritesManager:', error);
        }
    }

    /**
     * Проверка авторизации пользователя
     */
    isUserAuthenticated() {
        const token = localStorage.getItem('authToken');
        return token && token !== 'null' && token !== '';
    }

    /**
     * Алиас для isUserAuthenticated (для совместимости)
     */
    isAuthenticated() {
        return this.isUserAuthenticated();
    }

    /**
     * Получение токена авторизации
     */
    getAuthToken() {
        return localStorage.getItem('authToken');
    }

    /**
     * Синхронизация с сервером
     */
    async syncWithServer() {
        if (!this.isUserAuthenticated()) {
            return;
        }

        try {
            const response = await fetch('/api/favorites', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateFavoritesFromServer(data.favorites || []);
                this.saveToCache();
            }
        } catch (error) {
            console.error('Ошибка синхронизации с сервером:', error);
        }
    }

    /**
     * Обновление избранного из данных сервера
     */
    updateFavoritesFromServer(serverFavorites) {
        this.favorites.clear();
        this.favoriteCounts.clear();

        serverFavorites.forEach(item => {
            this.favorites.add(item.id);
            this.favoriteCounts.set(item.id, item.total_favorites || 0);
        });

        this.emit('favoritesUpdated');
    }

    /**
     * Добавление товара в избранное
     */
    async addToFavorites(bikeId) {
        if (!this.isUserAuthenticated()) {
            // Для гостевых пользователей - добавляем локально
            return this.addToLocalFavorites(bikeId);
        }

        try {
            const response = await fetch('/api/favorites/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({ bikeId: parseInt(bikeId) })
            });

            const data = await response.json();

            if (response.ok) {
                this.favorites.add(parseInt(bikeId));
                this.favoriteCounts.set(parseInt(bikeId), data.favoritesCount || 0);
                this.saveToCache();
                this.emit('favoriteAdded', { bikeId, count: data.favoritesCount });
                this.showNotification('Товар добавлен в избранное', 'success');
                return true;
            } else {
                this.showNotification(data.error || 'Ошибка при добавлении в избранное', 'error');
                return false;
            }
        } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
            return false;
        }
    }

    /**
     * Добавление в локальное избранное (для гостей)
     */
    addToLocalFavorites(bikeId) {
        try {
            this.favorites.add(parseInt(bikeId));
            this.saveToCache();
            this.emit('favoriteAdded', { bikeId, isLocal: true });
            this.showNotification('Товар добавлен в избранное (локально)', 'success');
            this.showAuthPrompt();
            return true;
        } catch (error) {
            console.error('Ошибка добавления в локальное избранное:', error);
            return false;
        }
    }

    /**
     * Удаление товара из избранного
     */
    async removeFromFavorites(bikeId) {
        if (!this.isUserAuthenticated()) {
            // Для гостевых пользователей - удаляем локально
            return this.removeFromLocalFavorites(bikeId);
        }

        try {
            const response = await fetch(`/api/favorites/remove/${bikeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.favorites.delete(parseInt(bikeId));
                this.favoriteCounts.set(parseInt(bikeId), data.favoritesCount || 0);
                this.saveToCache();
                this.emit('favoriteRemoved', { bikeId, count: data.favoritesCount });
                this.showNotification('Товар удален из избранного', 'info');
                return true;
            } else {
                this.showNotification(data.error || 'Ошибка при удалении из избранного', 'error');
                return false;
            }
        } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
            return false;
        }
    }

    /**
     * Удаление из локального избранного (для гостей)
     */
    removeFromLocalFavorites(bikeId) {
        try {
            this.favorites.delete(parseInt(bikeId));
            this.saveToCache();
            this.emit('favoriteRemoved', { bikeId, isLocal: true });
            this.showNotification('Товар удален из избранного', 'info');
            return true;
        } catch (error) {
            console.error('Ошибка удаления из локального избранного:', error);
            return false;
        }
    }

    /**
     * Переключение статуса избранного
     */
    async toggleFavorite(bikeId) {
        const isInFavorites = this.isFavorite(bikeId);
        
        if (isInFavorites) {
            return await this.removeFromFavorites(bikeId);
        } else {
            return await this.addToFavorites(bikeId);
        }
    }

    /**
     * Проверка, находится ли товар в избранном
     */
    isFavorite(bikeId) {
        return this.favorites.has(parseInt(bikeId));
    }

    /**
     * Получение количества избранных для товара
     */
    getFavoriteCount(bikeId) {
        return this.favoriteCounts.get(parseInt(bikeId)) || 0;
    }

    /**
     * Получение общего количества избранных товаров пользователя
     */
    getTotalFavoritesCount() {
        return this.favorites.size;
    }

    /**
     * Получение массива ID избранных товаров
     */
    getFavoriteIds() {
        return Array.from(this.favorites);
    }

    /**
     * Получение списка избранных товаров
     */
    async getFavoritesList(options = {}) {
        if (!this.isUserAuthenticated()) {
            return [];
        }

        try {
            const params = new URLSearchParams();
            if (options.page) params.append('page', options.page);
            if (options.limit) params.append('limit', options.limit);
            if (options.sort) params.append('sort', options.sort);

            const response = await fetch(`/api/favorites?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('Ошибка получения списка избранного:', error);
        }

        return { favorites: [], pagination: { total: 0 } };
    }

    /**
     * Получение статистики избранного
     */
    async getFavoritesStats() {
        if (!this.isUserAuthenticated()) {
            return null;
        }

        try {
            const response = await fetch('/api/favorites/stats', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.stats;
            }
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
        }

        return null;
    }

    /**
     * Обновление UI элементов избранного
     */
    updateFavoriteButtons() {
        const favoriteButtons = document.querySelectorAll('[data-favorite-btn]');
        
        favoriteButtons.forEach(button => {
            const bikeId = button.dataset.bikeId || button.dataset.favoriteBtn;
            if (bikeId) {
                this.updateFavoriteButton(button, bikeId);
            }
        });

        // Обновляем счетчики
        this.updateFavoriteCounts();
        this.updateHeaderCounter();
    }

    /**
     * Обновление отдельной кнопки избранного
     */
    updateFavoriteButton(button, bikeId) {
        const isInFavorites = this.isFavorite(bikeId);
        
        button.classList.toggle('active', isInFavorites);
        button.classList.toggle('in-favorites', isInFavorites);
        
        // Обновляем иконку и текст
        const icon = button.querySelector('i, .icon');
        const text = button.querySelector('.text, span:not(.icon)');
        
        if (icon) {
            icon.className = isInFavorites ? 'fas fa-heart' : 'far fa-heart';
        }
        
        if (text) {
            text.textContent = isInFavorites ? 'В избранном' : 'В избранное';
        }

        // Обновляем title
        button.title = isInFavorites ? 'Удалить из избранного' : 'Добавить в избранное';
    }

    /**
     * Обновление счетчиков избранного
     */
    updateFavoriteCounts() {
        const countElements = document.querySelectorAll('[data-favorite-count]');
        
        countElements.forEach(element => {
            const bikeId = element.dataset.bikeId || element.dataset.favoriteCount;
            if (bikeId) {
                const count = this.getFavoriteCount(bikeId);
                element.textContent = count;
                element.style.display = count > 0 ? 'inline' : 'none';
            }
        });
    }

    /**
     * Обновление счетчика в хедере
     */
    updateHeaderCounter() {
        const headerCounter = document.querySelector('.favorites-counter, [data-favorites-counter]');
        if (headerCounter) {
            const count = this.getTotalFavoritesCount();
            headerCounter.textContent = count;
            headerCounter.style.display = count > 0 ? 'inline' : 'none';
        }
    }

    /**
     * Инициализация обработчиков событий для кнопок избранного
     */
    initEventListeners() {
        // Делегирование событий для кнопок избранного
        document.addEventListener('click', (e) => {
            const favoriteBtn = e.target.closest('[data-favorite-btn], .favorite-btn, .btn-favorite');
            if (favoriteBtn) {
                e.preventDefault();
                e.stopPropagation();
                
                const bikeId = favoriteBtn.dataset.bikeId || 
                              favoriteBtn.dataset.favoriteBtn || 
                              favoriteBtn.closest('[data-bike-id]')?.dataset.bikeId;
                
                if (bikeId) {
                    this.toggleFavorite(bikeId);
                }
            }
        });

        // Обновление UI при изменении авторизации
        document.addEventListener('authStateChanged', () => {
            if (this.isUserAuthenticated()) {
                this.syncWithServer();
            } else {
                this.clearFavorites();
            }
        });
    }

    /**
     * Очистка избранного (при выходе из аккаунта)
     */
    clearFavorites() {
        this.favorites.clear();
        this.favoriteCounts.clear();
        this.clearCache();
        this.updateFavoriteButtons();
        this.emit('favoritesCleared');
    }

    /**
     * Показ уведомления
     */
    showNotification(message, type = 'info') {
        // Создаем простое уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Добавляем стили если их нет
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    padding: 16px;
                    z-index: 10000;
                    animation: slideInRight 0.3s ease;
                    max-width: 300px;
                }
                .notification-success { border-left: 4px solid #10b981; }
                .notification-error { border-left: 4px solid #ef4444; }
                .notification-info { border-left: 4px solid #3b82f6; }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .notification-success i { color: #10b981; }
                .notification-error i { color: #ef4444; }
                .notification-info i { color: #3b82f6; }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Показ предложения авторизации
     */
    showAuthPrompt() {
        const message = 'Войдите в аккаунт, чтобы добавлять товары в избранное';
        this.showNotification(message, 'info');
        
        // Интеграция с существующей системой авторизации
        setTimeout(() => {
            // Проверяем доступные методы авторизации
            if (typeof openModernLoginOverlay === 'function') {
                openModernLoginOverlay();
            } else if (typeof showLoginModal === 'function') {
                showLoginModal();
            } else if (window.modernHeaderManager && typeof window.modernHeaderManager.openLoginOverlay === 'function') {
                window.modernHeaderManager.openLoginOverlay();
            } else {
                // Fallback - перенаправляем на страницу входа
                window.location.href = 'index.html#login';
            }
        }, 1000);
    }

    /**
     * Сохранение в localStorage
     */
    saveToCache() {
        const cacheData = {
            favorites: Array.from(this.favorites),
            favoriteCounts: Array.from(this.favoriteCounts.entries()),
            lastUpdate: Date.now()
        };
        
        localStorage.setItem('favoritesCache', JSON.stringify(cacheData));
    }

    /**
     * Загрузка из localStorage
     */
    loadFromCache() {
        try {
            const cached = localStorage.getItem('favoritesCache');
            if (cached) {
                const data = JSON.parse(cached);
                
                // Проверяем актуальность кеша
                if (Date.now() - data.lastUpdate < this.cache.ttl) {
                    this.favorites = new Set(data.favorites || []);
                    this.favoriteCounts = new Map(data.favoriteCounts || []);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки кеша:', error);
        }
    }

    /**
     * Очистка кеша
     */
    clearCache() {
        localStorage.removeItem('favoritesCache');
    }

    /**
     * Система событий
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data = null) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Ошибка в обработчике события ${event}:`, error);
                }
            });
        }
    }
}

// Создаем глобальный экземпляр
window.favoritesManager = new FavoritesManager();

// Инициализируем обработчики событий после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.favoritesManager.initEventListeners();
    
    // Обновляем UI после инициализации
    window.favoritesManager.on('initialized', () => {
        window.favoritesManager.updateFavoriteButtons();
    });
    
    // Обновляем UI при изменении избранного
    window.favoritesManager.on('favoriteAdded', () => {
        window.favoritesManager.updateFavoriteButtons();
    });
    
    window.favoritesManager.on('favoriteRemoved', () => {
        window.favoritesManager.updateFavoriteButtons();
    });
    
    window.favoritesManager.on('favoritesUpdated', () => {
        window.favoritesManager.updateFavoriteButtons();
    });
});

// Экспортируем для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FavoritesManager;
}