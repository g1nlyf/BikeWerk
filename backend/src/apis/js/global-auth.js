
// Wait for unified system to be ready
document.addEventListener('unifiedSystemReady', function(event) {
    // System is ready, can use window.unifiedAuth, window.unifiedHeader, window.unifiedLogin
});
// Global Authentication Manager
class UnifiedAuthManager {
    constructor() {
        this.user = null;
        this.token = localStorage.getItem('authToken');
        this.listeners = [];
        this.apiClient = window.apiClient;
        
        // Initialize authentication state
        this.init();
    }

    async init() {
        // Sync APIClient token with our token
        if (this.apiClient && this.token) {
            this.apiClient.token = this.token;
        } else if (this.apiClient) {
            // Sync token from APIClient if it has one
            this.apiClient.syncTokenFromStorage();
            if (this.apiClient.token) {
                this.token = this.apiClient.token;
            }
        }

        // Check if we have a token and validate it
        if (this.token) {
            try {
                const userData = await this.apiClient.getCurrentUser();
                if (userData && userData.success) {
                    this.user = userData.user;
                    this.notifyListeners('login', this.user);
                } else {
                    // Token is invalid, clear it
                    this.logout();
                }
            } catch (error) {
                console.error('Failed to validate token:', error);
                this.logout();
            }
        }
    }

    // Add listener for auth state changes
    addListener(callback) {
        this.listeners.push(callback);
    }

    // Remove listener
    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    // Notify all listeners of auth state change
    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error('Error in auth listener:', error);
            }
        });
        
        // Отправляем глобальное событие для всех компонентов
        const customEvent = new CustomEvent('unifiedAuthStateChanged', {
            detail: { event, data, user: this.user, isAuthenticated: this.isAuthenticated() }
        });
        window.dispatchEvent(customEvent);
    }

    // Login method
    async login(credentials) {
        try {
            const response = await this.apiClient.login(credentials);
            if (response && response.success) {
                this.user = response.user;
                this.token = response.token;
                localStorage.setItem('authToken', this.token);
                this.apiClient.token = this.token;
                
                this.notifyListeners('login', this.user);
                return { success: true, user: this.user };
            } else {
                throw new Error(response.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // Logout method
    logout() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('authToken');
        if (this.apiClient) {
            this.apiClient.token = null;
        }
        
        this.notifyListeners('logout', null);
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!(this.user && this.token);
    }

    // Get current user
    getCurrentUser() {
        return this.user;
    }

    // Get user name for display
    getUserDisplayName() {
        if (!this.user) return null;
        return this.user.name || this.user.email || 'Пользователь';
    }
}

// Export class for unified system loader
window.UnifiedAuthManager = UnifiedAuthManager;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnifiedAuthManager;
}