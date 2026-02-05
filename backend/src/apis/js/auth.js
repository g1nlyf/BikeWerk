
// Wait for unified system to be ready
document.addEventListener('unifiedSystemReady', function(event) {
    // System is ready, can use window.unifiedAuth, window.unifiedHeader, window.unifiedLogin
});
// Authentication System

// Global function for login modal (called from HTML onclick)
// Define it immediately so it's available even before DOM loads
function showLoginModal() {
    if (window.authSystem) {
        window.authSystem.showLoginModal();
    } else {
        console.warn('Auth system not initialized yet, waiting...');
        // Wait for auth system to initialize
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (window.authSystem) {
                    window.authSystem.showLoginModal();
                }
            }, 100);
        });
    }
}

// Make it available globally immediately
window.showLoginModal = showLoginModal;

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.apiClient = null;
    }

    async init() {
        // Setup event listeners first
        this.setupEventListeners();
        
        // Check if user is already logged in
        await this.checkAuthState();
        
        // Update UI based on auth state
        this.updateAuthUI();
    }

    setupEventListeners() {
        // Login modal events
        const loginModal = document.getElementById('login-modal');
        const registerModal = document.getElementById('register-modal');
        
        // Close modal events
        document.querySelectorAll('.auth-modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        
        // Overlay click to close
        document.querySelectorAll('.auth-modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => this.closeModals());
        });
        
        // Switch between login and register
        const showRegisterBtn = document.getElementById('show-register');
        const showLoginBtn = document.getElementById('show-login');
        
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterModal();
            });
        }
        
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginModal();
            });
        }
        
        // Form submissions
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    showLoginModal() {
        this.closeModals();
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Focus on first input
            setTimeout(() => {
                const firstInput = modal.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }

    showRegisterModal() {
        this.closeModals();
        const modal = document.getElementById('register-modal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Focus on first input
            setTimeout(() => {
                const firstInput = modal.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }

    closeModals() {
        document.querySelectorAll('.auth-modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
        
        // Clear form errors
        this.clearFormErrors();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const email = formData.get('email').trim();
        const password = formData.get('password');
        
        // Clear previous errors
        this.clearFormErrors();
        
        // Validate inputs
        if (!email || !password) {
            this.showFormError('login-form', 'Пожалуйста, заполните все поля');
            return;
        }
        
        try {
            // Use API client for login
            const response = await window.apiClient.login({ email, password });
            
            // Login successful
            this.currentUser = response.user;
            this.saveAuthState();
            this.updateAuthUI();
            this.closeModals();
            
            // Show success message
            this.showNotification('Добро пожаловать, ' + response.user.name + '!', 'success');
            
            // Reload catalog if we're on catalog page to load user favorites
            if (window.catalog && typeof window.catalog.loadBikes === 'function') {
                await window.catalog.loadBikes();
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showFormError('login-form', error.message || 'Ошибка входа. Попробуйте еще раз.');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const name = formData.get('name').trim();
        const email = formData.get('email').trim();
        const password = formData.get('password');
        
        // Clear previous errors
        this.clearFormErrors();
        
        // Validate inputs
        if (!name || !email || !password) {
            this.showFormError('register-form', 'Пожалуйста, заполните все поля');
            return;
        }
        
        if (name.length < 2) {
            this.showFormError('register-form', 'Имя должно содержать минимум 2 символа');
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.showFormError('register-form', 'Пожалуйста, введите корректный email');
            return;
        }
        
        if (password.length < 6) {
            this.showFormError('register-form', 'Пароль должен содержать минимум 6 символов');
            return;
        }
        
        try {
            // Use API client for registration
            const response = await window.apiClient.register({ name, email, password });
            
            // Auto login after registration
            this.currentUser = response.user;
            this.saveAuthState();
            this.updateAuthUI();
            this.closeModals();
            
            // Show success message
            this.showNotification('Регистрация успешна! Добро пожаловать, ' + response.user.name + '!', 'success');
            
            // Reload catalog if we're on catalog page to load user favorites
            if (window.catalog && typeof window.catalog.loadBikes === 'function') {
                await window.catalog.loadBikes();
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showFormError('register-form', error.message || 'Ошибка регистрации. Попробуйте еще раз.');
        }
    }

    async logout() {
        try {
            // Use API client for logout
            await window.apiClient.logout();
            
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            this.updateAuthUI();
            this.showNotification('Вы успешно вышли из аккаунта', 'info');
            
            // Reload catalog if we're on catalog page to clear user-specific data
            if (window.catalog && typeof window.catalog.loadBikes === 'function') {
                await window.catalog.loadBikes();
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Even if logout fails on server, clear local state
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            this.updateAuthUI();
            this.showNotification('Вы вышли из аккаунта', 'info');
        }
    }

    updateAuthUI() {
        // Update auth buttons in header
        this.updateHeaderAuthButtons();
        
        // Update user-specific content if any
        this.updateUserContent();
        
        // Sync with global auth manager if it exists
        if (window.unifiedAuthManager) {
            // Update the global auth manager with current user state
            if (this.currentUser) {
                window.unifiedAuthManager.currentUser = this.currentUser;
                window.unifiedAuthManager.isLoggedIn = true;
            } else {
                window.unifiedAuthManager.currentUser = null;
                window.unifiedAuthManager.isLoggedIn = false;
            }
            // Notify listeners of auth state change
            window.unifiedAuthManager.notifyListeners();
        }
        
        // Also sync with header manager if it exists (for backward compatibility)
        if (window.headerManager) {
            window.headerManager.currentUser = this.currentUser;
            window.headerManager.isLoggedIn = !!this.currentUser;
            if (typeof window.headerManager.updateAuthUI === 'function') {
                window.headerManager.updateAuthUI();
            }
        }
    }

    updateHeaderAuthButtons() {
        // Update header elements directly
        const loginBtn = document.getElementById('login-btn');
        const profileDropdown = document.getElementById('profile-dropdown');
        
        if (this.currentUser) {
            // Hide login button, show profile
            if (loginBtn) loginBtn.style.display = 'none';
            if (profileDropdown) profileDropdown.style.display = 'block';
            
            // Update profile name
            const profileName = document.getElementById('profile-name');
            if (profileName) {
                profileName.textContent = this.currentUser.name || this.currentUser.email || 'Пользователь';
            }
        } else {
            // Show login button, hide profile
            if (loginBtn) loginBtn.style.display = 'block';
            if (profileDropdown) profileDropdown.style.display = 'none';
        }
    }

    createAuthButtons() {
        const authButtons = document.createElement('div');
        authButtons.className = 'auth-buttons';
        
        const loginBtn = document.createElement('button');
        loginBtn.className = 'auth-btn';
        loginBtn.textContent = 'Войти';
        loginBtn.addEventListener('click', () => this.showLoginModal());
        
        const registerBtn = document.createElement('button');
        registerBtn.className = 'auth-btn primary';
        registerBtn.textContent = 'Регистрация';
        registerBtn.addEventListener('click', () => this.showRegisterModal());
        
        authButtons.appendChild(loginBtn);
        authButtons.appendChild(registerBtn);
        
        return authButtons;
    }

    createUserMenu() {
        const userMenu = document.createElement('div');
        userMenu.className = 'user-menu';
        
        const toggle = document.createElement('button');
        toggle.className = 'user-menu-toggle';
        toggle.innerHTML = `
            <span>${this.currentUser.name}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
        `;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'user-menu-dropdown';
        dropdown.innerHTML = `
            <a href="#" class="user-menu-item">Профиль</a>
            <a href="#" class="user-menu-item">Мои заказы</a>
            <a href="#" class="user-menu-item">Избранное</a>
            <a href="#" class="user-menu-item logout">Выйти</a>
        `;
        
        // Toggle dropdown
        toggle.addEventListener('click', () => {
            userMenu.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenu.contains(e.target)) {
                userMenu.classList.remove('active');
            }
        });
        
        // Handle logout
        const logoutBtn = dropdown.querySelector('.logout');
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
        
        userMenu.appendChild(toggle);
        userMenu.appendChild(dropdown);
        
        return userMenu;
    }

    updateUserContent() {
        // Update any user-specific content on the page
        // This can be extended based on specific needs
    }

    // Utility methods
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showFormError(formId, message) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        // Remove existing error
        const existingError = form.querySelector('.form-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.style.cssText = `
            color: #ef4444;
            font-size: 14px;
            margin-top: 8px;
            padding: 8px 12px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 6px;
            border: 1px solid rgba(239, 68, 68, 0.2);
        `;
        errorDiv.textContent = message;
        
        form.appendChild(errorDiv);
    }

    clearFormErrors() {
        document.querySelectorAll('.form-error').forEach(error => {
            error.remove();
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            font-size: 14px;
            font-weight: 500;
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
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Data persistence (now handled by API)

    async checkAuthState() {
        try {
            // Check if user is authenticated via API
            const user = await window.apiClient.getCurrentUser();
            if (user) {
                this.currentUser = user;
                this.saveAuthState();
            } else {
                // Clear any stale local data
                this.currentUser = null;
                localStorage.removeItem('currentUser');
            }
        } catch (error) {
            console.log('No authenticated user found');
            // Clear any stale local data
            this.currentUser = null;
            localStorage.removeItem('currentUser');
        }
    }

    saveAuthState() {
        if (this.currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        } else {
            localStorage.removeItem('currentUser');
        }
    }
}

// Initialize auth system when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.authSystem = new AuthSystem();
    await window.authSystem.init();
});

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthSystem;
}